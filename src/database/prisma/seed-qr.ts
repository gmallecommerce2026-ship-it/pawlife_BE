/**
 * Seed QR thẻ vật lý THEO TÊN FILE: PL-00001.png -> tag id "PL-00001".
 * Không quét nội dung mã QR nữa (bỏ jsQR/jimp).
 *
 * Cách chạy:
 *   npx ts-node src/database/seed-qr.ts --dry-run   # chỉ báo cáo, KHÔNG ghi/xoá gì
 *   npx ts-node src/database/seed-qr.ts             # xoá tag thừa -> thêm tag -> upload R2
 *
 * Cờ tuỳ chọn:
 *   --force          upload lại toàn bộ ảnh lên R2
 *   --clean-r2       xoá luôn ảnh thừa trên R2 (key không nằm trong danh sách PL-xxxxx.png)
 *   --allow-partial  vẫn chạy dù thiếu nhiều ảnh / có file sai tên
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_UPLOAD = process.argv.includes('--force');
const CLEAN_R2 = process.argv.includes('--clean-r2');
const ALLOW_PARTIAL = process.argv.includes('--allow-partial');

const BUCKET_NAME = process.env.R2_BUCKET ?? 'pawcare';
const R2_PREFIX = 'qr-codes/';
const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const REPORT_FILE = path.join(process.cwd(), 'qr-scan-report.json');

const EXPECTED_TOTAL = 10000; // dải PL-00001 ... PL-10000
const UPLOAD_CONCURRENCY = 20;
const DELETE_BATCH = 500;
const MAX_MISSING_RATIO = 0.05; // thiếu quá 5% thì dừng, không xoá gì (tránh trỏ nhầm thư mục)

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
// BƯỚC 0: ĐỌC DANH SÁCH TỪ TÊN FILE (đúng định dạng PL-00001.png)
// ---------------------------------------------------------------------------
const FILE_NAME_RE = /^PL-(\d{5})\.png$/i;

type LocalScan = {
  idToFile: Map<string, string>; // "PL-00001" -> "PL-00001.png"
  badNames: string[]; // file .png nhưng tên không đúng dạng PL-xxxxx.png
  duplicates: Record<string, string[]>;
  missing: string[];
  outOfRange: string[];
};

function scanLocalFiles(files: string[]): LocalScan {
  const idToFiles = new Map<string, string[]>();
  const badNames: string[] = [];

  for (const f of files) {
    const m = f.match(FILE_NAME_RE);
    if (!m) {
      badNames.push(f);
      continue;
    }
    const id = `PL-${m[1]}`;
    const list = idToFiles.get(id) ?? [];
    list.push(f);
    idToFiles.set(id, list);
  }

  const idToFile = new Map<string, string>();
  const duplicates: Record<string, string[]> = {};
  for (const [id, list] of idToFiles) {
    idToFile.set(id, list[0]);
    if (list.length > 1) duplicates[id] = list;
  }

  const missing: string[] = [];
  for (let n = 1; n <= EXPECTED_TOTAL; n++) {
    const id = `PL-${String(n).padStart(5, '0')}`;
    if (!idToFile.has(id)) missing.push(id);
  }

  const outOfRange = [...idToFile.keys()].filter((id) => {
    const n = parseInt(id.slice(3), 10);
    return n < 1 || n > EXPECTED_TOTAL;
  });

  return { idToFile, badNames, duplicates, missing, outOfRange };
}

// ---------------------------------------------------------------------------
// BƯỚC 1: XOÁ TAG THỪA TRONG DB
// Chỉ xoá tag: (1) chưa gắn thú cưng (petId = null) và (2) id KHÔNG nằm trong
// danh sách PL-xxxxx lấy từ tên file. Tag đã gắn thú cưng luôn được giữ.
// ---------------------------------------------------------------------------
type DeleteStats = { deleted: number; kept: string[] };

async function deleteBatch(ids: string[], stats: DeleteStats): Promise<void> {
  if (ids.length === 0) return;
  try {
    const result = await prisma.tag.deleteMany({ where: { id: { in: ids } } });
    stats.deleted += result.count;
  } catch (e: any) {
    if (e?.code !== 'P2003') throw e;
    // Vướng khoá ngoại: chia đôi lô để tìm đúng tag bị ràng buộc
    if (ids.length === 1) {
      stats.kept.push(ids[0]);
      return;
    }
    const mid = Math.ceil(ids.length / 2);
    await deleteBatch(ids.slice(0, mid), stats);
    await deleteBatch(ids.slice(mid), stats);
  }
}

async function findOrphanTagIds(validIds: Set<string>): Promise<string[]> {
  const empty = await prisma.tag.findMany({
    where: { petId: null },
    select: { id: true },
  });
  return empty.map((t) => t.id).filter((id) => !validIds.has(id));
}

async function cleanOrphanTags(validIds: Set<string>): Promise<void> {
  const orphans = await findOrphanTagIds(validIds);
  console.log(`🔎 Tìm thấy ${orphans.length} tag thừa (trống, không có trong danh sách file)...`);

  const stats: DeleteStats = { deleted: 0, kept: [] };
  for (let i = 0; i < orphans.length; i += DELETE_BATCH) {
    await deleteBatch(orphans.slice(i, i + DELETE_BATCH), stats);
    if ((i / DELETE_BATCH) % 10 === 0 && i > 0) console.log(`🗑️ Đã xoá ${stats.deleted}/${orphans.length}...`);
  }

  const activeTagsCount = await prisma.tag.count({ where: { petId: { not: null } } });
  console.log(`🗑️ Đã xoá ${stats.deleted} tag thừa (${stats.kept.length} tag bị giữ do ràng buộc khoá ngoại).`);
  console.log(`🛡️ Đang bảo vệ ${activeTagsCount} tag đã gắn với thú cưng.`);
}

// ---------------------------------------------------------------------------
// BƯỚC 2: THÊM TAG MỚI (bỏ qua tag đã có)
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
// BƯỚC 3: R2 (key = qr-codes/PL-00001.png)
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

async function cleanOrphanR2(existing: Set<string>, validIds: Set<string>): Promise<void> {
  const validKeys = new Set([...validIds].map((id) => `${R2_PREFIX}${id}.png`));
  const orphans = [...existing].filter((k) => !validKeys.has(k));
  console.log(`🔎 R2: Tìm thấy ${orphans.length} ảnh thừa.`);

  let deleted = 0;
  for (let i = 0; i < orphans.length; i += 1000) {
    const batch = orphans.slice(i, i + 1000);
    const res = await getS3().send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    deleted += batch.length - (res.Errors?.length ?? 0);
    if (res.Errors?.length) console.error(`⚠️ R2: ${res.Errors.length} ảnh xoá lỗi trong lô ${i / 1000 + 1}`);
  }
  console.log(`🗑️ R2: Đã xoá ${deleted} ảnh thừa.`);
  orphans.forEach((k) => existing.delete(k));
}

async function uploadMissing(existing: Set<string>, idToFile: Map<string, string>): Promise<number> {
  const have = FORCE_UPLOAD ? new Set<string>() : existing;
  const todo = [...idToFile.entries()].filter(([id]) => !have.has(`${R2_PREFIX}${id}.png`));
  console.log(`☁️ R2: Đã có ${idToFile.size - todo.length} ảnh, cần upload thêm ${todo.length} ảnh.`);

  let cursor = 0;
  let done = 0;
  const failed: string[] = [];

  async function worker(): Promise<void> {
    while (cursor < todo.length) {
      const [id, fileName] = todo[cursor++];
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
        if (failed.length < 3) console.error(`⚠️ Lỗi upload ${fileName}:`, e.message);
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
  console.log(`🚀 Bắt đầu seed QR thẻ vật lý theo tên file${DRY_RUN ? ' (DRY-RUN: không ghi/xoá gì)' : ''}...`);

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

  const scan = scanLocalFiles(files);
  const validIds = new Set(scan.idToFile.keys());
  const dupCount = Object.keys(scan.duplicates).length;

  console.log('\n================ BÁO CÁO THEO TÊN FILE ================');
  console.log(`Tổng file .png:                ${files.length}`);
  console.log(`Tên đúng dạng PL-xxxxx.png:    ${validIds.size}`);
  console.log(`Tên sai định dạng (bị bỏ qua): ${scan.badNames.length}`);
  console.log(`ID trùng (nhiều file):         ${dupCount}`);
  console.log(`ID ngoài dải 1..${EXPECTED_TOTAL}:        ${scan.outOfRange.length}`);
  console.log(`ID thiếu trong dải:            ${scan.missing.length}`);
  if (scan.badNames.length) console.log(`  Ví dụ tên sai: ${scan.badNames.slice(0, 5).join(', ')}`);
  if (scan.missing.length) console.log(`  Ví dụ ID thiếu: ${scan.missing.slice(0, 10).join(', ')}`);
  console.log('=======================================================\n');

  fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(
      {
        total: files.length,
        valid: validIds.size,
        badNames: scan.badNames,
        duplicates: scan.duplicates,
        outOfRange: scan.outOfRange,
        missing: scan.missing,
      },
      null,
      2,
    ),
  );
  console.log(`📝 Báo cáo chi tiết: ${REPORT_FILE}`);

  if (DRY_RUN) {
    // Chỉ ĐỌC DB để xem sẽ xoá bao nhiêu, không ghi gì
    try {
      const orphans = await findOrphanTagIds(validIds);
      const active = await prisma.tag.count({ where: { petId: { not: null } } });
      const total = await prisma.tag.count();
      console.log(`🧪 DB hiện có ${total} tag, trong đó ${active} tag đã gắn thú cưng (được giữ).`);
      console.log(`🧪 Sẽ xoá ${orphans.length} tag thừa. Ví dụ: ${orphans.slice(0, 5).join(', ') || '(không có)'}`);
    } catch (e: any) {
      console.log(`🧪 Không đọc được DB để xem trước: ${e.message}`);
    }
    console.log('🧪 Dry-run xong. Nếu ổn thì chạy lại không có --dry-run.');
    return;
  }

  // Chốt an toàn: lệnh xoá dựa trên danh sách file, nên danh sách phải đáng tin
  const tooMissing = scan.missing.length > EXPECTED_TOTAL * MAX_MISSING_RATIO;
  const problem = tooMissing || scan.badNames.length > 0 || dupCount > 0 || validIds.size === 0;
  if (problem && !ALLOW_PARTIAL) {
    console.error('⛔ Danh sách file có vấn đề (thiếu nhiều ID / tên sai / trùng). DỪNG, chưa xoá/thêm gì.');
    console.error('   Sửa nguyên nhân hoặc chạy lại với --allow-partial nếu chấp nhận.');
    process.exitCode = 1;
    return;
  }

  // 1) Xoá tag thừa trong DB
  try {
    await cleanOrphanTags(validIds);
  } catch (e: any) {
    console.error('❌ Lỗi khi xoá tag thừa, bỏ qua và tiếp tục:', e.message);
  }

  // 2) Thêm tag mới
  await addNewTags([...validIds]);

  // 3) R2: xoá ảnh thừa (nếu có --clean-r2) rồi upload ảnh còn thiếu
  let failedUpload = 0;
  const existing = FORCE_UPLOAD && !CLEAN_R2 ? new Set<string>() : await listR2Keys();
  if (CLEAN_R2) await cleanOrphanR2(existing, validIds);
  failedUpload = await uploadMissing(existing, scan.idToFile);

  console.log(`📊 Tổng số thẻ trong Database: ${await prisma.tag.count()}`);
  if (failedUpload === 0 && !problem) {
    console.log('🎉 QUY TRÌNH HOÀN TẤT THÀNH CÔNG!');
  } else {
    console.log(`⚠️ Xong nhưng có ${failedUpload} ảnh upload lỗi hoặc danh sách file chưa sạch (xem ${REPORT_FILE}).`);
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