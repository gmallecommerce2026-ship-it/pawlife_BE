import { Worker } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const MANIFEST = path.join(process.cwd(), 'src/database/qr-manifest.json');
const WORKER_FILE = path.join(__dirname, 'qr-worker.js');

async function main() {
  const files = fs.readdirSync(QR_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  const cache: Record<string, string> = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
    : {};
  const todo = files.filter((f) => !cache[f]);
  console.log(`Cần quét ${todo.length}/${files.length} ảnh`);

  const n = Math.max(1, os.cpus().length - 1);
  const chunks = Array.from({ length: n }, (_, i) => todo.filter((_, j) => j % n === i));

  const results = await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise<Record<string, string | null>>((resolve, reject) => {
          const w = new Worker(WORKER_FILE, { workerData: { files: chunk, qrDir: QR_DIR } });
          w.on('message', resolve);
          w.on('error', reject);
        }),
    ),
  );

  let failed = 0;
  for (const r of results)
    for (const [f, id] of Object.entries(r)) id ? (cache[f] = id) : failed++;

  fs.writeFileSync(MANIFEST, JSON.stringify(cache, null, 2));
  console.log(`Xong. Thành công: ${Object.keys(cache).length}, thất bại: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});