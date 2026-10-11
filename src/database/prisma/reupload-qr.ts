// src/database/prisma/reupload-qr.ts
import 'dotenv/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const FROM = Number(arg('from') ?? 801);
const TO = Number(arg('to') ?? 10000);
const DRY = process.argv.includes('--dry-run');

const BUCKET = process.env.R2_BUCKET ?? 'pawcare';
const PREFIX = 'qr-codes/';
const DIR = path.join(process.cwd(), 'src/database/QR_Codes');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function listEtags() {
  const map = new Map<string, string>();
  let token: string | undefined;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token }));
    r.Contents?.forEach((o) => o.Key && map.set(o.Key, (o.ETag ?? '').replace(/"/g, '')));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return map;
}

async function main() {
  console.log(`Bucket: ${BUCKET} | dải PL-${FROM}..PL-${TO} ${DRY ? '(DRY-RUN)' : ''}`);
  const remote = await listEtags();
  const todo: { id: string; file: string; reason: 'missing' | 'stale' }[] = [];
  let same = 0;

  for (let n = FROM; n <= TO; n++) {
    const id = `PL-${String(n).padStart(5, '0')}`;
    const file = path.join(DIR, `${id}.png`);
    if (!fs.existsSync(file)) continue;
    const etag = remote.get(`${PREFIX}${id}.png`);
    const md5 = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
    if (!etag) todo.push({ id, file, reason: 'missing' });
    else if (etag !== md5) todo.push({ id, file, reason: 'stale' });
    else same++;
  }

  const stale = todo.filter((t) => t.reason === 'stale');
  const missing = todo.filter((t) => t.reason === 'missing');
  console.log(`Giống local: ${same} | khác nội dung (stale): ${stale.length} | thiếu: ${missing.length}`);
  console.log('Ví dụ stale:', stale.slice(0, 5).map((t) => t.id).join(', ') || '-');
  console.log('Ví dụ thiếu:', missing.slice(0, 5).map((t) => t.id).join(', ') || '-');
  if (DRY || todo.length === 0) return;

  let i = 0, ok = 0, fail = 0;
  await Promise.all(
    Array.from({ length: 20 }, async () => {
      while (i < todo.length) {
        const t = todo[i++];
        try {
          await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: `${PREFIX}${t.id}.png`,
            Body: fs.readFileSync(t.file),
            ContentType: 'image/png',
            CacheControl: 'no-cache',
          }));
          ok++;
        } catch (e: any) {
          if (++fail <= 3) console.error(`Lỗi ${t.id}:`, e.message);
        }
      }
    }),
  );
  console.log(`Upload xong: ${ok} OK, ${fail} lỗi.`);
}
main();