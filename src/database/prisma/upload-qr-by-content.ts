// src/database/prisma/upload-qr-by-content.ts
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const FROM = Number(arg('from') ?? 801);
const DRY = process.argv.includes('--dry-run');
const BUCKET = process.env.R2_BUCKET ?? 'pawcare';
const PREFIX = 'qr-codes/';
const DIR = path.join(process.cwd(), 'src/database/QR_Codes');

// Giống hệt cách app tính tagId sau khi quét
function extractId(data: string) {
  let s = data.replace(/[\u2012\u2013\u2014\u2015\u2212]/g, '-').trim();
  if (s.startsWith('http') || s.includes('pawlife://')) {
    s = (s.split('?')[0].split('/').filter(Boolean).pop() || '').replace(/\.(png|svg|jpg)$/i, '');
  }
  return s.replace(/[^a-zA-Z0-9-_]/g, '').toUpperCase();
}

function decode(file: string): string | null {
  const png = PNG.sync.read(fs.readFileSync(path.join(DIR, file)));
  const d = png.data;
  for (let i = 0; i < d.length; i += 4) { // nền trong suốt -> nền trắng
    const a = d[i + 3] / 255;
    for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * a + 255 * (1 - a);
    d[i + 3] = 255;
  }
  return jsQR(new Uint8ClampedArray(d), png.width, png.height)?.data ?? null;
}

async function main() {
  const byId = new Map<string, string[]>();
  const unreadable: string[] = [];
  const odd: { file: string; raw: string }[] = [];

  for (const f of fs.readdirSync(DIR).filter((f) => /\.png$/i.test(f))) {
    const raw = decode(f);
    if (!raw) { unreadable.push(f); continue; }
    const id = extractId(raw);
    if (!/^PL-\d{5}$/.test(id)) { odd.push({ file: f, raw }); continue; }
    const n = Number(id.slice(3));
    if (n < FROM || n > 10000) continue; // bảo vệ dải dưới 800
    byId.set(id, [...(byId.get(id) ?? []), f]);
  }

  const conflicts = [...byId].filter(([, l]) => l.length > 1);
  const renamed = [...byId].filter(([id, l]) => l.length === 1 && l[0].toLowerCase() !== `${id}.png`.toLowerCase());

  console.log(`ID hợp lệ từ ${FROM}: ${byId.size} | file bị đặt sai tên: ${renamed.length}`);
  console.log(`Trùng ID: ${conflicts.length} | định dạng lạ: ${odd.length} | không đọc được: ${unreadable.length}`);
  console.log('Ví dụ sai tên:', renamed.slice(0, 5).map(([id, l]) => `${l[0]} -> ${id}`));
  if (DRY) return;
  if (conflicts.length || odd.length) {
    console.error('⛔ Có ID trùng hoặc định dạng lạ, DỪNG. Chạy --dry-run để xem rồi gửi lại cho mình.');
    return;
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const todo = [...byId];
  let i = 0, ok = 0, fail = 0;
  await Promise.all(Array.from({ length: 20 }, async () => {
    while (i < todo.length) {
      const [id, [file]] = todo[i++];
      try {
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: `${PREFIX}${id}.png`,
          Body: fs.readFileSync(path.join(DIR, file)),
          ContentType: 'image/png',
          CacheControl: 'no-cache',
        }));
        ok++;
      } catch (e: any) {
        if (++fail <= 3) console.error(`Lỗi ${id}:`, e.message);
      }
    }
  }));
  console.log(`Upload xong: ${ok} OK, ${fail} lỗi.`);
}
main();