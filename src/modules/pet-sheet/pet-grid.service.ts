import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, Pet, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import {
  APP_LABEL, buildPetData, canonFromRaw, columnsFor, EDIT_KEYS, EditKey, FieldKey, Fields, GENDER_OPTIONS,
  petToFields, SheetSpecies, SPAY_OPTIONS, SPECIES_JSON, speciesOfPet, STATUS_OPTIONS, VACC_OPTIONS,
} from './pet-sheet.mapper';

type PetImg = Pet & { images: { url: string }[] };
type ColType = 'text' | 'suggest' | 'select' | 'readonly';
const INCLUDE = { images: { orderBy: { createdAt: 'asc' as const }, take: 1 } };

// Lấy từ dropdown trong file Excel của trạm; được gộp thêm với giá trị đang có trong DB
const AREAS = ['Tôn Đức Thắng', 'Nam Đồng', 'Hòa Lạc', 'Foster', 'Quốc Oai', 'Nhà chủ cũ', 'Elite', 'Petshare Kim Ngưu',
  'Đoài Phương CS3', 'Monpet', 'Hùng Vương', 'Nông nghiệp', 'Ettishop', '410 Nguyễn Trãi', 'Petshare Khương Đình', 'Kingpet'];
const LISTING = ['Đã đăng', 'Thiếu ảnh', 'Không đủ đk tìm chủ', 'Ưu tiên foster', 'chưa chủ điều kiện nhận nuôi', 'Lỗi'];
const COLORS = ['nâu', 'trắng', 'đen', 'xám', 'vàng', 'đỏ', 'vện', 'cam', 'tam thể', 'nhị thể', 'mướp'];

const uniq = (a: string[]) => [...new Set(a.map((s) => s.trim()).filter(Boolean))];

@Injectable()
export class PetGridService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) { }

  private async activeApps(shelterId: string): Promise<Map<string, string>> {
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

  private toRow(p: PetImg, apps: Map<string, string>) {
    return { id: p.id, avatarUrl: p.images[0]?.url ?? null, apps: apps.get(p.id) ?? '', f: petToFields(p) };
  }

  private columns(sp: SheetSpecies, fs: Fields[]) {
    const seen = (k: EditKey) => uniq(fs.map((f) => f[k]));
    const opt: Partial<Record<FieldKey, { type: ColType; options: string[] }>> = {
      gender: { type: 'select', options: GENDER_OPTIONS },
      spay: { type: 'select', options: SPAY_OPTIONS },
      status: { type: 'select', options: STATUS_OPTIONS },
      vacc: { type: 'suggest', options: uniq([...VACC_OPTIONS, ...seen('vacc')]) },
      area: { type: 'suggest', options: uniq([...AREAS, ...seen('area')]) },
      color: { type: 'suggest', options: uniq([...COLORS, ...seen('color')]) },
      listing: { type: 'suggest', options: uniq([...LISTING, ...seen('listing')]) },
      breed: { type: 'suggest', options: seen('breed') },
    };
    return columnsFor(sp)
      .filter((c) => c.key !== 'key' && c.create)
      .map((c) => ({
        key: c.key, header: c.header, width: c.width,
        type: (c.key === 'apps' ? 'readonly' : opt[c.key]?.type ?? 'text') as ColType,
        options: opt[c.key]?.options,
      }));
  }

  private clean(patch: any): Partial<Fields> {
    if (!patch || typeof patch !== 'object') throw new BadRequestException('Dữ liệu không hợp lệ.');
    const out: Partial<Fields> = {};
    for (const k of EDIT_KEYS) {
      if (typeof patch[k] === 'string' || typeof patch[k] === 'number') out[k] = String(patch[k]).trim().slice(0, 2000);
    }
    return out;
  }

  private async apply(pet: PetImg, patch: Partial<Fields>): Promise<PetImg> {
    const dbF = petToFields(pet);
    const sheetF = canonFromRaw({ ...dbF, ...patch } as Fields);
    const changed = new Set((Object.keys(patch) as EditKey[]).filter((k) => sheetF[k] !== dbF[k]));
    if (!changed.size) return pet;
    const updated = await this.prisma.pet.update({
      where: { id: pet.id },
      data: buildPetData(sheetF, changed, pet) as Prisma.PetUncheckedUpdateInput,
      include: INCLUDE,
    });
    await this.redis.del(`pet:detail:${pet.id}`);
    return updated;
  }

  private async owned(shelterId: string, petId: string): Promise<PetImg> {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId }, include: INCLUDE });
    if (!pet) throw new NotFoundException('Không tìm thấy pet.');
    if (pet.shelterId !== shelterId) throw new ForbiddenException('Bạn không có quyền với pet này.');
    return pet;
  }

  async list(shelterId: string, sp: SheetSpecies) {
    const [all, apps] = await Promise.all([
      this.prisma.pet.findMany({ where: { shelterId }, include: INCLUDE, orderBy: { createdAt: 'asc' } }),
      this.activeApps(shelterId),
    ]);
    const counts = { DOG: 0, CAT: 0 };
    const rows: ReturnType<PetGridService['toRow']>[] = [];
    for (const p of all) {
      const s = speciesOfPet(p.species);
      if (s) counts[s]++;
      if (s === sp) rows.push(this.toRow(p, apps));
    }
    return { columns: this.columns(sp, rows.map((r) => r.f)), rows, counts };
  }

  async batch(shelterId: string, items: any) {
    if (!Array.isArray(items) || !items.length || items.length > 500) {
      throw new BadRequestException('Danh sách thay đổi không hợp lệ (tối đa 500 dòng).');
    }
    const ids = [...new Set(items.map((i) => String(i?.id ?? '')).filter(Boolean))];
    const pets = await this.prisma.pet.findMany({ where: { id: { in: ids }, shelterId }, include: INCLUDE });
    if (pets.length !== ids.length) throw new ForbiddenException('Có pet không thuộc trạm của bạn hoặc đã bị xoá.');
    const byId = new Map<string, PetImg>(pets.map((p) => [p.id, p]));
    const apps = await this.activeApps(shelterId);
    const rows: ReturnType<PetGridService['toRow']>[] = [];
    for (const it of items) {
      const id = String(it.id);
      const updated = await this.apply(byId.get(id)!, this.clean(it.patch));
      byId.set(id, updated);
      rows.push(this.toRow(updated, apps));
    }
    return { rows };
  }

  async create(shelterId: string, species: string, fields?: any) {
    if (species !== 'DOG' && species !== 'CAT') throw new BadRequestException('Loài không hợp lệ.');
    const blank = Object.fromEntries(EDIT_KEYS.map((k) => [k, ''])) as Fields;
    const f = canonFromRaw({ ...blank, ...(fields ? this.clean(fields) : {}) } as Fields);
    const pet = await this.prisma.pet.create({
      data: {
        ...buildPetData(f, new Set(EDIT_KEYS)),
        name: f.name || f.id || 'Chưa đặt tên',
        species: SPECIES_JSON[species],
        shelterId,
      } as Prisma.PetUncheckedCreateInput,
      include: INCLUDE,
    });
    return this.toRow(pet, new Map());
  }

  async remove(shelterId: string, petId: string) {
    await this.owned(shelterId, petId);
    const active = await this.prisma.adoptionApplication.count({
      where: { petId, status: { notIn: [ApplicationStatus.CLOSED, ApplicationStatus.ADOPTION_COMPLETED] } },
    });
    if (active > 0) {
      throw new BadRequestException(`Pet đang có ${active} đơn nhận nuôi đang xử lý. Hãy đóng các đơn trước khi xoá.`);
    }
    try {
      await this.prisma.$transaction([
        this.prisma.tag.updateMany({ where: { petId }, data: { status: 'INACTIVE', petId: null, linkedAt: null } }),
        this.prisma.pet.delete({ where: { id: petId } }),
      ]);
    } catch (e: any) {
      if (e?.code === 'P2003') throw new BadRequestException('Pet còn dữ liệu liên quan nên chưa thể xoá.');
      throw e;
    }
    await this.redis.del(`pet:detail:${petId}`);
    return { success: true };
  }
}