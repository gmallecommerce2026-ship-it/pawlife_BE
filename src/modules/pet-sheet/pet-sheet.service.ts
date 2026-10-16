import { Injectable } from '@nestjs/common';
import { Pet, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { buildWorkbook, readWorkbook } from './pet-sheet.excel';
import { buildPetData, canonFromRaw, EDIT_KEYS, EditKey, norm, petToFields, SPECIES_JSON, speciesOfPet } from './pet-sheet.mapper';
import { GoogleSheetsClient } from './google-sheets.client';

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

@Injectable()
export class PetSheetService {
    constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly gs: GoogleSheetsClient) { }

    status() { return { linked: true, ready: true }; }

    /** Gắn ảnh theo link Drive trong cột Ảnh (thư mục → mọi ảnh trong đó; file → chính file đó). */
    async syncImages(shelterId: string) {
        const pets = await this.prisma.pet.findMany({ where: { shelterId }, include: { images: { select: { url: true } } } });
        const todo = pets.filter((p) => /drive\.google\.com/.test(p.photoNote ?? ''));
        const stat = { pets: 0, added: 0, noLink: pets.length - todo.length, failed: 0 };
        const toUrl = (id: string) => `https://lh3.googleusercontent.com/d/${id}=w1200`;

        const work = async (p: (typeof pets)[number]) => {
            const note = p.photoNote!;
            const folder = note.match(/folders\/([\w-]+)/)?.[1];
            const file = note.match(/file\/d\/([\w-]+)/)?.[1] ?? note.match(/[?&]id=([\w-]+)/)?.[1];
            let ids: string[] = [];
            try { ids = folder ? await this.gs.listImages(folder) : file ? [file] : []; } catch { stat.failed++; return; }
            if (!ids.length) { stat.failed++; return; }
            const have = new Set(p.images.map((i) => i.url));
            const fresh = ids.map(toUrl).filter((u) => !have.has(u));
            if (!fresh.length) return;
            for (const url of fresh) {
                await this.prisma.pet.update({ where: { id: p.id }, data: { images: { create: { url } } } });
            }
            await this.redis.del(`pet:detail:${p.id}`);
            stat.pets++; stat.added += fresh.length;
        };
        const queue = [...todo];
        await Promise.all(Array.from({ length: 5 }, async () => { for (let p; (p = queue.shift());) await work(p); }));
        return stat;
    }

    async exportXlsx(shelterId: string): Promise<Buffer> {
        return buildWorkbook(await this.prisma.pet.findMany({ where: { shelterId } }));
    }

    /** Nhập file Excel: khớp theo ID trong cùng loài → cập nhật, chưa có → tạo mới. Không xoá pet nào. */
    async importWorkbook(shelterId: string, buf: Buffer) {
        const tabs = await readWorkbook(buf);
        const pets = await this.prisma.pet.findMany({ where: { shelterId } });
        const stat = { created: 0, updated: 0, unchanged: 0 };
        const creates: Prisma.PetCreateManyInput[] = [];
        const updates: Prisma.PrismaPromise<any>[] = [];
        const touched: string[] = [];
        const used = new Set<string>();
        const take = (m: Map<string, Pet[]>, k: string) => {
            const l = m.get(k);
            while (l?.length) { const p = l.shift()!; if (!used.has(p.id)) { used.add(p.id); return p; } }
            return undefined;
        };

        for (const { sp, rows } of tabs) {
            const byId = new Map<string, Pet[]>();
            const byName = new Map<string, Pet[]>();
            const add = (m: Map<string, Pet[]>, k: string, p: Pet) => { if (k) m.set(k, [...(m.get(k) ?? []), p]); };
            for (const p of pets) {
                if (speciesOfPet(p.species) !== sp) continue;
                add(byId, norm(p.shelterInternalId ?? p.microchipNumber ?? ''), p);
                if (!p.shelterInternalId) add(byName, norm(p.name), p); // pet chưa có ID nội bộ: khớp theo tên
            }
            for (const raw of rows) {
                const f = canonFromRaw(raw);
                const k = norm(f.id);
                const hit = take(byId, k) ?? take(byName, k);
                if (!hit) {
                    creates.push({ ...buildPetData(f, new Set(EDIT_KEYS)), name: f.name || f.id, species: SPECIES_JSON[sp], shelterId } as any);
                    stat.created++;
                    continue;
                }
                const dbF = petToFields(hit);
                const changed = new Set(EDIT_KEYS.filter((x) => (x === 'name' ? !!f.name && f.name !== dbF.name : f[x] !== dbF[x])));
                if (!changed.size) { stat.unchanged++; continue; }
                updates.push(this.prisma.pet.update({
                    where: { id: hit.id },
                    data: buildPetData(f, changed, hit) as Prisma.PetUncheckedUpdateInput,
                }));
                touched.push(hit.id);
                stat.updated++;
            }
        }
        for (const c of chunk(creates, 200)) await this.prisma.pet.createMany({ data: c });
        for (const c of chunk(updates, 100)) await this.prisma.$transaction(c);
        for (const id of touched) await this.redis.del(`pet:detail:${id}`);
        const images = await this.syncImages(shelterId).catch((e) => ({ error: String(e?.message ?? e) }));
        return { ok: true, ...stat, images };
    }
    /** Mọi bảng có khoá ngoại (1 cột) trỏ tới Pet, lấy từ schema Prisma. */
    private petRelations() {
        const models = (Prisma as any).dmmf.datamodel.models as any[];
        const out: { delegate: string; fk: string }[] = [];
        for (const m of models) {
            if (m.name === 'Pet' || m.name === 'PetSheetRow') continue;
            for (const f of m.fields) {
                if (f.kind === 'object' && f.type === 'Pet' && f.relationFromFields?.length === 1) {
                    out.push({ delegate: m.name[0].toLowerCase() + m.name.slice(1), fk: f.relationFromFields[0] });
                }
            }
        }
        return out;
    }

    /**
     * Gộp pet trùng: cùng loài và (cùng ID nội bộ/chip, hoặc ID của pet này = tên của pet kia khi pet kia chưa có ID khác).
     * dry=true chỉ xem trước. Pet giữ lại là pet có nhiều dữ liệu liên quan nhất (đơn nhận nuôi, ảnh, tag...).
     */
    async mergeDuplicates(shelterId: string, dry = true) {
        const pets = await this.prisma.pet.findMany({ where: { shelterId } });
        const sp = (p: Pet) => speciesOfPet(p.species) ?? 'x';
        const idKey = (p: Pet) => norm(p.shelterInternalId || p.microchipNumber || '');
        const parent = new Map(pets.map((p) => [p.id, p.id]));
        const find = (x: string): string => { while (parent.get(x) !== x) x = parent.get(x)!; return x; };
        const union = (a: string, b: string) => parent.set(find(a), find(b));
        const idIdx = new Map<string, Pet[]>();
        const nameIdx = new Map<string, Pet[]>();
        const add = (m: Map<string, Pet[]>, k: string, p: Pet) => m.set(k, [...(m.get(k) ?? []), p]);
        for (const p of pets) { if (idKey(p)) add(idIdx, `${sp(p)}|${idKey(p)}`, p); add(nameIdx, `${sp(p)}|${norm(p.name)}`, p); }
        for (const a of pets) {
            const k = idKey(a);
            if (!k) continue;
            for (const b of idIdx.get(`${sp(a)}|${k}`) ?? []) union(a.id, b.id);
            for (const b of nameIdx.get(`${sp(a)}|${k}`) ?? []) if (!idKey(b) || idKey(b) === k) union(a.id, b.id);
        }
        const groups = new Map<string, Pet[]>();
        for (const p of pets) groups.set(find(p.id), [...(groups.get(find(p.id)) ?? []), p]);
        const dup = [...groups.values()].filter((g) => g.length > 1);

        const rels = this.petRelations();
        const score = async (id: string) => {
            let n = 0;
            for (const r of rels) { try { n += await (this.prisma as any)[r.delegate].count({ where: { [r.fk]: id } }); } catch { /* bỏ qua */ } }
            return n;
        };
        const DEF: Record<string, string> = { spay: 'Chưa triệt sản', vacc: 'Chưa tiêm', status: 'Sẵn sàng nhận nuôi' };
        const label = (p: Pet) => `${p.name} (${p.shelterInternalId ?? p.microchipNumber ?? 'chưa có ID'})`;
        const res = { dry, groups: dup.length, extra: dup.reduce((s, g) => s + g.length - 1, 0), merged: 0, blocked: 0, preview: [] as { keep: string; merge: string[] }[] };

        for (const g of dup) {
            const scored = await Promise.all(g.map(async (p) => ({ p, s: await score(p.id) })));
            scored.sort((a, b) => b.s - a.s || +a.p.createdAt - +b.p.createdAt);
            let keep = scored[0].p;
            const others = scored.slice(1).map((x) => x.p);
            res.preview.push({ keep: label(keep), merge: others.map(label) });
            if (dry) continue;

            for (const d of others) {
                await this.prisma.petSheetRow.deleteMany({ where: { petId: d.id } }).catch(() => undefined);
                let blocked = false;
                for (const r of rels) {
                    try { await (this.prisma as any)[r.delegate].updateMany({ where: { [r.fk]: d.id }, data: { [r.fk]: keep.id } }); }
                    catch { blocked = true; } // vướng ràng buộc duy nhất (vd cả hai pet đều có tag) → không gộp pet này
                }
                if (blocked) { res.blocked++; continue; }
                const kf = petToFields(keep), df = petToFields(d);
                const merged = { ...kf };
                const changed = new Set<EditKey>();
                for (const k of EDIT_KEYS) {
                    if (k === 'name') continue;
                    if ((!kf[k] || DEF[k] === kf[k]) && df[k] && df[k] !== kf[k]) { merged[k] = df[k]; changed.add(k); }
                }
                try { await this.prisma.pet.delete({ where: { id: d.id } }); } catch { res.blocked++; continue; }
                if (changed.size) keep = await this.prisma.pet.update({ where: { id: keep.id }, data: buildPetData(merged, changed, keep) as Prisma.PetUncheckedUpdateInput });
                await this.redis.del(`pet:detail:${d.id}`);
                res.merged++;
            }
            await this.redis.del(`pet:detail:${keep.id}`);
        }
        return res;
    }
}