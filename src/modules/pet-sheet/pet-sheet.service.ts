import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ApplicationStatus, Pet, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { GoogleSheetsClient, TabInfo, ValueRange } from './google-sheets.client';
import {
  APP_LABEL, buildPetData, canonFromRaw, cellText, colLetter, columnsFor, detectSpecies, EDIT_KEYS, EditKey,
  Fields, hashFields, mapHeader, norm, petToFields, SheetSpecies, SPECIES_JSON, speciesOfPet, validationRequests,
} from './pet-sheet.mapper';

const TICK_MS = Number(process.env.PET_SHEET_TICK_MS) || 10_000;
const MAX_AUTO_DELETE = 5;

interface Plan {
  pre: any[];
  writes: ValueRange[];
  post: any[];
  deletes: { sheetId: number; rowNo: number }[];
  snapUpsert: { petId: string; hash: string }[];
  snapDelete: string[];
}
interface Stat { imported: number; created: number; appended: number; exported: number; deleted: number; restored: number; conflicts: number }
interface TabRun {
  shelterId: string; sp: SheetSpecies; tab: TabInfo; values: string[][]; pets: Pet[]; allPetIds: Set<string>;
  snaps: Map<string, string>; apps: Map<string, string>; plan: Plan; stat: Stat; touched: Set<string>; force: boolean;
}

@Injectable()
export class PetSheetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PetSheetService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private readonly running = new Set<string>();
  private readonly forceDecorate = new Set<string>();
  private readonly backoff = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gs: GoogleSheetsClient,
  ) { }

  onModuleInit() {
    if (!this.gs.ready) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  // ───────────── Vòng lặp nền ─────────────
  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const links = await this.prisma.petSheetLink.findMany({ where: { status: { not: 'PAUSED' } } });
      for (const link of links) {
        if ((this.backoff.get(link.shelterId) ?? 0) > Date.now()) continue;
        try {
          const [mod, fp] = await Promise.all([this.gs.modifiedTime(link.spreadsheetId), this.fingerprint(link.shelterId)]);
          if (mod !== link.lastSheetModified || fp !== link.dbFingerprint) await this.sync(link.shelterId);
        } catch { /* sync() đã ghi log + trạng thái lỗi */ }
      }
    } finally {
      this.ticking = false;
    }
  }

  // Dấu vân tay dữ liệu: đổi pet hoặc đơn nhận nuôi (kể cả xoá) đều làm nó đổi
  private async fingerprint(shelterId: string): Promise<string> {
    const [p, a] = await Promise.all([
      this.prisma.pet.aggregate({ where: { shelterId }, _max: { updatedAt: true }, _count: { _all: true } }),
      this.prisma.adoptionApplication.aggregate({ where: { pet: { shelterId } }, _max: { updatedAt: true }, _count: { _all: true } }),
    ]);
    return `${p._max.updatedAt?.getTime() ?? 0}|${p._count._all}|${a._max.updatedAt?.getTime() ?? 0}|${a._count._all}`;
  }

  private async fail(shelterId: string, e: unknown) {
    const msg = String((e as any)?.message ?? e).slice(0, 500);
    this.logger.error(`[${shelterId}] đồng bộ lỗi: ${msg}`);
    this.backoff.set(shelterId, Date.now() + 60_000);
    await this.prisma.petSheetLink.updateMany({ where: { shelterId }, data: { status: 'ERROR', lastError: msg } });
  }

  // ───────────── API cho controller ─────────────
  async status(shelterId: string) {
    const link = await this.prisma.petSheetLink.findUnique({ where: { shelterId } });
    if (!link) return { linked: false, ready: this.gs.ready };
    return {
      linked: true,
      ready: this.gs.ready,
      url: link.url,
      status: link.status,
      lastError: link.lastError,
      lastSyncedAt: link.lastSyncedAt,
      version: link.version,
    };
  }

  async ensureAccess(shelterId: string, userId: string) {
    if (!this.gs.ready) return;
    const link = await this.prisma.petSheetLink.findUnique({ where: { shelterId } });
    if (!link) return;
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const shared = (link.sharedEmails as string[] | null) ?? [];
    if (!u?.email || shared.includes(u.email)) return;
    try {
      await this.gs.share(link.spreadsheetId, u.email);
      await this.prisma.petSheetLink.update({ where: { id: link.id }, data: { sharedEmails: [...shared, u.email] } });
    } catch (e: any) {
      this.logger.warn(`Không share được sheet cho ${u.email}: ${e?.message}`);
    }
  }

  async linkWorkbook(shelterId: string, buffer: Buffer) {
    this.gs.assertReady();
    const shelter = await this.prisma.shelter.findUnique({ where: { id: shelterId }, select: { name: true } });
    const up = await this.gs.uploadXlsx(`PawLife • Hồ sơ pet • ${shelter?.name ?? shelterId}`, buffer);

    const staff = await this.prisma.user.findMany({ where: { shelterId, isDeleted: false }, select: { email: true } });
    const shared: string[] = [];
    for (const { email } of staff) {
      if (!email) continue;
      try { await this.gs.share(up.id, email); shared.push(email); }
      catch (e: any) { this.logger.warn(`Không share được sheet cho ${email}: ${e?.message}`); }
    }

    const data = {
      spreadsheetId: up.id, url: up.url, status: 'ACTIVE', lastError: null,
      lastSheetModified: null, dbFingerprint: null, sharedEmails: shared,
    };
    const link = await this.prisma.petSheetLink.upsert({ where: { shelterId }, create: { shelterId, ...data }, update: data });
    await this.prisma.petSheetRow.deleteMany({ where: { linkId: link.id } }); // liên kết lại → sheet thắng ở lần đầu
    this.forceDecorate.add(shelterId);
    const result = await this.sync(shelterId);
    return { ...(await this.status(shelterId)), result };
  }

  async exportXlsx(shelterId: string): Promise<Buffer> {
    const link = await this.prisma.petSheetLink.findUnique({ where: { shelterId } });
    if (!link) throw new Error('Trạm chưa liên kết Google Sheet.');
    return this.gs.exportXlsx(link.spreadsheetId);
  }

  async unlink(shelterId: string) {
    await this.prisma.petSheetLink.deleteMany({ where: { shelterId } }); // rows xoá theo cascade; sheet trên Drive được giữ nguyên
    return { linked: false };
  }

  // ───────────── Đồng bộ ─────────────
  async sync(shelterId: string) {
    if (this.running.has(shelterId)) return { skipped: true };
    const lockKey = `petsheet:lock:${shelterId}`;
    if (await this.redis.get(lockKey)) return { skipped: true };
    this.running.add(shelterId);
    await this.redis.set(lockKey, true, 120);
    try {
      return await this.doSync(shelterId);
    } catch (e) {
      await this.fail(shelterId, e);
      throw e;
    } finally {
      this.running.delete(shelterId);
      await this.redis.del(lockKey);
    }
  }

  private async activeApplications(shelterId: string): Promise<Map<string, string>> {
    const rows = await this.prisma.adoptionApplication.findMany({
      where: { pet: { shelterId }, status: { notIn: [ApplicationStatus.CLOSED, ApplicationStatus.ADOPTION_COMPLETED] } },
      select: { petId: true, status: true },
      orderBy: { updatedAt: 'desc' },
    });
    const agg = new Map<string, { n: number; last: string }>();
    for (const r of rows) {
      const a = agg.get(r.petId);
      if (a) a.n++; else agg.set(r.petId, { n: 1, last: r.status });
    }
    return new Map([...agg].map(([id, a]) => [id, `${a.n} đơn • ${APP_LABEL[a.last] ?? a.last}`] as [string, string]));
  }

  private async deletePet(petId: string) {
    await this.prisma.$transaction([
      this.prisma.tag.updateMany({ where: { petId }, data: { status: 'INACTIVE', petId: null, linkedAt: null } }),
      this.prisma.pet.delete({ where: { id: petId } }),
    ]);
  }

  private async doSync(shelterId: string) {
    const link = await this.prisma.petSheetLink.findUnique({ where: { shelterId } });
    if (!link) return { skipped: true };
    const force = this.forceDecorate.delete(shelterId);
    const sid = link.spreadsheetId;

    // Lấy mốc TRƯỚC khi đọc: nếu có ai sửa giữa chừng, vòng sau sẽ thấy khác và đồng bộ lại
    const modBefore = await this.gs.modifiedTime(sid);
    const fpBefore = await this.fingerprint(shelterId);

    const pets = await this.prisma.pet.findMany({ where: { shelterId } });
    const allPetIds = new Set(pets.map((p) => p.id));
    const snapRows = await this.prisma.petSheetRow.findMany({ where: { linkId: link.id } });
    const snaps = new Map(snapRows.map((r) => [r.petId, r.hash] as [string, string]));
    const apps = await this.activeApplications(shelterId);

    const tabs = await this.gs.tabs(sid);
    const jobs: { sp: SheetSpecies; tab: TabInfo }[] = [];
    for (const sp of ['DOG', 'CAT'] as SheetSpecies[]) {
      let tab = tabs.find((t) => detectSpecies(t.title) === sp);
      if (!tab && pets.some((p) => speciesOfPet(p.species) === sp)) {
        tab = await this.gs.addTab(sid, sp === 'DOG' ? 'Chó' : 'Mèo');
      }
      if (tab) jobs.push({ sp, tab });
    }
    if (!jobs.length) throw new Error('Google Sheet không có tab Chó/Mèo.');
    const values = await this.gs.values(sid, jobs.map((j) => j.tab.title));

    const plan: Plan = { pre: [], writes: [], post: [], deletes: [], snapUpsert: [], snapDelete: [] };
    const stat: Stat = { imported: 0, created: 0, appended: 0, exported: 0, deleted: 0, restored: 0, conflicts: 0 };
    const touched = new Set<string>();

    for (let i = 0; i < jobs.length; i++) {
      await this.syncTab({
        shelterId, sp: jobs[i].sp, tab: jobs[i].tab, values: values[i] ?? [], pets, allPetIds, snaps, apps,
        plan, stat, touched, force,
      });
    }

    // Ghi sheet: mở rộng lưới → ghi ô → xoá dòng → dropdown
    await this.gs.batchUpdate(sid, plan.pre);
    await this.gs.writeValues(sid, plan.writes);
    const delReq = [...plan.deletes]
      .sort((a, b) => b.rowNo - a.rowNo)
      .map((d) => ({ deleteDimension: { range: { sheetId: d.sheetId, dimension: 'ROWS', startIndex: d.rowNo - 1, endIndex: d.rowNo } } }));
    await this.gs.batchUpdate(sid, [...delReq, ...plan.post]);

    // Lưu snapshot
    const gone = snapRows.filter((r) => !allPetIds.has(r.petId)).map((r) => r.petId);
    const delIds = [...plan.snapDelete, ...gone];
    await this.prisma.$transaction([
      ...plan.snapUpsert.map((s) =>
        this.prisma.petSheetRow.upsert({
          where: { petId: s.petId },
          create: { petId: s.petId, linkId: link.id, hash: s.hash },
          update: { linkId: link.id, hash: s.hash },
        }),
      ),
      ...(delIds.length ? [this.prisma.petSheetRow.deleteMany({ where: { petId: { in: delIds } } })] : []),
    ]);

    for (const id of touched) await this.redis.del(`pet:detail:${id}`);

    const madeDb = stat.imported + stat.created + stat.deleted > 0;
    const wrote = plan.pre.length + plan.writes.length + delReq.length + plan.post.length > 0;
    await this.prisma.petSheetLink.update({
      where: { id: link.id },
      data: {
        status: 'ACTIVE',
        lastError: null,
        lastSyncedAt: new Date(),
        lastSheetModified: wrote ? null : modBefore, // null → vòng sau kiểm tra lại 1 lần rồi hội tụ
        dbFingerprint: madeDb ? null : fpBefore,
        ...(madeDb ? { version: { increment: 1 } } : {}),
      },
    });
    this.backoff.delete(shelterId);
    return { ok: true, ...stat };
  }

  private async syncTab(c: TabRun) {
    const { sp, tab, plan, stat } = c;
    const header = [...(c.values[0] ?? [])];
    const col = mapHeader(sp, header);
    const writes = new Map<number, Map<number, string>>();
    const put = (r: number, ci: number, v: string) => {
      let m = writes.get(r);
      if (!m) { m = new Map(); writes.set(r, m); }
      m.set(ci, v);
    };

    // 1) Thêm các cột còn thiếu vào bên phải
    let next = Math.max(header.length, ...c.values.map((r) => r.length));
    let created = false;
    for (const d of columnsFor(sp)) {
      if (d.create && col[d.key] === undefined) {
        col[d.key] = next;
        put(1, next, d.header);
        next++;
        created = true;
      }
    }
    const keys = EDIT_KEYS.filter((k) => col[k] !== undefined);
    const cell = (r: string[], k: keyof typeof col) => (col[k] === undefined ? '' : cellText(r[col[k]!]));

    // 2) Chỉ mục để ghép dòng chưa có "Mã hệ thống" với pet sẵn có
    const petsSp = c.pets.filter((p) => speciesOfPet(p.species) === sp);
    const byId = new Map(petsSp.map((p) => [p.id, p]));
    const byInternal = new Map<string, Pet[]>();
    const byName = new Map<string, Pet[]>();
    const add = (m: Map<string, Pet[]>, k: string, p: Pet) => {
      if (!k) return;
      const l = m.get(k);
      if (l) l.push(p); else m.set(k, [p]);
    };
    for (const p of petsSp) {
      add(byInternal, norm(p.shelterInternalId ?? p.microchipNumber ?? ''), p);
      add(byName, norm(p.name), p);
    }
    const used = new Set<string>();

    // 3) Duyệt từng dòng
    const rows = c.values.slice(1);
    let lastRow = 1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNo = i + 2;
      const keyVal = cell(r, 'key');
      const raw = {} as Fields;
      for (const k of EDIT_KEYS) raw[k] = cell(r, k);
      if (!keyVal && !raw.id && !raw.name) continue;
      lastRow = rowNo;

      // Pet đã bị xoá trên web → xoá dòng
      if (keyVal && !c.allPetIds.has(keyVal) && c.snaps.has(keyVal)) {
        plan.deletes.push({ sheetId: tab.sheetId, rowNo });
        plan.snapDelete.push(keyVal);
        continue;
      }
      // Khoá thuộc pet loài khác → không đụng
      if (keyVal && c.allPetIds.has(keyVal) && !byId.has(keyVal)) continue;

      let pet = keyVal ? byId.get(keyVal) : undefined;
      if (pet && used.has(pet.id)) pet = undefined; // dòng bị copy trùng khoá
      if (!pet) {
        const iid = norm(raw.id);
        const cands = iid ? byInternal.get(iid) : raw.name ? byName.get(norm(raw.name)) : undefined;
        pet = cands?.find((p) => !used.has(p.id));
      }

      const sheetF = canonFromRaw(raw);
      const sHash = hashFields(sheetF, keys);
      let final: Fields;
      let petId: string;

      if (!pet) {
        const data = {
          ...buildPetData(sheetF, new Set(keys)),
          name: sheetF.name || sheetF.id,
          species: SPECIES_JSON[sp],
          shelterId: c.shelterId,
        } as Prisma.PetUncheckedCreateInput;
        const createdPet = await this.prisma.pet.create({ data });
        final = petToFields(createdPet);
        petId = createdPet.id;
        used.add(petId);
        c.touched.add(petId);
        stat.created++;
      } else {
        used.add(pet.id);
        petId = pet.id;
        const dbF = petToFields(pet);
        const dHash = hashFields(dbF, keys);
        const snap = c.snaps.get(pet.id);
        if (sHash === dHash) {
          final = dbF;
        } else if (snap === undefined || (sHash !== snap && dHash === snap)) {
          // Sheet đổi (hoặc lần liên kết đầu) → nhập vào DB, chỉ các field thật sự khác
          const changed = new Set<EditKey>(keys.filter((k) => sheetF[k] !== dbF[k]));
          const updated = await this.prisma.pet.update({
            where: { id: pet.id },
            data: buildPetData(sheetF, changed, pet) as Prisma.PetUncheckedUpdateInput,
          });
          final = petToFields(updated);
          c.touched.add(pet.id);
          stat.imported++;
        } else {
          // Web đổi, hoặc cả hai cùng đổi → web thắng
          if (sHash !== snap && dHash !== snap) stat.conflicts++; else stat.exported++;
          final = dbF;
        }
      }

      // Ghi lại những ô lệch so với dữ liệu chuẩn
      for (const k of keys) if (raw[k] !== final[k]) put(rowNo, col[k]!, final[k]);
      if (keyVal !== petId) put(rowNo, col.key!, petId);
      const appsTxt = c.apps.get(petId) ?? '';
      if (cell(r, 'apps') !== appsTxt) put(rowNo, col.apps!, appsTxt);

      const fh = hashFields(final, keys);
      if (c.snaps.get(petId) !== fh) plan.snapUpsert.push({ petId, hash: fh });
    }

    // 4) Pet có bên web mà không có dòng nào
    const append: Pet[] = [];
    const missing: Pet[] = [];
    for (const p of petsSp) {
      if (used.has(p.id)) continue;
      if (c.snaps.has(p.id)) missing.push(p); else append.push(p);
    }
    // Từng đồng bộ rồi mà dòng biến mất = bị xoá trong sheet. Chỉ xoá pet khi an toàn.
    const deletable = missing.filter((p) => p.status !== 'ADOPTED' && !c.apps.has(p.id));
    const allowDelete = lastRow > 1 && deletable.length <= MAX_AUTO_DELETE;
    for (const p of missing) {
      if (allowDelete && deletable.includes(p)) {
        await this.deletePet(p.id);
        plan.snapDelete.push(p.id);
        c.touched.add(p.id);
        stat.deleted++;
      } else {
        append.push(p);
        stat.restored++;
      }
    }

    let nr = lastRow + 1;
    for (const p of append) {
      const f = petToFields(p);
      for (const k of keys) put(nr, col[k]!, f[k]);
      put(nr, col.key!, p.id);
      put(nr, col.apps!, c.apps.get(p.id) ?? '');
      plan.snapUpsert.push({ petId: p.id, hash: hashFields(f, keys) });
      nr++;
      stat.appended++;
    }

    // 5) Gom ô thành các range liền nhau
    const title = this.gs.quote(tab.title);
    let maxRow = 1;
    let maxCol = 0;
    for (const [row, m] of writes) {
      const cols = [...m.keys()].sort((a, b) => a - b);
      let s = 0;
      while (s < cols.length) {
        let e = s;
        while (e + 1 < cols.length && cols[e + 1] === cols[e] + 1) e++;
        plan.writes.push({
          range: `${title}!${colLetter(cols[s])}${row}:${colLetter(cols[e])}${row}`,
          values: [cols.slice(s, e + 1).map((ci) => m.get(ci)!)],
        });
        s = e + 1;
      }
      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, cols[cols.length - 1]);
    }
    if (maxRow > tab.rowCount) {
      plan.pre.push({ appendDimension: { sheetId: tab.sheetId, dimension: 'ROWS', length: maxRow - tab.rowCount + 50 } });
    }
    if (maxCol + 1 > tab.colCount) {
      plan.pre.push({ appendDimension: { sheetId: tab.sheetId, dimension: 'COLUMNS', length: maxCol + 1 - tab.colCount } });
    }
    if (created || c.force) {
      plan.post.push(...validationRequests(tab.sheetId, col, Math.max(tab.rowCount, maxRow + 50)));
    }
  }
}