/**
 * Công cụ tìm QR:
 *
 * 1) Tìm theo ID -> ra file ảnh gốc + trạng thái trong DB:
 *      npx ts-node qr-find.ts --id PL-00006
 *
 * 2) Đưa vào 1 ảnh mẫu (ảnh chụp/tải về) -> app tự decode ra ID,
 *    đối chiếu với file gốc trong kho 10.000 ảnh, và tra DB:
 *      npx ts-node qr-find.ts --image duong/dan/anh_mau.png
 *
 * Cần chạy "npx ts-node qr-build-index.ts" trước ít nhất 1 lần để có qr-index.json.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import jsQR from 'jsqr';
import { PrismaClient } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jimpModule: any = require('jimp');
const Jimp: any = jimpModule.Jimp ?? jimpModule.default ?? jimpModule;

const INDEX_FILE = path.join(process.cwd(), 'qr-index.json');
const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const prisma = new PrismaClient();

function normalizeTagId(raw: string): string | null {
  const m = raw.match(/PL[-_\s]?(\d{1,5})(?!\d)/i);
  if (!m) return null;
  return `PL-${m[1].padStart(5, '0')}`;
}

function binarize(data: Uint8ClampedArray, threshold = 128): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = lum < threshold ? 0 : 255;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  return out;
}

async function decodeImageFile(filePath: string): Promise<{ raw: string; id: string | null } | null> {
  const image = await Jimp.read(filePath);
  const { data, width, height } = image.bitmap;
  const cleaned = binarize(data);
  const qr = jsQR(cleaned, width, height, { inversionAttempts: 'attemptBoth' });
  if (!qr) return null;
  const raw = qr.data.trim();
  return { raw, id: normalizeTagId(raw) };
}

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      out[key] = next && !next.startsWith('--') ? next : 'true';
      if (out[key] !== 'true') i++;
    }
  }
  return out;
}

function loadIndex(): any | null {
  if (!fs.existsSync(INDEX_FILE)) return null;
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
}

async function printDbStatus(id: string): Promise<void> {
  try {
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      console.log(`🗄️  DB: KHÔNG có tag "${id}" trong database.`);
      return;
    }
    console.log(
      `🗄️  DB: id=${tag.id} | status=${tag.status} | petId=${tag.petId ?? 'NULL'} | linkCount=${tag.linkCount}`,
    );
  } catch (e: any) {
    console.log(`⚠️  Không kết nối được DB để tra cứu: ${e.message}`);
  }
}

async function main() {
  const args = parseArgs();

  // --- Chế độ 1: tìm theo ID ---
  if (args.id) {
    const id = normalizeTagId(args.id) ?? args.id.toUpperCase();
    console.log(`🔍 Tìm ID: ${id}`);

    const index = loadIndex();
    if (!index) {
      console.log('⚠️  Chưa có qr-index.json. Chạy "npx ts-node qr-build-index.ts" trước.');
    } else {
      const file = index.idToFile[id];
      console.log(
        file
          ? `📄 File ảnh gốc khớp: src/database/QR_Codes/${file}`
          : '📄 Không tìm thấy file ảnh nào khớp ID này trong chỉ mục 10.000 file.',
      );
    }
    await printDbStatus(id);
    return;
  }

  // --- Chế độ 2: đưa vào 1 ảnh mẫu ---
  if (args.image) {
    const imgPath = path.resolve(args.image);
    if (!fs.existsSync(imgPath)) {
      console.error(`❌ Không tìm thấy file: ${imgPath}`);
      process.exitCode = 1;
      return;
    }

    console.log(`🔍 Đang decode: ${imgPath}`);
    const result = await decodeImageFile(imgPath);
    if (!result) {
      console.log('❌ Không đọc được mã QR trong ảnh này.');
      return;
    }
    console.log(`📷 Nội dung QR thô: "${result.raw}"`);
    if (!result.id) {
      console.log('⚠️  Nội dung không khớp định dạng PL-xxxxx.');
      return;
    }
    console.log(`🏷️  ID chuẩn hoá: ${result.id}`);

    const index = loadIndex();
    if (index) {
      const file = index.idToFile[result.id];
      console.log(
        file
          ? `📄 Trùng khớp với file gốc: src/database/QR_Codes/${file}`
          : '📄 Không có trong chỉ mục 10.000 file gốc (có thể ảnh lạ/ngoài lô, hoặc chưa build index).',
      );
    } else {
      console.log('⚠️  Chưa có qr-index.json, không đối chiếu được với kho ảnh gốc. Chạy "npx ts-node qr-build-index.ts" trước.');
    }

    await printDbStatus(result.id);
    return;
  }

  console.log('Cách dùng:');
  console.log('  npx ts-node qr-find.ts --id PL-00006');
  console.log('  npx ts-node qr-find.ts --image duong/dan/anh_mau.png');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());