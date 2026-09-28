import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import sharp from 'sharp';
import jsQR from 'jsqr';

const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const MANIFEST = path.join(process.cwd(), 'src/database/qr-manifest.json');

async function decode(file: string): Promise<string | null> {
  const p = path.join(QR_DIR, file);
  // Thử ảnh thu nhỏ trước (nhanh), fail thì thử ảnh gốc
  for (const width of [700, undefined]) {
    let img = sharp(p);
    if (width) img = img.resize({ width, withoutEnlargement: true });
    // Nếu QR nằm cố định trong thẻ, thêm .extract({ left, top, width, height }) ở đây
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const qr = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
      info.width, info.height, { inversionAttempts: 'dontInvert' });
    if (qr) return qr.data.trim().split('/').pop()!.trim().toUpperCase();
  }
  return null;
}

if (!isMainThread) {
  (async () => {
    const out: Record<string, string | null> = {};
    for (const f of workerData.files as string[]) {
      try { out[f] = await decode(f); } catch { out[f] = null; }
    }
    parentPort!.postMessage(out);
  })();
} else {
  (async () => {
    const files = fs.readdirSync(QR_DIR).filter(f => f.toLowerCase().endsWith('.png'));
    const cache: Record<string, string> = fs.existsSync(MANIFEST)
      ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
    const todo = files.filter(f => !cache[f]);          // chỉ quét file mới
    console.log(`Cần quét ${todo.length}/${files.length} ảnh`);

    const n = Math.max(1, os.cpus().length - 1);
    const chunks = Array.from({ length: n }, (_, i) => todo.filter((_, j) => j % n === i));

    const results = await Promise.all(chunks.map(files => new Promise<Record<string, string | null>>((res, rej) => {
      const w = new Worker(__filename, { workerData: { files } });
      w.on('message', res); w.on('error', rej);
    })));

    let failed = 0;
    for (const r of results) for (const [f, id] of Object.entries(r)) id ? (cache[f] = id) : failed++;
    fs.writeFileSync(MANIFEST, JSON.stringify(cache, null, 2));
    console.log(`Xong. Thất bại: ${failed}`);
  })();
}