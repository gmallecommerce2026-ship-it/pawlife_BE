import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

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

const BUCKET = process.env.R2_BUCKET ?? 'pawcare';
const PREFIX = 'qr-codes/';
const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const MANIFEST = path.join(process.cwd(), 'src/database/qr-manifest.json');
const CONCURRENCY = 20;
const CLEAN = process.argv.includes('--clean'); // xóa mọi key khác chuẩn PL-xxxxx.png

const toId = (raw: string): string | null => {
  const m = raw.trim().toUpperCase().match(/PL[-_]?(\d+)$/);
  return m ? `PL-${m[1].padStart(5, '0')}` : null;
};

async function listKeys(): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token }));
    r.Contents?.forEach((o) => o.Key && keys.push(o.Key));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, string>;

  const idToFile = new Map<string, string>();
  const dup: string[] = [];
  const bad: string[] = [];
  for (const [file, raw] of Object.entries(manifest)) {
    const id = toId(raw);
    if (!id) { bad.push(`${file} -> ${raw}`); continue; }
    if (idToFile.has(id)) { dup.push(`${id}: ${idToFile.get(id)} & ${file}`); continue; }
    idToFile.set(id, file);
  }
  console.log(`📄 ${Object.keys(manifest).length} file -> ${idToFile.size} ID duy nhất | lạ ${bad.length} | trùng ${dup.length}`);
  if (bad.length) console.warn('⚠️ ID lạ:', bad.slice(0, 5));
  if (dup.length) console.warn('⚠️ ID trùng:', dup.slice(0, 5));

  // Ghi đè TOÀN BỘ: PL-00001.png <- ảnh có QR chứa PL-00001
  const ids = [...idToFile.keys()].sort();
  let cursor = 0, done = 0;
  const failed: string[] = [];

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: `${PREFIX}${id}.png`,
          Body: fs.readFileSync(path.join(QR_DIR, idToFile.get(id)!)),
          ContentType: 'image/png',
          CacheControl: 'public, max-age=300',
        }));
      } catch (e: any) {
        if (failed.length < 3) console.error(`⚠️ Lỗi ${id}:`, e.message);
        failed.push(id);
      }
      if (++done % 500 === 0) console.log(`⏳ ${done}/${ids.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`☁️ Ghi đè xong: ${ids.length - failed.length}/${ids.length}, lỗi ${failed.length}`);

  // Dọn key cũ (qr-1.png, qr_1.png, PL_00001.png, ...)
  if (CLEAN && failed.length === 0) {
    const keep = new Set(ids.map((id) => `${PREFIX}${id}.png`));
    const stale = (await listKeys()).filter((k) => !keep.has(k));
    for (let i = 0; i < stale.length; i += 1000) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: stale.slice(i, i + 1000).map((Key) => ({ Key })) },
      }));
    }
    console.log(`🧹 Đã xóa ${stale.length} key cũ`);
  }

  if (failed.length || bad.length || dup.length) process.exitCode = 1;
  else console.log('🎉 HOÀN TẤT');
}

main().catch((e) => { console.error('❌', e); process.exit(1); });