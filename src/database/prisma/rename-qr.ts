import * as fs from 'fs';
import * as path from 'path';

const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');
const OUT = path.join(process.cwd(), 'src/database/QR_Codes_fixed');
const manifest = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src/database/qr-manifest.json'), 'utf8'),
) as Record<string, string>;

fs.mkdirSync(OUT, { recursive: true });

const seen = new Map<string, string>(); // tên mới -> file gốc
let bad = 0;

for (const [file, id] of Object.entries(manifest)) {
  const m = id.match(/^PL[-_]?(\d+)$/i);
  if (!m) { console.warn('ID lạ:', file, id); bad++; continue; }
  const newName = `qr_${parseInt(m[1], 10)}.png`;   // PL-05000 -> qr_5000.png
  if (seen.has(newName)) {
    console.warn(`TRÙNG ${newName}: ${seen.get(newName)} và ${file}`);
    bad++; continue;
  }
  seen.set(newName, file);
  fs.copyFileSync(path.join(QR_DIR, file), path.join(OUT, newName));
}
console.log(`Xong: ${seen.size} file, ${bad} vấn đề`);