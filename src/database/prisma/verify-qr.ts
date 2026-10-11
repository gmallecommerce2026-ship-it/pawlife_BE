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
 *   npx ts-node src/database/prisma/verify-qr.ts --inspect=PL-00100,PL-00900  # so thuộc tính ảnh (viền, màu, kích thước, ngày upload) local vs R2
 *   npx ts-node src/database/prisma/verify-qr.ts --dir=D:/QR_Codes     # thư mục khác
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { PNG } from 'pngjs';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsQR = require('jsqr');

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DECODE_R2 = process.argv.includes('--r2-decode');
const INSPECT = arg('inspect'); // vd: --inspect=PL-00100,PL-00900
const CHECK_R2 = process.argv.includes('--r2') || DECODE_R2;
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

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('Thiếu R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY trong .env');
    }
    _s3 = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _s3;
}

async function listR2(): Promise<Map<string, string>> {
  const map = new Map<string, string>(); // key -> etag (md5 với ảnh upload 1 phần)
  let token: string | undefined;
  do {
    const res = await getS3().send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: R2_PREFIX, ContinuationToken: token }),
    );
    res.Contents?.forEach((o) => {
      if (o.Key) map.set(o.Key, (o.ETag ?? '').replace(/"/g, ''));
    });
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return map;
}

// ---------- --inspect: so sánh THUỘC TÍNH ảnh (local vs R2) ----------
type QrProps = {
  bytes: number; width: number; height: number; payload: string | null;
  version?: number; modulePx?: number; quietModules?: number; dark?: string; light?: string; contrast?: number;
  marginPx?: number; // chỉ có khi không giải mã được: viền trắng ước lượng từ điểm ảnh
};

function inspectPng(buf: Buffer): QrProps {
  const png = PNG.sync.read(buf);
  const out: QrProps = { bytes: buf.length, width: png.width, height: png.height, payload: null };
  const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'attemptBoth' });

  const rgb = (x: number, y: number) => {
    const i = (Math.max(0, Math.min(png.height - 1, Math.round(y))) * png.width + Math.max(0, Math.min(png.width - 1, Math.round(x)))) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]] as const;
  };
  const lum = ([r, g, b]: readonly [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const hex = ([r, g, b]: readonly [number, number, number]) =>
    '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

  if (!res) {
    // Không giải mã được: ước lượng viền + tương phản từ điểm ảnh (nền = điểm sáng nhất, mực = điểm tối nhất)
    let lightest = rgb(0, 0);
    let darkest = rgb(0, 0);
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const px = rgb(x, y);
        if (lum(px) > lum(lightest)) lightest = px;
        if (lum(px) < lum(darkest)) darkest = px;
      }
    }
    const mid = (lum(lightest) + lum(darkest)) / 2;
    let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        if (lum(rgb(x, y)) < mid) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    out.marginPx = maxX < 0 ? undefined : Math.min(minX, minY, png.width - 1 - maxX, png.height - 1 - maxY);
    out.dark = hex(darkest);
    out.light = hex(lightest);
    out.contrast = lum(lightest) - lum(darkest);
    return out;
  }
  out.payload = res.data;

  const { topLeftCorner: tl, topRightCorner: tr, bottomRightCorner: br } = res.location;
  const modules = 17 + 4 * res.version;
  out.version = res.version;
  out.modulePx = Math.hypot(tr.x - tl.x, tr.y - tl.y) / modules;
  const quietPx = Math.min(tl.x, tl.y, png.width - br.x, png.height - br.y);
  out.quietModules = quietPx / out.modulePx;

  const dark = rgb(res.location.topLeftFinderPattern.x, res.location.topLeftFinderPattern.y);
  const light = rgb(1, 1);
  out.dark = hex(dark);
  out.light = hex(light);
  out.contrast = Math.abs(lum(light) - lum(dark));
  return out;
}

function printProps(label: string, p: QrProps, extra = ''): void {
  console.log(`  [${label}]${extra ? ' ' + extra : ''}`);
  console.log(`     kích thước ảnh:   ${p.width}x${p.height}px, ${p.bytes} bytes`);
  console.log(`     chuỗi trong QR:   ${p.payload ?? '(KHÔNG ĐỌC ĐƯỢC)'}`);
  if (p.payload === null && p.dark) {
    console.log(`     viền trắng ≈ ${p.marginPx ?? '?'}px ${p.marginPx !== undefined && p.marginPx < p.width * 0.04 ? '⚠️ GẦN NHƯ KHÔNG CÓ VIỀN' : ''}`);
    console.log(`     màu tối/nền:      ${p.dark} / ${p.light}  (độ tương phản ${Math.round(p.contrast ?? 0)}/255 ${(p.contrast ?? 0) < 150 ? '⚠️ THẤP' : '✅'})`);
  }
  if (p.version !== undefined) {
    console.log(`     QR version:       ${p.version}  (~${(17 + 4 * p.version)}x${(17 + 4 * p.version)} ô)`);
    console.log(`     1 ô = ${p.modulePx!.toFixed(1)}px   viền trắng quanh QR ≈ ${p.quietModules!.toFixed(1)} ô ${p.quietModules! < 3.5 ? '⚠️ THIẾU VIỀN (chuẩn ≥ 4 ô)' : '✅'}`);
    console.log(`     màu ô tối/nền:    ${p.dark} / ${p.light}  (độ tương phản ${Math.round(p.contrast!)}/255 ${p.contrast! < 150 ? '⚠️ THẤP' : '✅'})`);
  }
}

async function inspectIds(ids: string[]): Promise<void> {
  const hasR2 = !!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
  if (!hasR2) console.log('(Không có biến R2_* trong .env nên chỉ xem file local)');
  for (const id of ids) {
    console.log(`\n=== ${id} ===`);
    const local = path.join(QR_DIR, `${id}.png`);
    if (fs.existsSync(local)) printProps('LOCAL  thư mục QR_Codes', inspectPng(fs.readFileSync(local)));
    else console.log('  [LOCAL] không có file');
    if (!hasR2) continue;
    try {
      const obj = await getS3().send(new GetObjectCommand({ Bucket: BUCKET, Key: `${R2_PREFIX}${id}.png` }));
      const buf = Buffer.from(await obj.Body!.transformToByteArray());
      printProps(
        'R2     file app đang hiển thị',
        inspectPng(buf),
        `(upload: ${obj.LastModified?.toISOString() ?? '?'}, ${obj.ContentType ?? '?'}, cache: ${obj.CacheControl ?? '-'})`,
      );
    } catch (e: any) {
      console.log(`  [R2] lỗi: ${e.message}`);
    }
  }
}

async function main() {
  if (!fs.existsSync(QR_DIR)) {
    console.error(`❌ Không thấy thư mục: ${QR_DIR}`);
    process.exitCode = 1;
    return;
  }

  if (INSPECT) {
    await inspectIds(INSPECT.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean));
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

  // ---------- 3) (tuỳ chọn) Ảnh đang nằm trên R2 mã hoá cái gì so với file local? ----------
  const r2Decode: { id: string; r2: string | null; local: string | null; kind: string }[] = [];
  if (DECODE_R2 && r2Stale.length) {
    console.log(`\n⏳ Tải và giải mã ${r2Stale.length} ảnh trên R2 (khác file local)...`);
    const fileOf = new Map(entries.map((e) => [`PL-${String(e.n).padStart(5, '0')}`, e.file]));
    const count = { samePayload: 0, sameIdOtherFormat: 0, differentId: 0, r2Unreadable: 0, localUnreadable: 0, r2OkForOwnId: 0 };

    for (let i = 0; i < r2Stale.length; i++) {
      const id = r2Stale[i];
      let r2Raw: string | null = null;
      let localRaw: string | null = null;
      try {
        const obj = await getS3().send(new GetObjectCommand({ Bucket: BUCKET, Key: `${R2_PREFIX}${id}.png` }));
        r2Raw = decodeQr(Buffer.from(await obj.Body!.transformToByteArray()));
      } catch {
        r2Raw = null;
      }
      try {
        localRaw = decodeQr(fs.readFileSync(path.join(QR_DIR, fileOf.get(id)!)));
      } catch {
        localRaw = null;
      }

      let kind: keyof typeof count;
      if (r2Raw === null) kind = 'r2Unreadable';
      else if (localRaw === null) kind = 'localUnreadable';
      else if (r2Raw === localRaw) kind = 'samePayload';
      else if (normalizeLikeApp(r2Raw) === normalizeLikeApp(localRaw)) kind = 'sameIdOtherFormat';
      else kind = 'differentId';
      count[kind]++;
      if (r2Raw !== null && normalizeLikeApp(r2Raw) === id) count.r2OkForOwnId++;
      r2Decode.push({ id, r2: r2Raw, local: localRaw, kind });
      if ((i + 1) % 100 === 0) console.log(`⏳ ${i + 1}/${r2Stale.length}...`);
    }

    console.log('\n=========== 3) ẢNH TRÊN R2 (khác file local) MÃ HOÁ GÌ? ===========');
    console.log(`Cùng nội dung QR, chỉ khác byte ảnh:   ${count.samePayload}`);
    console.log(`Cùng ID nhưng khác định dạng chuỗi:    ${count.sameIdOtherFormat}`);
    console.log(`Mã hoá ID KHÁC với file local:         ${count.differentId}`);
    console.log(`Không đọc được (R2 / local):           ${count.r2Unreadable} / ${count.localUnreadable}`);
    console.log(`Ảnh R2 giải ra đúng ID của chính nó:   ${count.r2OkForOwnId}/${r2Stale.length}`);
    const interesting = r2Decode.filter((x) => x.kind !== 'samePayload').slice(0, 8);
    if (interesting.length) {
      console.log('Ví dụ (id | chuỗi trong ảnh R2 | chuỗi trong file local):');
      interesting.forEach((x) => console.log(`   ${x.id} | ${x.r2} | ${x.local}  [${x.kind}]`));
    }
  }

  fs.writeFileSync(
    REPORT,
    JSON.stringify({ ok, wrong, unreadable, r2Missing, r2Stale, r2Decode }, null, 2),
  );
  console.log(`\n📝 Báo cáo chi tiết: ${REPORT}`);
  console.log('\n---- Cách đọc kết quả ----');
  console.log('• Mục 1 có "SAI"  -> file PNG sinh ra đã sai (tên file ≠ nội dung QR). Seed lại bao nhiêu lần cũng sai; phải sửa nguồn sinh ảnh/đổi tên file.');
  console.log('• Mục 1 sạch, mục 2 có "stale" -> file local đúng nhưng R2 còn ảnh cũ. Chạy seed bản đã vá (hoặc --force).');
  console.log('• Mục 3 (--r2-decode): cho biết ảnh cũ trên R2 và file local khác nhau ở byte, ở định dạng chuỗi, hay ở chính ID.');
  console.log('• Cả hai sạch -> lỗi nằm ở backend (qrImageUrl trả về) hoặc cache của app.');
}

main().catch((e) => {
  console.error('❌ Lỗi:', e);
  process.exit(1);
});