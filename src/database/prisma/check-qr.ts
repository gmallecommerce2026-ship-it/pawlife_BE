import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.R2_BUCKET ?? 'pawcare';
const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const VERSION = process.argv.find((a) => a.startsWith('--version='))?.split('=')[1] ?? '2';
const BASE = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const md5 = (b: Buffer) => crypto.createHash('md5').update(b).digest('hex');

async function r2(key: string) {
  try {
    const h = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return `etag=${h.ETag?.replace(/"/g, '')} size=${h.ContentLength} modified=${h.LastModified?.toISOString()}`;
  } catch (e: any) {
    return `LỖI: ${e.name}`;
  }
}

async function http(key: string) {
  if (!BASE) return '(chưa có PUBLIC_BASE_URL)';
  try {
    const res = await fetch(`${BASE}/${key}?t=${Date.now()}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return `status=${res.status} md5=${md5(buf)} cf-cache=${res.headers.get('cf-cache-status')} age=${res.headers.get('age')}`;
  } catch (e: any) {
    return `LỖI: ${e.message}`;
  }
}

async function main() {
  console.log(`Bucket: ${BUCKET} | Endpoint: ${process.env.R2_ENDPOINT} | Base: ${BASE}`);
  for (let n = 1; n <= 7; n++) {
    const id = `PL-${String(n).padStart(5, '0')}`;
    const local = path.join(QR_DIR, `${id}.png`);
    const localMd5 = fs.existsSync(local) ? md5(fs.readFileSync(local)) : 'KHÔNG CÓ FILE';
    console.log(`\n=== ${id} ===`);
    console.log(`local   md5=${localMd5}`);
    console.log(`R2 cũ   ${await r2(`qr-codes/${id}.png`)}`);
    console.log(`R2 v${VERSION}   ${await r2(`qr-codes/v${VERSION}/${id}.png`)}`);
    console.log(`HTTP cũ ${await http(`qr-codes/${id}.png`)}`);
    console.log(`HTTP v${VERSION} ${await http(`qr-codes/v${VERSION}/${id}.png`)}`);
  }
}
main();