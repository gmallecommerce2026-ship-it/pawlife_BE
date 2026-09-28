/**
 * Seed QR code CHUẨN XÁC BẰNG CÁCH ĐỌC NỘI DUNG MÃ QR
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// 🆕 Thêm thư viện đọc QR
import Jimp from 'jimp';
import jsQR from 'jsqr';

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
// 🆕 BƯỚC MỚI: HÀM ĐỌC MÃ QR TỪ FILE ẢNH
// ---------------------------------------------------------------------------
async function extractIdFromImage(fileName: string): Promise<string | null> {
  try {
    const filePath = path.join(QR_DIR, fileName);
    const image = await Jimp.read(filePath);
    
    // jsQR cần mảng Uint8ClampedArray
    const qrData = jsQR(
      new Uint8ClampedArray(image.bitmap.data),
      image.bitmap.width,
      image.bitmap.height
    );

    if (!qrData) return null; // Không nhận diện được mã QR

    // Lấy nội dung chuỗi trong QR (VD: "PL-00001" hoặc "https://paw.com/PL-00001")
    const rawValue = qrData.data.trim();
    
    // Nếu QR của bạn chứa link, hãy cắt lấy ID cuối cùng. 
    // Nếu QR chỉ chứa đúng ID thì dòng này vẫn hoạt động tốt.
    const tagId = rawValue.split('/').pop()?.trim().toUpperCase();
    
    return tagId || null;
  } catch (error) {
    return null;
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
      skipDuplicates: true,
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

// 🆕 Nhận thêm map (Tên file -> ID chuẩn)
async function uploadMissing(files: string[], fileToIdMap: Map<string, string>): Promise<number> {
  const existing = FORCE_UPLOAD ? new Set<string>() : await listR2Keys();
  
  // 🆕 Lọc danh sách file cần upload dựa trên ID thật sự
  const todo = files.filter((f) => {
    const realId = fileToIdMap.get(f);
    return realId && !existing.has(`${R2_PREFIX}${realId}.png`);
  });
  
  console.log(`☁️ R2: Cloud đã có ${files.length - todo.length} ảnh, cần upload thêm ${todo.length} ảnh.`);

  let cursor = 0;
  let done = 0;
  const failed: string[] = [];

  async function worker(): Promise<void> {
    while (cursor < todo.length) {
      const fileName = todo[cursor++];
      const realId = fileToIdMap.get(fileName); // 🆕 Lấy ID thật sự
      if (!realId) continue;

      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `${R2_PREFIX}${realId}.png`, // 🆕 Lưu trên R2 với tên ID thật
            Body: fs.readFileSync(path.join(QR_DIR, fileName)), // 🆕 Đọc từ file vật lý sai tên
            ContentType: 'image/png',
          }),
        );
      } catch (e: any) {
        if (failed.length < 3) console.error(`⚠️ Lỗi upload ${fileName} (thành ${realId}):`, e.message);
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
  console.log(`📦 Tìm thấy ${files.length} file thẻ QR (.png) trong thư mục.`);

  // -------------------------------------------------------------------------
  // 🆕 QUÉT 10.000 ẢNH ĐỂ LẤY ID THẬT SỰ (Có giới hạn luồng để tránh tràn RAM)
  // -------------------------------------------------------------------------
  console.log('🔍 Đang tiến hành quét hình ảnh để trích xuất QR Code, quá trình này có thể mất vài phút...');
  const fileToIdMap = new Map<string, string>();
  let scanCursor = 0;
  let scanDone = 0;
  let scanFailed = 0;

  async function scanWorker() {
    while (scanCursor < files.length) {
      const fileName = files[scanCursor++];
      const id = await extractIdFromImage(fileName);
      if (id) {
        fileToIdMap.set(fileName, id);
      } else {
        scanFailed++;
        // console.error(`⚠️ Lỗi: Không thể đọc mã QR từ file ${fileName}`);
      }
      if (++scanDone % 500 === 0) console.log(`🔄 Đã quét: ${scanDone}/${files.length} ảnh...`);
    }
  }

  // Chạy 10 luồng song song để quét ảnh
  await Promise.all(Array.from({ length: 10 }, scanWorker));
  
  console.log(`✅ Quét xong: Nhận diện thành công ${fileToIdMap.size} ảnh, thất bại ${scanFailed} ảnh.`);

  // Loại bỏ các file không scan được ra khỏi danh sách tiếp tục xử lý
  const validFiles = files.filter(f => fileToIdMap.has(f));
  const validIds = Array.from(new Set(fileToIdMap.values()));

  // -------------------------------------------------------------------------
  // Tiếp tục quy trình với danh sách ID thật sự
  // -------------------------------------------------------------------------
  await addNewTags(validIds);
  const failedCount = await uploadMissing(validFiles, fileToIdMap); // 🆕 Truyền map vào

  console.log(`📊 Tổng số thẻ vật lý khai báo trong Database: ${await prisma.tag.count()}`);
  if (failedCount === 0 && scanFailed === 0) {
    console.log('🎉 QUY TRÌNH HOÀN TẤT THÀNH CÔNG!');
  } else {
    console.log(`⚠️ Xong nhưng có ${failedCount} ảnh upload lỗi và ${scanFailed} ảnh không đọc được mã QR.`);
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