/**
 * verify-qr.ts — KIỂM TRA ảnh QR có đúng với ID (tên file) không.
 * CHỈ ĐỌC: không ghi/xoá gì trên DB hay R2.
 *
 * Cài thư viện (1 lần):
 *   npm i -D jsqr pngjs @types/pngjs
 *
 * Chạy (đặt file cạnh seed-qr.ts):
 *   npx ts-node src/database/prisma/verify-qr.ts                       # giải mã QR trong từng PNG, so với tên file
 *   npx ts-node src/database/prisma/verify-qr.ts --r2                  # thêm: so MD5 file local với ảnh đang nằm trên R2
 *   npx ts-node src/database/prisma/verify-qr.ts --from=701 --to=900   # chỉ kiểm một dải
 *   npx ts-node src/database/prisma/verify-qr.ts --dir=D:/QR_Codes     # thư mục khác
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { PNG } from 'pngjs';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsQR = require('jsqr');

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const CHECK_R2 = process.argv.includes('--r2');
const FROM = Number(arg('from') ?? 1);
const TO = Number(arg('to') ?? 10000);
const QR_DIR = arg('dir') ?? path.join(process.cwd(), 'src/database/QR_Codes');
const BUCKET = process.env.R2_BUCKET ?? 'pawcare';
const R2_PREFIX = 'qr-codes/';
const FILE_RE = /^PL-(\d{5})\.png$/i;
const REPORT = path.join(process.cwd(), 'qr-verify-report.json');

const md5 = (buf: Buffer) => createHash('md5').update(buf).digest('hex');

// Chuẩn hoá y hệt app (scan.tsx -> processValidScan) để kết quả so sánh phản ánh đúng thứ app sẽ gửi lên server
function normalizeLikeApp(data: string): string {
  let s = data.replace(/[\u2012\u2013\u2014\u2015\u2212]/g, '-').trim();
  if (s.startsWith('http') || s.includes('pawlife://')) {
    s = (s.split('?')[0].split('/').filter(Boolean).pop() || '').replace(/\.(png|svg|jpg)$/i, '');
  }
  return s.replace(/[^a-zA-Z0-9-_]/g, '').toUpperCase();
}

function decodeQr(buf: Buffer): string | null {
  const png = PNG.sync.read(buf);
  const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, {
    inversionAttempts: 'attemptBoth',
  });
  return res ? res.data : null;
}

function toRanges(nums: number[]): string[] {
  const out: string[] = [];
  let start = nums[0];
  let prev = nums[0];
  for (let i = 1; i <= nums.length; i++) {
    const n = nums[i];
    if (n !== prev + 1) {
      out.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = n;
    }
    prev = n;
  }
  return out;
}

async function listR2(): Promise<Map<string, string>> {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Thiếu R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY trong .env');
  }
  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  const map = new Map<string, string>(); // key -> etag (md5 với ảnh upload 1 phần)
  let token: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: R2_PREFIX, ContinuationToken: token }),
    );
    res.Contents?.forEach((o) => {
      if (o.Key) map.set(o.Key, (o.ETag ?? '').replace(/"/g, ''));
    });
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return map;
}

async function main() {
  if (!fs.existsSync(QR_DIR)) {
    console.error(`❌ Không thấy thư mục: ${QR_DIR}`);
    process.exitCode = 1;
    return;
  }

  const entries = fs
    .readdirSync(QR_DIR)
    .map((f) => ({ f, m: f.match(FILE_RE) }))
    .filter((x): x is { f: string; m: RegExpMatchArray } => !!x.m)
    .map(({ f, m }) => ({ file: f, n: parseInt(m[1], 10) }))
    .filter((x) => x.n >= FROM && x.n <= TO)
    .sort((a, b) => a.n - b.n);

  console.log(`🔍 Kiểm ${entries.length} file trong dải PL-${FROM}..PL-${TO}\n`);

  // ---------- 1) Nội dung QR trong PNG có khớp với tên file không? ----------
  const wrong: { file: string; expected: string; decoded: string }[] = [];
  const unreadable: string[] = [];
  const offsets = new Map<number, number>();
  const wrongNums: number[] = [];
  let ok = 0;

  entries.forEach(({ file, n }, i) => {
    const expected = `PL-${String(n).padStart(5, '0')}`;
    let raw: string | null = null;
    try {
      raw = decodeQr(fs.readFileSync(path.join(QR_DIR, file)));
    } catch {
      raw = null;
    }
    if (raw === null) {
      unreadable.push(file);
      return;
    }
    const decoded = normalizeLikeApp(raw);
    if (decoded === expected) {
      ok++;
    } else {
      wrong.push({ file, expected, decoded: raw });
      wrongNums.push(n);
      const m = decoded.match(/^PL-(\d+)$/);
      if (m) offsets.set(parseInt(m[1], 10) - n, (offsets.get(parseInt(m[1], 10) - n) ?? 0) + 1);
    }
    if ((i + 1) % 500 === 0) console.log(`⏳ ${i + 1}/${entries.length}...`);
  });

  console.log('\n=========== 1) NỘI DUNG QR TRONG PNG vs TÊN FILE ===========');
  console.log(`Khớp:                 ${ok}`);
  console.log(`SAI (nội dung ≠ tên): ${wrong.length}`);
  console.log(`Không đọc được QR:    ${unreadable.length}`);
  if (wrong.length) {
    console.log(`Dải số bị sai:        ${toRanges(wrongNums).slice(0, 15).join(', ')}`);
    console.log('Ví dụ (tên file -> nội dung QR thực tế):');
    wrong.slice(0, 10).forEach((w) => console.log(`   ${w.file}  ->  ${w.decoded}`));
    const top = [...offsets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length) {
      console.log('Độ lệch phổ biến (số trong QR − số trong tên file):');
      top.forEach(([off, cnt]) => console.log(`   ${off > 0 ? '+' : ''}${off}: ${cnt} file`));
    }
  }
  if (unreadable.length) console.log(`Ví dụ không đọc được: ${unreadable.slice(0, 5).join(', ')}`);

  // ---------- 2) Ảnh trên R2 có đúng là file local không? ----------
  let r2Missing: string[] = [];
  let r2Stale: string[] = [];
  if (CHECK_R2) {
    console.log('\n⏳ Đang liệt kê R2...');
    const remote = await listR2();
    for (const { file, n } of entries) {
      const id = `PL-${String(n).padStart(5, '0')}`;
      const etag = remote.get(`${R2_PREFIX}${id}.png`);
      if (!etag) r2Missing.push(id);
      else if (etag !== md5(fs.readFileSync(path.join(QR_DIR, file)))) r2Stale.push(id);
    }
    console.log('\n=========== 2) ẢNH TRÊN R2 vs FILE LOCAL ===========');
    console.log(`Thiếu trên R2:                ${r2Missing.length}`);
    console.log(`CŨ/KHÁC file local (stale):   ${r2Stale.length}`);
    if (r2Stale.length) {
      const nums = r2Stale.map((id) => parseInt(id.slice(3), 10)).sort((a, b) => a - b);
      console.log(`Dải bị stale:                 ${toRanges(nums).slice(0, 15).join(', ')}`);
      console.log(`Ví dụ:                        ${r2Stale.slice(0, 8).join(', ')}`);
    }
  }

  fs.writeFileSync(
    REPORT,
    JSON.stringify({ ok, wrong, unreadable, r2Missing, r2Stale }, null, 2),
  );
  console.log(`\n📝 Báo cáo chi tiết: ${REPORT}`);
  console.log('\n---- Cách đọc kết quả ----');
  console.log('• Mục 1 có "SAI"  -> file PNG sinh ra đã sai (tên file ≠ nội dung QR). Seed lại bao nhiêu lần cũng sai; phải sửa nguồn sinh ảnh/đổi tên file.');
  console.log('• Mục 1 sạch, mục 2 có "stale" -> file local đúng nhưng R2 còn ảnh cũ. Chạy seed bản đã vá (hoặc --force).');
  console.log('• Cả hai sạch -> lỗi nằm ở backend (qrImageUrl trả về) hoặc cache của app.');
}

main().catch((e) => {
  console.error('❌ Lỗi:', e);
  process.exit(1);
});