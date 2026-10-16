import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  columnsFor, detectSpecies, GENDER_OPTIONS, SheetSpecies, SPAY_OPTIONS, STATUS_OPTIONS, VACC_OPTIONS,
} from './pet-sheet.mapper';

// Công thức Google xuất ra dạng IFERROR(__xludf.DUMMYFUNCTION(...), <giá trị cache>)
function cachedFromFormula(formula: string): string | number | null {
  const m = formula.match(/,\s*(?:"((?:[^"]|"")*)"|(-?\d+(?:\.\d+)?))\)\s*$/);
  if (!m) return null;
  if (m[1] !== undefined) return m[1].replace(/""/g, '"');
  return m[2] !== undefined ? Number(m[2]) : null;
}

/** Bỏ các tab không phải Chó/Mèo (vd: Sync chứa CCCD, SĐT) và đổi công thức thành giá trị. */
export async function sanitizeWorkbook(buf: Buffer): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as any);
  } catch {
    throw new BadRequestException('Không đọc được file. Vui lòng dùng file .xlsx hợp lệ.');
  }
  const drop: number[] = [];
  wb.eachSheet((ws) => {
    if (!detectSpecies(ws.name)) { drop.push(ws.id); return; }
    ws.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v: any = cell.value;
        if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
          let r = v.result;
          if (r === undefined || r === null) r = cachedFromFormula(String(v.formula ?? ''));
          cell.value = r && typeof r === 'object' && !(r instanceof Date) ? null : (r ?? null);
        }
      }),
    );
  });
  if (drop.length >= wb.worksheets.length) {
    throw new BadRequestException('Không tìm thấy tab nào có tên chứa "Chó" hoặc "Mèo". Hãy đổi tên tab rồi tải lại.');
  }
  drop.forEach((id) => wb.removeWorksheet(id));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const guide = wb.addWorksheet('Hướng dẫn');
  guide.columns = [{ width: 26 }, { width: 100 }];
  [
    ['PawLife — File mẫu hồ sơ pet', ''],
    ['', ''],
    ['Tab Chó / Mèo', 'Mỗi dòng là một pet. Tab nào có tên chứa "Chó" hoặc "Mèo" đều được đồng bộ; tab khác bị bỏ qua.'],
    ['ID', 'Mã nội bộ của trạm (số chip 15 số hoặc mã tuỳ ý). Có thể trùng, không bắt buộc.'],
    ['Tên', 'Tên pet. Nếu để trống, hệ thống dùng ID làm tên.'],
    ['Độ tuổi', 'Ví dụ: 3 tuổi, 5 tháng, 1 năm 2 tháng.'],
    ['Giới tính / Triệt sản / Tiêm phòng / Tình trạng', 'Chọn trong danh sách thả xuống.'],
    ['Khu, Ghi chú...', 'Nhập tự do.'],
    ['Đơn nhận nuôi', 'Chỉ đọc — hệ thống tự điền từ các đơn đang xử lý. Không cần sửa.'],
    ['Mã hệ thống', 'Để trống khi thêm pet mới. Hệ thống tự điền; không xoá hay sửa cột này.'],
    ['', ''],
    ['Ví dụ 1 dòng', 'ID: 900263003834569 | Tên: Bông | Giống: poodle | Màu lông: trắng | Độ tuổi: 3 tuổi | Giới tính: Cái | Triệt sản: Đã triệt sản | Tiêm phòng: Đã tiêm đủ | Tình trạng: Sẵn sàng nhận nuôi | Khu: Quốc Oai'],
  ].forEach((r) => guide.addRow(r));
  guide.getRow(1).font = { bold: true, size: 14 };

  for (const sp of ['DOG', 'CAT'] as SheetSpecies[]) {
    const ws = wb.addWorksheet(sp === 'DOG' ? 'Chó' : 'Mèo');
    const cols = columnsFor(sp).filter((c) => c.create);
    ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4EA' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const lists: Record<string, string[]> = {
      gender: GENDER_OPTIONS,
      spay: SPAY_OPTIONS,
      vacc: VACC_OPTIONS.slice(0, 3), // list literal của Excel không chứa được dấu phẩy
      status: STATUS_OPTIONS,
    };
    cols.forEach((c, i) => {
      const list = lists[c.key];
      if (!list) return;
      for (let r = 2; r <= 1000; r++) {
        ws.getCell(r, i + 1).dataValidation = {
          type: 'list', allowBlank: true, showErrorMessage: false, formulae: [`"${list.join(',')}"`],
        };
      }
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}