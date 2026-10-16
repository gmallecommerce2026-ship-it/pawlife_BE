import { Injectable } from '@nestjs/common';
import { Pet, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { buildWorkbook, readWorkbook } from './pet-sheet.excel';
import { buildPetData, canonFromRaw, EDIT_KEYS, norm, petToFields, SPECIES_JSON, speciesOfPet } from './pet-sheet.mapper';
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

        for (const { sp, rows } of tabs) {
            const pool = new Map<string, Pet[]>();
            for (const p of pets) {
                if (speciesOfPet(p.species) !== sp) continue;
                const k = norm(p.shelterInternalId ?? p.microchipNumber ?? '');
                if (k) pool.set(k, [...(pool.get(k) ?? []), p]);
            }
            for (const raw of rows) {
                const f = canonFromRaw(raw);
                const hit = pool.get(norm(f.id))?.shift();
                if (!hit) {
                    creates.push({ ...buildPetData(f, new Set(EDIT_KEYS)), name: f.id, species: SPECIES_JSON[sp], shelterId } as any);
                    stat.created++;
                    continue;
                }
                const dbF = petToFields(hit);
                const changed = new Set(EDIT_KEYS.filter((k) => k !== 'name' && f[k] !== dbF[k]));
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
}