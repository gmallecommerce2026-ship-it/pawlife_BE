/**
 * Seed QR thẻ vật lý: đọc ID thật từ NỘI DUNG mã QR trong ảnh,
 * chuẩn hoá về dạng PL-00001, rồi mới dọn DB / thêm tag / upload R2.
 *
 * Cách chạy:
 *   npx ts-node src/database/seed-qr.ts --dry-run   # chỉ quét + báo cáo, KHÔNG đụng DB/R2
 *   npx ts-node src/database/seed-qr.ts             # quét -> dọn tag trống -> thêm tag -> upload R2
 *
 * Cờ tuỳ chọn:
 *   --force          upload lại toàn bộ ảnh lên R2
 *   --allow-partial  vẫn chạy dù có ảnh không đọc được / ID trùng
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import jsQR from 'jsqr';

// jimp v0.x export default, jimp v1.x export { Jimp } -> hỗ trợ cả hai
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jimpModule: any = require('jimp');
const Jimp: any = jimpModule.Jimp ?? jimpModule.default ?? jimpModule;

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_UPLOAD = process.argv.includes('--force');
const ALLOW_PARTIAL = process.argv.includes('--allow-partial');

const BUCKET_NAME = process.env.R2_BUCKET ?? 'pawcare';
const R2_PREFIX = 'qr-codes/';
const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const REPORT_FILE = path.join(process.cwd(), 'qr-scan-report.json');

const EXPECTED_TOTAL = 10000; // dải PL-00001 ... PL-10000
const SCAN_CONCURRENCY = 8;
const UPLOAD_CONCURRENCY = 20;
const DELETE_BATCH = 500;
const MAX_BAD_RATIO = 0.05; // quá 5% ảnh lỗi thì dừng, không xoá gì

// ---------------------------------------------------------------------------
// S3 / R2 (tạo lười để --dry-run không cần biến môi trường R2)
// ---------------------------------------------------------------------------
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name} (khai báo trong file .env)`);
  return value;
}

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: 'auto',
      endpoint: requireEnv('R2_ENDPOINT'),
      forcePathStyle: true,
      maxAttempts: 5,
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      },
    });
  }
  return _s3;
}

// ---------------------------------------------------------------------------
// NHỊ PHÂN HOÁ ẢNH: các file PNG nguồn có viền module bị anti-alias (pixel xám
// mờ giữa đen/trắng), khiến thuật toán tự threshold trong jsQR bị nhiễu và
// không tìm được finder pattern. Ép cứng về đen/trắng tuyệt đối trước khi đưa
// vào jsQR giúp đọc ổn định (đã xác nhận bằng test thực tế trên nhiều file).
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// CHUẨN HOÁ ID: mọi biến thể PL-1, PL_00001, https://.../PL-00001?x=1 -> PL-00001
// Chuỗi không khớp (PLT-0014, QR_27, ...) trả về null để báo cáo, không nhận bừa.
// ---------------------------------------------------------------------------
function normalizeTagId(raw: string): string | null {
  const m = raw.match(/PL[-_\s]?(\d{1,5})(?!\d)/i);
  if (!m) return null;
  return `PL-${m[1].padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// BƯỚC 0: QUÉT ẢNH
// ---------------------------------------------------------------------------
type ScanResult =
  | { ok: true; id: string; raw: string }
  | { ok: false; reason: 'no-qr' | 'unrecognized' | 'error'; raw?: string; error?: string };

async function scanFile(fileName: string): Promise<ScanResult> {
  try {
    const image = await Jimp.read(path.join(QR_DIR, fileName));
    const { data, width, height } = image.bitmap;
    const cleaned = binarize(data);
    const qr = jsQR(cleaned, width, height, {
      inversionAttempts: 'attemptBoth',
    });
    if (!qr) return { ok: false, reason: 'no-qr' };

    const raw = qr.data.trim();
    const id = normalizeTagId(raw);
    if (!id) return { ok: false, reason: 'unrecognized', raw };
    return { ok: true, id, raw };
  } catch (e: any) {
    return { ok: false, reason: 'error', error: e?.message ?? String(e) };
  }
}

type ScanSummary = {
  fileToId: Map<string, string>;
  idToFiles: Map<string, string[]>;
  noQr: string[];
  unrecognized: { file: string; raw: string }[];
  errors: { file: string; error: string }[];
  samples: { file: string; raw: string; id: string }[];
};

async function scanAll(files: string[]): Promise<ScanSummary> {
  const s: ScanSummary = {
    fileToId: new Map(),
    idToFiles: new Map(),
    noQr: [],
    unrecognized: [],
    errors: [],
    samples: [],
  };
  let cursor = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (cursor < files.length) {
      const file = files[cursor++];
      const r = await scanFile(file);

      if (r.ok) {
        s.fileToId.set(file, r.id);
        const list = s.idToFiles.get(r.id) ?? [];
        list.push(file);
        s.idToFiles.set(r.id, list);
        if (s.samples.length < 5) s.samples.push({ file, raw: r.raw, id: r.id });
      } else if (r.reason === 'no-qr') {
        s.noQr.push(file);
      } else if (r.reason === 'unrecognized') {
        s.unrecognized.push({ file, raw: r.raw ?? '' });
      } else {
        s.errors.push({ file, error: r.error ?? '' });
        if (s.errors.length === 1) {
          console.error(`⚠️ Lỗi đọc ảnh đầu tiên (${file}): ${r.error}`);
        }
      }
      if (++done % 500 === 0) console.log(`🔄 Đã quét: ${done}/${files.length} ảnh...`);
    }
  }

  await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, worker));
  return s;
}

function buildReport(files: string[], s: ScanSummary) {
  const duplicates = [...s.idToFiles.entries()].filter(([, f]) => f.length > 1);

  const missing: string[] = [];
  for (let n = 1; n <= EXPECTED_TOTAL; n++) {
    const id = `PL-${String(n).padStart(5, '0')}`;
    if (!s.idToFiles.has(id)) missing.push(id);
  }

  const outOfRange = [...s.idToFiles.keys()].filter((id) => {
    const n = parseInt(id.slice(3), 10);
    return n < 1 || n > EXPECTED_TOTAL;
  });

  const bad = s.noQr.length + s.unrecognized.length + s.errors.length;
  const problem =
    bad > files.length * MAX_BAD_RATIO || duplicates.length > 0 || s.fileToId.size === 0;

  console.log('\n================ BÁO CÁO QUÉT QR ================');
  console.log(`Tổng file ảnh:            ${files.length}`);
  console.log(`Đọc & nhận diện OK:       ${s.fileToId.size}`);
  console.log(`ID duy nhất:              ${s.idToFiles.size}`);
  console.log(`Không thấy mã QR:         ${s.noQr.length}`);
  console.log(`QR đọc được nhưng lạ ID:  ${s.unrecognized.length}`);
  console.log(`Lỗi khi đọc ảnh:          ${s.errors.length}`);
  console.log(`ID bị trùng (nhiều file): ${duplicates.length}`);
  console.log(`ID ngoài dải 1..${EXPECTED_TOTAL}:     ${outOfRange.length}`);
  console.log(`ID thiếu trong dải:       ${missing.length}`);
  console.log('\n5 mẫu đầu (file -> chuỗi QR thô -> ID chuẩn hoá):');
  s.samples.forEach((x) => console.log(`  ${x.file}  ->  "${x.raw}"  ->  ${x.id}`));
  if (s.unrecognized.length) {
    console.log('\nVí dụ chuỗi QR không nhận diện được:');
    s.unrecognized.slice(0, 5).forEach((x) => console.log(`  ${x.file}  ->  "${x.raw}"`));
  }
  if (duplicates.length) {
    console.log('\nVí dụ ID bị trùng:');
    duplicates.slice(0, 5).forEach(([id, f]) => console.log(`  ${id}  <-  ${f.join(', ')}`));
  }
  if (missing.length) console.log(`\nVí dụ ID thiếu: ${missing.slice(0, 10).join(', ')}`);
  console.log('=================================================\n');

  fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(
      {
        total: files.length,
        ok: s.fileToId.size,
        uniqueIds: s.idToFiles.size,
        noQr: s.noQr,
        unrecognized: s.unrecognized,
        errors: s.errors,
        duplicates: Object.fromEntries(duplicates),
        outOfRange,
        missing,
      },
      null,
      2,
    ),
  );
  console.log(`📝 Báo cáo chi tiết: ${REPORT_FILE}`);

  return { problem };
}

// ---------------------------------------------------------------------------
// BƯỚC 1: DỌN TAG TRỐNG (chỉ chạy SAU KHI quét thành công)
// ---------------------------------------------------------------------------
type DeleteStats = { deleted: number; kept: string[] };

async function deleteBatch(ids: string[], stats: DeleteStats): Promise<void> {
  if (ids.length === 0) return;
  try {
    const result = await prisma.tag.deleteMany({ where: { id: { in: ids } } });
    stats.deleted += result.count;
  } catch (e: any) {
    if (e?.code !== 'P2003') throw e;
    if (ids.length === 1) {
      stats.kept.push(ids[0]);
      return;
    }
    const mid = Math.ceil(ids.length / 2);
    await deleteBatch(ids.slice(0, mid), stats);
    await deleteBatch(ids.slice(mid), stats);
  }
}

async function cleanOldTags(): Promise<void> {
  const candidates = await prisma.tag.findMany({
    where: { petId: null },
    select: { id: true },
  });
  console.log(`🔎 Tìm thấy ${candidates.length} tag đang trống trong hệ thống...`);

  const stats: DeleteStats = { deleted: 0, kept: [] };
  const ids = candidates.map((t) => t.id);
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    await deleteBatch(ids.slice(i, i + DELETE_BATCH), stats);
  }

  const activeTagsCount = await prisma.tag.count({ where: { petId: { not: null } } });
  console.log(`🗑️ Đã xóa ${stats.deleted} tag trống (${stats.kept.length} tag bị giữ do ràng buộc khoá ngoại).`);
  console.log(`🛡️ Đang bảo vệ ${activeTagsCount} tag đã gắn với thú cưng.`);
}

// ---------------------------------------------------------------------------
// BƯỚC 2: THÊM TAG MỚI
// ---------------------------------------------------------------------------
async function addNewTags(ids: string[]): Promise<void> {
  let created = 0;
  for (let i = 0; i < ids.length; i += 1000) {
    const result = await prisma.tag.createMany({
      data: ids.slice(i, i + 1000).map((id) => ({ id, status: 'INACTIVE' as const })),
      skipDuplicates: true,
    });
    created += result.count;
  }
  console.log(`✅ DB: Đã thêm mới ${created} thẻ, bỏ qua ${ids.length - created} thẻ đã tồn tại.`);
}

// ---------------------------------------------------------------------------
// BƯỚC 3: UPLOAD LÊN R2 (key = qr-codes/PL-00001.png)
// ---------------------------------------------------------------------------
async function listR2Keys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const res = await getS3().send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: R2_PREFIX,
        ContinuationToken: token,
      }),
    );
    res.Contents?.forEach((o) => {
      if (o.Key) keys.add(o.Key);
    });
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function uploadMissing(files: string[], fileToId: Map<string, string>): Promise<number> {
  const existing = FORCE_UPLOAD ? new Set<string>() : await listR2Keys();
  const todo = files.filter((f) => {
    const id = fileToId.get(f);
    return id && !existing.has(`${R2_PREFIX}${id}.png`);
  });
  console.log(`☁️ R2: Đã có ${files.length - todo.length} ảnh, cần upload thêm ${todo.length} ảnh.`);

  let cursor = 0;
  let done = 0;
  const failed: string[] = [];

  async function worker(): Promise<void> {
    while (cursor < todo.length) {
      const fileName = todo[cursor++];
      const id = fileToId.get(fileName);
      if (!id) continue;
      try {
        await getS3().send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `${R2_PREFIX}${id}.png`,
            Body: fs.readFileSync(path.join(QR_DIR, fileName)),
            ContentType: 'image/png',
          }),
        );
      } catch (e: any) {
        if (failed.length < 3) console.error(`⚠️ Lỗi upload ${fileName} (thành ${id}):`, e.message);
        failed.push(fileName);
      }
      if (++done % 500 === 0) console.log(`⏳ Đang upload... ${done}/${todo.length}`);
    }
  }
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));

  console.log(`☁️ Upload xong: ${todo.length - failed.length}/${todo.length} thành công, ${failed.length} lỗi.`);
  return failed.length;
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`🚀 Bắt đầu seed QR thẻ vật lý${DRY_RUN ? ' (DRY-RUN: không đụng DB/R2)' : ''}...`);

  if (!fs.existsSync(QR_DIR)) {
    console.error(`❌ Thư mục không tồn tại: ${QR_DIR}`);
    process.exitCode = 1;
    return;
  }
  const files = fs.readdirSync(QR_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  if (files.length === 0) {
    console.error(`❌ Không tìm thấy file PNG nào trong ${QR_DIR}`);
    process.exitCode = 1;
    return;
  }
  console.log(`📦 Tìm thấy ${files.length} file PNG. Đang quét mã QR, có thể mất vài phút...`);

  // 1) QUÉT TRƯỚC -- chưa đụng gì vào DB
  const scan = await scanAll(files);
  const { problem } = buildReport(files, scan);

  if (DRY_RUN) {
    console.log('🧪 Dry-run xong. Kiểm tra báo cáo, nếu ổn thì chạy lại không có --dry-run.');
    return;
  }
  if (problem && !ALLOW_PARTIAL) {
    console.error('⛔ Kết quả quét có vấn đề (nhiều ảnh lỗi hoặc ID trùng). DỪNG, chưa xoá/thêm gì trong DB.');
    console.error('   Xem báo cáo ở trên, sửa nguyên nhân hoặc chạy lại với --allow-partial nếu chấp nhận.');
    process.exitCode = 1;
    return;
  }

  const validFiles = files.filter((f) => scan.fileToId.has(f));
  const validIds = Array.from(scan.idToFiles.keys());

  // 2) Quét OK mới dọn + thêm + upload
  try {
    await cleanOldTags();
  } catch (e: any) {
    console.error('❌ Lỗi khi dọn tag cũ, bỏ qua và tiếp tục:', e.message);
  }
  await addNewTags(validIds);
  const failedUpload = await uploadMissing(validFiles, scan.fileToId);

  console.log(`📊 Tổng số thẻ trong Database: ${await prisma.tag.count()}`);
  if (failedUpload === 0 && !problem) {
    console.log('🎉 QUY TRÌNH HOÀN TẤT THÀNH CÔNG!');
  } else {
    console.log(`⚠️ Xong nhưng có ${failedUpload} ảnh upload lỗi hoặc còn ảnh không đọc được (xem ${REPORT_FILE}).`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });