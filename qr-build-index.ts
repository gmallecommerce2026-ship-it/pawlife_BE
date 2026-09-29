/**
 * Quét toàn bộ ảnh QR trong thư mục, decode ra ID thật, lưu thành file chỉ mục
 * (qr-index.json) để tra cứu nhanh sau này mà không cần quét lại từ đầu.
 *
 * Chạy 1 lần (hoặc mỗi khi thêm ảnh mới):
 *   npx ts-node qr-build-index.ts
 *
 * Tuỳ chỉnh số luồng song song (mặc định 8):
 *   SCAN_CONCURRENCY=16 npx ts-node qr-build-index.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import jsQR from 'jsqr';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jimpModule: any = require('jimp');
const Jimp: any = jimpModule.Jimp ?? jimpModule.default ?? jimpModule;

const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const INDEX_FILE = path.join(process.cwd(), 'qr-index.json');
const CONCURRENCY = Number(process.env.SCAN_CONCURRENCY) || 8;

function normalizeTagId(raw: string): string | null {
  const m = raw.match(/PL[-_\s]?(\d{1,5})(?!\d)/i);
  if (!m) return null;
  return `PL-${m[1].padStart(5, '0')}`;
}

// Ép ảnh về đen/trắng tuyệt đối - đã xác nhận cần thiết để jsQR đọc được
// đúng các ảnh QR nguồn (viền module bị anti-alias làm nhiễu threshold gốc).
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

async function decodeFile(filePath: string): Promise<string | null> {
  try {
    const image = await Jimp.read(filePath);
    const { data, width, height } = image.bitmap;
    const cleaned = binarize(data);
    const qr = jsQR(cleaned, width, height, { inversionAttempts: 'attemptBoth' });
    if (!qr) return null;
    return normalizeTagId(qr.data.trim());
  } catch {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(QR_DIR)) {
    console.error(`❌ Không tìm thấy thư mục ${QR_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(QR_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  console.log(`📦 ${files.length} file ảnh. Đang quét (có thể mất vài phút)...`);

  const idToFile: Record<string, string> = {};
  const fileToId: Record<string, string> = {};
  const duplicates: Record<string, string[]> = {};
  const failed: string[] = [];

  let cursor = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (cursor < files.length) {
      const file = files[cursor++];
      const id = await decodeFile(path.join(QR_DIR, file));
      if (id) {
        fileToId[file] = id;
        if (idToFile[id]) {
          duplicates[id] = duplicates[id] ? [...duplicates[id], file] : [idToFile[id], file];
        } else {
          idToFile[id] = file;
        }
      } else {
        failed.push(file);
      }
      if (++done % 1000 === 0) console.log(`🔄 Đã quét: ${done}/${files.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  fs.writeFileSync(
    INDEX_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: files.length,
        matched: Object.keys(fileToId).length,
        failed,
        duplicates,
        idToFile,
        fileToId,
      },
      null,
      2,
    ),
  );

  console.log(`\n✅ Xong. Khớp: ${Object.keys(fileToId).length}/${files.length}.`);
  console.log(`   Lỗi đọc: ${failed.length}. ID bị trùng: ${Object.keys(duplicates).length}.`);
  console.log(`📝 Đã lưu chỉ mục: ${INDEX_FILE}`);
}

main();