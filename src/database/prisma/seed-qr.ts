/**
 * Seed QR code (chế độ "seed thêm")
 *  1. Xóa các tag QR cũ (OLD_PREFIXES) nào xóa được; tag đang được Pet tham chiếu thì giữ lại.
 *  2. Thêm tag mới từ thư mục QR_Codes; tag đã có thì bỏ qua, không đổi status.
 *  3. Chỉ upload lên R2 những file chưa có (thêm --force để upload lại tất cả).
 *
 * Chạy: npx ts-node src/database/prisma/seed-qr.ts [--force]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name} (khai báo trong file .env)`);
  return value;
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: requireEnv('R2_ENDPOINT'), // https://<ACCOUNT_ID>.r2.cloudflarestorage.com (không kèm tên bucket)
  forcePathStyle: true, // gọi <endpoint>/<bucket>/... thay vì <bucket>.<endpoint>
  maxAttempts: 5,
  credentials: {
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  },
});

const BUCKET_NAME = process.env.R2_BUCKET ?? 'pawcare';
const R2_PREFIX = 'qr-codes/';
const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');

// Tiền tố của các mã QR cũ cần dọn
const OLD_PREFIXES = ['PLT_', 'PLT-', 'plt_', 'plt-'];

const CONCURRENCY = 20;
const DELETE_BATCH = 500;
const FORCE_UPLOAD = process.argv.includes('--force');

// ✅ SỬA 1: Cắt đuôi .png thay vì .svg
const toTagId = (fileName: string) => fileName.replace(/\.png$/i, '').trim().toUpperCase();

// ---------------------------------------------------------------------------
// BƯỚC 1: XÓA QR CŨ CÓ THỂ XÓA
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
    where: { OR: OLD_PREFIXES.map((p) => ({ id: { startsWith: p } })) },
    select: { id: true },
  });
  console.log(`🔎 Tìm thấy ${candidates.length} tag cũ (${OLD_PREFIXES.join(', ')}).`);

  const stats: DeleteStats = { deleted: 0, kept: [] };
  const ids = candidates.map((t) => t.id);
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    await deleteBatch(ids.slice(i, i + DELETE_BATCH), stats);
  }

  console.log(`🗑️ Đã xóa ${stats.deleted} tag cũ, giữ lại ${stats.kept.length} tag đang được gán.`);
  if (stats.kept.length > 0) {
    console.log(`   Ví dụ tag giữ lại: ${stats.kept.slice(0, 5).join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// BƯỚC 2: THÊM TAG MỚI VÀO DB (tag đã tồn tại thì bỏ qua)
// ---------------------------------------------------------------------------
async function addNewTags(ids: string[]): Promise<void> {
  let created = 0;
  for (let i = 0; i < ids.length; i += 1000) {
    const result = await prisma.tag.createMany({
      data: ids.slice(i, i + 1000).map((id) => ({ id, status: 'INACTIVE' as const })),
      // ✅ SỬA 2: Đổi thành true để bỏ qua các Tag bị trùng lặp, không văng lỗi P2002 nữa
      skipDuplicates: true,
    });
    created += result.count;
  }
  console.log(`✅ DB: thêm mới ${created} tag, ${ids.length - created} tag đã có sẵn (giữ nguyên).`);
}

// ---------------------------------------------------------------------------
// BƯỚC 3: UPLOAD LÊN R2 (chỉ file chưa có)
// ---------------------------------------------------------------------------
async function listR2Keys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const res = await s3Client.send(
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

async function uploadMissing(files: string[]): Promise<number> {
  const existing = FORCE_UPLOAD ? new Set<string>() : await listR2Keys();
  // ✅ SỬA 3: Kiểm tra theo đuôi .png trên Cloudflare R2
  const todo = files.filter((f) => !existing.has(`${R2_PREFIX}${toTagId(f)}.png`));
  console.log(`☁️ R2: đã có ${files.length - todo.length} file, cần upload ${todo.length} file.`);

  let cursor = 0;
  let done = 0;
  const failed: string[] = [];

  async function worker(): Promise<void> {
    while (cursor < todo.length) {
      const fileName = todo[cursor++];
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            // ✅ SỬA 4: Upload file lên R2 với đuôi .png và ContentType là image/png
            Key: `${R2_PREFIX}${toTagId(fileName)}.png`,
            Body: fs.readFileSync(path.join(QR_DIR, fileName)),
            ContentType: 'image/png',
          }),
        );
      } catch (e: any) {
        if (failed.length < 3) console.error(`⚠️ Lỗi upload ${fileName}:`, e.message);
        failed.push(fileName);
      }
      if (++done % 500 === 0) console.log(`⏳ ${done}/${todo.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`☁️ Upload xong: ${todo.length - failed.length}/${todo.length} thành công, ${failed.length} lỗi.`);
  return failed.length;
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('🚀 Bắt đầu seed thêm QR code...');

  try {
    await cleanOldTags();
  } catch (e: any) {
    console.error('❌ Lỗi khi dọn tag cũ, bỏ qua và tiếp tục:', e.message);
  }

  // ✅ SỬA 5: Lọc đọc file .png thay vì .svg
  const files = fs.readdirSync(QR_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  if (files.length === 0) {
    console.error(`❌ Không có file PNG nào trong ${QR_DIR}`);
    return;
  }
  const ids = Array.from(new Set(files.map(toTagId)));
  console.log(`📦 Tìm thấy ${files.length} file PNG.`);

  await addNewTags(ids);
  const failedCount = await uploadMissing(files);

  console.log(`📊 Tổng số tag trong DB: ${await prisma.tag.count()}`);
  if (failedCount === 0) {
    console.log('🎉 HOÀN TẤT!');
  } else {
    console.log(`⚠️ Xong nhưng ${failedCount} file upload lỗi. Chạy lại script để upload phần còn thiếu.`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng trong quá trình seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });