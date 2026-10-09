/**
 * Cập nhật ảnh QR của TOÀN BỘ tag theo tên file PL-xxxxx.png
 * - Upload sang key có phiên bản: qr-codes/v{N}/PL-xxxxx.png  (không dính cache)
 * - Đồng thời ghi lại key cũ qr-codes/PL-xxxxx.png kèm no-cache (cho link cũ)
 * - Kiểm tra lại bằng HeadObject (so kích thước)
 * - (Tuỳ chọn) purge cache Cloudflare theo URL cho key cũ
 * - KHÔNG xoá, KHÔNG sửa gì trong DB
 *
 * Chạy:
 *   npx ts-node src/database/update-qr-images.ts --dry-run
 *   npx ts-node src/database/update-qr-images.ts --version=2
 *   npx ts-node src/database/update-qr-images.ts --version=2 --no-legacy   # bỏ qua key cũ
 *
 * .env tuỳ chọn để purge cache:
 *   PUBLIC_BASE_URL=https://cdn.ten-mien.com   CF_ZONE_ID=...   CF_API_TOKEN=...
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const DRY_RUN = process.argv.includes('--dry-run');
const NO_LEGACY = process.argv.includes('--no-legacy');
const VERSION = process.argv.find((a) => a.startsWith('--version='))?.split('=')[1] ?? '2';

const BUCKET = process.env.R2_BUCKET ?? 'pawcare';
const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const LEGACY_PREFIX = 'qr-codes/';
const VERSION_PREFIX = `qr-codes/v${VERSION}/`;
const CONCURRENCY = 20;
const FILE_RE = /^PL-(\d{5})\.png$/i;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu biến môi trường ${name}`);
  return v;
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: requireEnv('R2_ENDPOINT'),
  forcePathStyle: true,
  maxAttempts: 5,
  credentials: {
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  },
});

async function putAndVerify(key: string, body: Buffer, cacheControl: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: 'image/png',
      CacheControl: cacheControl,
    }),
  );
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  if (head.ContentLength !== body.length) {
    throw new Error(`Kích thước không khớp (${head.ContentLength} != ${body.length})`);
  }
}

async function purgeCloudflare(urls: string[]): Promise<void> {
  const base = process.env.PUBLIC_BASE_URL;
  const zone = process.env.CF_ZONE_ID;
  const token = process.env.CF_API_TOKEN;
  if (!base || !zone || !token) {
    console.log('ℹ️ Bỏ qua purge cache (chưa khai báo PUBLIC_BASE_URL / CF_ZONE_ID / CF_API_TOKEN).');
    return;
  }
  let ok = 0;
  for (let i = 0; i < urls.length; i += 30) {
    const files = urls.slice(i, i + 30).map((k) => `${base.replace(/\/$/, '')}/${k}`);
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    if (res.ok) ok += files.length;
    else console.error(`⚠️ Purge lỗi lô ${i / 30 + 1}: ${res.status} ${await res.text()}`);
  }
  console.log(`🧹 Đã purge cache ${ok}/${urls.length} URL.`);
}

async function main() {
  console.log(`🚀 Cập nhật ảnh QR -> ${VERSION_PREFIX}${NO_LEGACY ? '' : ' (+ ghi lại key cũ)'}${DRY_RUN ? ' [DRY-RUN]' : ''}`);

  if (!fs.existsSync(QR_DIR)) throw new Error(`Thư mục không tồn tại: ${QR_DIR}`);
  const files = fs.readdirSync(QR_DIR).filter((f) => FILE_RE.test(f));
  const bad = fs.readdirSync(QR_DIR).filter((f) => f.toLowerCase().endsWith('.png') && !FILE_RE.test(f));
  console.log(`📁 ${files.length} file hợp lệ, ${bad.length} file sai tên (bỏ qua).`);
  if (files.length === 0) throw new Error('Không có file hợp lệ.');

  if (DRY_RUN) {
    console.log(`🧪 Ví dụ key mới: ${VERSION_PREFIX}${files[0]}`);
    console.log('🧪 Dry-run xong, chưa upload gì.');
    return;
  }

  const failed: { file: string; error: string }[] = [];
  const legacyKeys: string[] = [];
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor++];
      const id = file.slice(0, 8).toUpperCase(); // PL-00001
      try {
        const body = fs.readFileSync(path.join(QR_DIR, file));
        await putAndVerify(`${VERSION_PREFIX}${id}.png`, body, 'public, max-age=31536000, immutable');
        if (!NO_LEGACY) {
          await putAndVerify(`${LEGACY_PREFIX}${id}.png`, body, 'no-cache');
          legacyKeys.push(`${LEGACY_PREFIX}${id}.png`);
        }
      } catch (e: any) {
        failed.push({ file, error: e.message });
      }
      if (++done % 200 === 0) console.log(`⏳ ${done}/${files.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`☁️ Xong: ${files.length - failed.length}/${files.length} thành công, ${failed.length} lỗi.`);
  if (failed.length) {
    fs.writeFileSync('qr-update-failed.json', JSON.stringify(failed, null, 2));
    console.log('⚠️ Danh sách lỗi: qr-update-failed.json (chạy lại script để thử lại, an toàn vì idempotent).');
    process.exitCode = 1;
  }

  if (legacyKeys.length) await purgeCloudflare(legacyKeys);

  console.log(`👉 URL ảnh mới: <PUBLIC_BASE_URL>/${VERSION_PREFIX}PL-00001.png`);
}

main().catch((e) => {
  console.error('❌ Lỗi nghiêm trọng:', e);
  process.exit(1);
});