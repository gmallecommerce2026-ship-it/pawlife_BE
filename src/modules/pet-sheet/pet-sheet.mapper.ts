import { Pet, PetGender, PetStatus, Prisma, VaccinationStatus } from '@prisma/client';
import { createHash } from 'crypto';

export type SheetSpecies = 'DOG' | 'CAT';
export const SPECIES_JSON: Record<SheetSpecies, { vi: string; en: string }> = {
    DOG: { vi: 'Chó', en: 'Dog' },
    CAT: { vi: 'Mèo', en: 'Cat' },
};

export type EditKey =
    | 'id' | 'name' | 'breed' | 'color' | 'age' | 'gender' | 'spay' | 'vacc'
    | 'status' | 'area' | 'listing' | 'desc' | 'extra' | 'photo';
export type FieldKey = EditKey | 'key' | 'apps';
export type Fields = Record<EditKey, string>;
export type ColMap = Partial<Record<FieldKey, number>>;

export const EDIT_KEYS: EditKey[] = [
    'id', 'name', 'breed', 'color', 'age', 'gender', 'spay', 'vacc', 'status', 'area', 'listing', 'desc', 'extra', 'photo',
];

export const norm = (s: unknown): string =>
    String(s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/\s+/g, ' ')
        .trim();

export function detectSpecies(tab: string): SheetSpecies | null {
    const n = ` ${norm(tab).replace(/[^a-z0-9]+/g, ' ')} `;
    if (/ (cho|dog|dogs) /.test(n)) return 'DOG';
    if (/ (meo|cat|cats) /.test(n)) return 'CAT';
    return null;
}

export function speciesOfPet(species: unknown): SheetSpecies | null {
    const en = norm((species as any)?.en ?? species);
    const vi = norm((species as any)?.vi ?? '');
    if (en.includes('dog') || vi.includes('cho')) return 'DOG';
    if (en.includes('cat') || vi.includes('meo')) return 'CAT';
    return null;
}

export function colLetter(i: number): string {
    let s = '';
    let n = i + 1;
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

// ───────────── Định nghĩa cột ─────────────
export interface ColDef { key: FieldKey; header: string; aliases: string[]; create: boolean; width: number }

export function columnsFor(sp: SheetSpecies): ColDef[] {
    const dog = sp === 'DOG';
    return [
        { key: 'id', header: 'ID', aliases: ['id', 'ma so', 'chip', 'microchip', 'so chip'], create: true, width: 21 },
        { key: 'name', header: 'Tên', aliases: ['ten', 'ten pet', 'name'], create: true, width: 20 },
        { key: 'photo', header: 'Ảnh', aliases: ['anh', 'hinh anh'], create: true, width: 24 },
        { key: 'breed', header: 'Giống', aliases: ['giong', 'breed'], create: true, width: 22 },
        { key: 'color', header: 'Màu lông', aliases: ['mau long', 'mau', 'color'], create: true, width: 17 },
        { key: 'age', header: 'Độ tuổi', aliases: ['do tuoi', 'tuoi', 'age'], create: true, width: 12 },
        { key: 'gender', header: 'Giới tính', aliases: ['gioi tinh', 'gender'], create: true, width: 12 },
        { key: 'spay', header: 'Triệt sản', aliases: ['triet san', 'spayed'], create: true, width: 16 },
        { key: 'vacc', header: 'Tiêm phòng', aliases: ['tiem phong', 'vaccine', 'vaccination'], create: true, width: 20 },
        { key: 'listing', header: 'Trạng thái trên web', aliases: ['trang thai tren web'], create: dog, width: 23 },
        { key: 'desc', header: dog ? 'Ghi chú' : 'Lưu ý', aliases: dog ? ['ghi chu'] : ['luu y'], create: true, width: 42 },
        { key: 'status', header: 'Tình trạng', aliases: ['tinh trang', 'status'], create: true, width: 20 },
        { key: 'area', header: 'Khu', aliases: ['khu', 'khu vuc', 'area'], create: true, width: 18 },
        { key: 'extra', header: dog ? 'Ghi chú thêm' : 'Ghi chú', aliases: dog ? ['ghi chu them'] : ['ghi chu'], create: true, width: 20 },
        { key: 'apps', header: 'Đơn nhận nuôi', aliases: ['don nhan nuoi'], create: true, width: 22 },
    ];
}

export function mapHeader(sp: SheetSpecies, header: string[]): ColMap {
    const map: ColMap = {};
    const defs = columnsFor(sp);
    header.forEach((h, i) => {
        const n = norm(h);
        if (!n) return;
        const d = defs.find((x) => map[x.key] === undefined && x.aliases.includes(n));
        if (d) map[d.key] = i;
    });
    return map;
}

// ───────────── Giá trị ô ↔ dữ liệu ─────────────
const ERR = /^#(REF|N\/A|VALUE|NAME|ERROR|DIV\/0|NUM|NULL)/i;
export const cellText = (v: unknown): string => {
    const s = String(v ?? '').trim();
    return ERR.test(s) ? '' : s;
};

export const STATUS_LABEL: Record<PetStatus, string> = {
    AVAILABLE: 'Sẵn sàng nhận nuôi',
    PENDING: 'Chờ nhận nuôi',
    FOSTERING: 'Foster',
    REJECTED: 'Từ chối',
    HEALTH_ISSUE: 'Vấn đề sức khỏe',
    ADOPTED: 'Đã được nhận nuôi',
};
export const STATUS_OPTIONS = Object.values(STATUS_LABEL);
const STATUS_BY_LABEL = new Map<string, PetStatus>(
    Object.entries(STATUS_LABEL).map(([k, v]) => [norm(v), k as PetStatus]),
);

export function parseStatus(s: string): PetStatus {
    const n = norm(s);
    if (!n) return 'AVAILABLE';
    const hit = STATUS_BY_LABEL.get(n);
    if (hit) return hit;
    if (n.includes('foster')) return 'FOSTERING';
    if (n.includes('da duoc') || n.includes('da nhan') || n.includes('adopted')) return 'ADOPTED';
    if (n.includes('suc khoe')) return 'HEALTH_ISSUE';
    if (n.includes('tu choi')) return 'REJECTED';
    if (n.includes('cho nhan')) return 'PENDING';
    return 'AVAILABLE';
}

export const APP_LABEL: Record<string, string> = {
    SUBMITTED: 'Mới nộp',
    PENDING: 'Đang xét',
    NEED_MORE_INFO: 'Cần bổ sung',
    INTERVIEW_SCHEDULED: 'Hẹn phỏng vấn',
    APPROVED: 'Đã duyệt',
};

export const GENDER_OPTIONS = ['Đực', 'Cái'];
export const SPAY_OPTIONS = ['Đã triệt sản', 'Chưa triệt sản'];
export const VACC_OPTIONS = ['Đã tiêm đủ', 'Chưa tiêm đủ', 'Chưa tiêm', 'Tiêm 1 bệnh, 1 dại', 'Tiêm 5 bệnh, 1 dại'];

export function parseGender(s: string): PetGender | null {
    const n = norm(s);
    if (n === 'duc' || n === 'male' || n === 'nam') return 'MALE';
    if (n === 'cai' || n === 'female' || n === 'nu') return 'FEMALE';
    return null;
}
export const formatGender = (g: PetGender | null | undefined) => (g === 'MALE' ? 'Đực' : g === 'FEMALE' ? 'Cái' : '');

export function parseSpay(s: string): boolean {
    const n = norm(s);
    if (!n || n.includes('chua') || n.includes('khong')) return false;
    return n.includes('da') || n === 'co' || n === 'yes' || n === 'true';
}
export const formatSpay = (b: boolean) => (b ? 'Đã triệt sản' : 'Chưa triệt sản');

export function parseVacc(s: string): VaccinationStatus {
    const n = norm(s);
    if (!n) return 'NOT_VACCINATED';
    if (n.includes('chua tiem du')) return 'IN_PROGRESS';
    if (n.includes('chua tiem')) return 'NOT_VACCINATED';
    if (n.includes('da tiem du')) return 'VACCINATED';
    return 'IN_PROGRESS';
}
export const formatVacc = (v: VaccinationStatus) =>
    v === 'VACCINATED' ? 'Đã tiêm đủ' : v === 'IN_PROGRESS' ? 'Chưa tiêm đủ' : 'Chưa tiêm';

export function parseAgeToDob(text: string, now = new Date()): Date | null {
    const n = norm(text);
    if (!n) return null;
    let months = 0;
    let hit = false;
    const y = n.match(/(\d+(?:[.,]\d+)?)\s*(?:nam|tuoi|yrs|yr|years|year|y)\b/);
    const m = n.match(/(\d+)\s*(?:thang|th|months|month|m)\b/);
    if (y) { months += Math.round(parseFloat(y[1].replace(',', '.')) * 12); hit = true; }
    if (m) { months += parseInt(m[1], 10); hit = true; }
    if (!hit && /^\d+(?:[.,]\d+)?$/.test(n)) { months = Math.round(parseFloat(n.replace(',', '.')) * 12); hit = true; }
    if (!hit) return null;
    const d = new Date(now);
    d.setMonth(d.getMonth() - months);
    return d;
}

export function ageFromDob(dob: Date | null): string {
    if (!dob) return '';
    const now = new Date();
    let months = (now.getFullYear() - dob.getFullYear()) * 12 + now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) months--;
    if (months >= 12) return `${Math.floor(months / 12)} tuổi`;
    if (months > 0) return `${months} tháng`;
    return '';
}

export const biText = (v: any): string =>
    !v ? '' : typeof v === 'string' ? v.trim() : String(v.vi ?? v.en ?? '').trim();
const bi = (s: string) => (s ? { vi: s, en: s } : Prisma.DbNull);

// ───────────── Chuẩn hoá 2 phía để so sánh ─────────────
export function canonFromRaw(raw: Fields): Fields {
    return {
        ...raw,
        vacc: raw.vacc || 'Chưa tiêm',
        gender: formatGender(parseGender(raw.gender)),
        spay: formatSpay(parseSpay(raw.spay)),
        status: STATUS_LABEL[parseStatus(raw.status)],
    };
}

export function petToFields(p: Pet): Fields {
    const vacc =
        p.vaccinationNote !== null && parseVacc(p.vaccinationNote) === p.vaccinationStatus
            ? p.vaccinationNote
            : formatVacc(p.vaccinationStatus);
    return {
        id: (p.shelterInternalId ?? p.microchipNumber ?? '').trim(),
        name: (p.name ?? '').trim(),
        breed: biText(p.breed),
        color: biText(p.color),
        age: (p.ageText ?? ageFromDob(p.dob)).trim(),
        gender: formatGender(p.gender),
        spay: formatSpay(p.isSpayedNeutered),
        vacc: vacc.trim(),
        status: STATUS_LABEL[p.status],
        area: (p.area ?? '').trim(),
        listing: (p.listingNote ?? '').trim(),
        desc: biText(p.description),
        extra: (p.extraNote ?? '').trim(),
        photo: (p.photoNote ?? '').trim(),
    };
}

export const hashFields = (f: Fields, keys: EditKey[]): string =>
    createHash('sha1').update(JSON.stringify(keys.map((k) => f[k]))).digest('hex').slice(0, 20);

// Chỉ ghi những field thật sự đổi (keys) để không đè breed.en / description.en do app mobile tạo
export function buildPetData(f: Fields, keys: Set<EditKey>, existing?: Pet): Record<string, any> {
    const d: Record<string, any> = {};
    const has = (k: EditKey) => keys.has(k);
    if (has('id')) {
        if (f.id && (!existing || !existing.name || existing.name === existing.shelterInternalId)) d.name = f.id;
        d.shelterInternalId = f.id || null;
        if (/^\d{15}$/.test(f.id)) d.microchipNumber = f.id;
        else if (!f.id) d.microchipNumber = null;
    }
    if (has('name') && f.name) d.name = f.name;
    if (has('breed')) d.breed = bi(f.breed);
    if (has('color')) d.color = bi(f.color);
    if (has('desc')) d.description = bi(f.desc);
    if (has('age')) {
        d.ageText = f.age || null;
        const dob = parseAgeToDob(f.age);
        if (dob) d.dob = dob;
    }
    if (has('gender')) d.gender = parseGender(f.gender);
    if (has('spay')) d.isSpayedNeutered = parseSpay(f.spay);
    if (has('vacc')) {
        const vs = parseVacc(f.vacc);
        d.vaccinationStatus = vs;
        d.isVaccinated = vs === 'VACCINATED';
        d.vaccinationNote = f.vacc;
    }
    if (has('status')) {
        const st = parseStatus(f.status);
        d.status = st;
        if (st === 'ADOPTED' && !existing?.adoptedAt) d.adoptedAt = new Date();
    }
    if (has('area')) d.area = f.area || null;
    if (has('listing')) d.listingNote = f.listing || null;
    if (has('extra')) d.extraNote = f.extra || null;
    if (has('photo')) d.photoNote = f.photo || null;
    return d;
}

// Dropdown cho Google Sheet
export function validationRequests(sheetId: number, col: ColMap, rows: number) {
    const lists: Partial<Record<FieldKey, string[]>> = {
        gender: GENDER_OPTIONS, spay: SPAY_OPTIONS, vacc: VACC_OPTIONS, status: STATUS_OPTIONS,
    };
    return (Object.keys(lists) as FieldKey[])
        .filter((k) => col[k] !== undefined)
        .map((k) => ({
            setDataValidation: {
                range: { sheetId, startRowIndex: 1, endRowIndex: rows, startColumnIndex: col[k]!, endColumnIndex: col[k]! + 1 },
                rule: {
                    condition: { type: 'ONE_OF_LIST', values: lists[k]!.map((v) => ({ userEnteredValue: v })) },
                    showCustomUi: true,
                    strict: false,
                },
            },
        }));
}