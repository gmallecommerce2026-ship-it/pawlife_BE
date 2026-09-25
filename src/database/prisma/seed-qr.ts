/**
 * Seed QR code CHUẨN XÁC THEO FILE ẢNH VẬT LÝ
 *  1. Xóa sạch toàn bộ Tag QR đang trống trong DB (chưa gắn cho pet).
 *  2. Đọc 10.000 file .png trong thư mục, lấy đúng tên file làm ID (VD: PL-00001).
 *  3. Thêm vào DB (Bỏ qua những Tag đã tồn tại vì nó đang gắn cho Pet rồi).
 *  4. Upload ảnh lên R2.
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
  endpoint: requireEnv('R2_ENDPOINT'), 
  forcePathStyle: true, 
  maxAttempts: 5,
  credentials: {
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  },
});

const BUCKET_NAME = process.env.R2_BUCKET ?? 'pawcare';
const R2_PREFIX = 'qr-codes/';
const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');

const CONCURRENCY = 20;
const DELETE_BATCH = 500;
const FORCE_UPLOAD = process.argv.includes('--force');

// ✅ LẤY CHÍNH XÁC TÊN FILE XƯỞNG GỬI (VD: PL-00001.png -> PL-00001)
const toTagId = (fileName: string) => fileName.replace(/\.png$/i, '').trim().toUpperCase();

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

// ---------------------------------------------------------------------------
// BƯỚC 1: DỌN SẠCH TAG TRỐNG
// ---------------------------------------------------------------------------
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

  const activeTagsCount = await prisma.tag.count({
    where: { petId: { not: null } }
  });

  console.log(`🗑️ Đã xóa sạch ${stats.deleted} tag rác/trống.`);
  console.log(`🛡️ Đã bảo vệ an toàn ${activeTagsCount} tag đang được sử dụng bởi thú cưng.`);
}

// ---------------------------------------------------------------------------
// BƯỚC 2: THÊM TAG MỚI TỪ THƯ MỤC
// ---------------------------------------------------------------------------
async function addNewTags(ids: string[]): Promise<void> {
  let created = 0;
  for (let i = 0; i < ids.length; i += 1000) {
    const result = await prisma.tag.createMany({
      data: ids.slice(i, i + 1000).map((id) => ({ id, status: 'INACTIVE' as const })),
      skipDuplicates: true, // Bỏ qua nếu tag đã tồn tại (đang được pet sử dụng)
    });
    created += result.count;
  }
  console.log(`✅ DB: Đã thêm mới ${created} thẻ từ xưởng, bỏ qua ${ids.length - created} thẻ đang được dùng.`);
}

// ---------------------------------------------------------------------------
// BƯỚC 3: UPLOAD LÊN R2 (Cloudflare)
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
  const todo = files.filter((f) => !existing.has(`${R2_PREFIX}${toTagId(f)}.png`));
  console.log(`☁️ R2: Cloud đã có ${files.length - todo.length} ảnh, cần upload thêm ${todo.length} ảnh.`);

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
            Key: `${R2_PREFIX}${toTagId(fileName)}.png`,
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
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`☁️ Upload xong: ${todo.length - failed.length}/${todo.length} thành công, ${failed.length} lỗi.`);
  return failed.length;
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('🚀 Bắt đầu quy trình Seed QR thẻ vật lý...');

  try {
    await cleanOldTags();
  } catch (e: any) {
    console.error('❌ Lỗi khi dọn tag cũ, bỏ qua và tiếp tục:', e.message);
  }

  const files = fs.readdirSync(QR_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  if (files.length === 0) {
    console.error(`❌ Không tìm thấy file PNG nào trong thư mục ${QR_DIR}`);
    return;
  }
  const ids = Array.from(new Set(files.map(toTagId)));
  console.log(`📦 Tìm thấy ${files.length} file thẻ QR (.png) trong thư mục.`);

  await addNewTags(ids);
  const failedCount = await uploadMissing(files);

  console.log(`📊 Tổng số thẻ vật lý khai báo trong Database: ${await prisma.tag.count()}`);
  if (failedCount === 0) {
    console.log('🎉 QUY TRÌNH HOÀN TẤT THÀNH CÔNG!');
  } else {
    console.log(`⚠️ Xong nhưng có ${failedCount} ảnh chưa lên Cloud. Hãy chạy lại lệnh --force để thử upload nốt.`);
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