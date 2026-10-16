import { BadRequestException } from '@nestjs/common';
import { Pet } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import {
    cellText, columnsFor, detectSpecies, EDIT_KEYS, Fields, GENDER_OPTIONS, mapHeader, petToFields, SheetSpecies,
    SPAY_OPTIONS, speciesOfPet, STATUS_OPTIONS, VACC_OPTIONS,
} from './pet-sheet.mapper';

const TAB: Record<SheetSpecies, string> = { DOG: 'TT chó lụm', CAT: 'TT mèo' };
const LISTING = ['Đã đăng', 'Thiếu ảnh', 'Không đủ đk tìm chủ', 'Ưu tiên foster', 'chưa chủ điều kiện nhận nuôi', 'Lỗi'];

// Công thức Google xuất ra dạng IFERROR(__xludf.DUMMYFUNCTION(...), <giá trị cache>)
function cached(formula: string): string | number | null {
    const m = formula.match(/,\s*(?:"((?:[^"]|"")*)"|(-?\d+(?:\.\d+)?))\)\s*$/);
    if (!m) return null;
    if (m[1] !== undefined) return m[1].replace(/""/g, '"');
    return m[2] !== undefined ? Number(m[2]) : null;
}

function plain(v: any): string {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v !== 'object') return String(v);
    if ('error' in v) return '';
    if ('formula' in v || 'sharedFormula' in v) {
        let r = v.result;
        if (r === undefined || r === null) r = cached(String(v.formula ?? ''));
        return r === null || r === undefined ? '' : plain(r);
    }
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('');
    if (typeof v.text === 'string') return v.text;
    return '';
}

/** Đọc các tab Chó/Mèo (tab khác như Sync bị bỏ qua) → danh sách Fields theo header. */
export async function readWorkbook(buf: Buffer): Promise<{ sp: SheetSpecies; rows: Fields[] }[]> {
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(buf as any); } catch { throw new BadRequestException('Không đọc được file. Hãy dùng file .xlsx hợp lệ.'); }
    const out: { sp: SheetSpecies; rows: Fields[] }[] = [];
    wb.eachSheet((ws) => {
        const sp = detectSpecies(ws.name);
        if (!sp || out.some((o) => o.sp === sp)) return;
        const hdr: string[] = [];
        ws.getRow(1).eachCell({ includeEmpty: true }, (c, n) => { hdr[n - 1] = plain(c.value); });
        const col = mapHeader(sp, hdr);
        if (col.id === undefined) return;
        const rows: Fields[] = [];
        ws.eachRow({ includeEmpty: false }, (row, rn) => {
            if (rn === 1) return;
            const f = {} as Fields;
            for (const k of EDIT_KEYS) {
                if (col[k] === undefined) { f[k] = ''; continue; }
                const cell = row.getCell(col[k]! + 1);
                const h = k === 'photo' ? (cell.value as any)?.hyperlink ?? (cell as any).hyperlink : undefined;
                f[k] = typeof h === 'string' && h ? h : cellText(plain(cell.value));
            }
            if (f.id) rows.push(f);
        });
        out.push({ sp, rows });
    });
    if (!out.length) throw new BadRequestException('Không tìm thấy tab "chó"/"mèo" có cột ID. Hãy kiểm tra tên tab và dòng tiêu đề.');
    return out;
}

/** Dựng file Excel đúng bố cục file gốc (2 tab, cùng thứ tự cột, dropdown, STT bằng công thức). */
export async function buildWorkbook(pets: Pet[] = []): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    for (const sp of ['DOG', 'CAT'] as SheetSpecies[]) {
        const ws = wb.addWorksheet(TAB[sp], { views: [{ state: 'frozen', ySplit: 1 }] });
        const defs = [{ key: 'stt', header: 'STT', width: 6 }, ...columnsFor(sp).filter((c) => c.create && c.key !== 'apps')];
        ws.columns = defs.map((d) => ({ header: d.header, key: d.key, width: d.width }));
        ws.getRow(1).font = { bold: true };
        const list = pets.filter((p) => speciesOfPet(p.species) === sp).sort((a, b) => +a.createdAt - +b.createdAt);
        list.forEach((p, i) => {
            const f: any = petToFields(p);
            ws.addRow(defs.map((d) => {
                if (d.key === 'stt') return { formula: `IF(B${i + 2}<>"",ROW(B${i + 2})-1,"")`, result: i + 1 };
                const v = f[d.key];
                return d.key === 'photo' && /^https?:/.test(v) ? { text: v, hyperlink: v } : v;
            }));
        });
        const lists: Record<string, string[]> = {
            gender: GENDER_OPTIONS, spay: SPAY_OPTIONS, vacc: VACC_OPTIONS.slice(0, 3), status: STATUS_OPTIONS, listing: LISTING,
        };
        const last = list.length + 300;
        defs.forEach((d, i) => {
            const l = lists[d.key];
            if (!l) return;
            for (let r = 2; r <= last; r++) {
                ws.getCell(r, i + 1).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: [`"${l.join(',')}"`] };
            }
        });
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}