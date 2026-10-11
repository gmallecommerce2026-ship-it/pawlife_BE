// src/database/prisma/qr-match.ts
// chạy: npx ts-node --transpile-only src/database/prisma/qr-match.ts "PL-00810" wallet.png app.png
import QRCode from 'qrcode';
import sharp from 'sharp';

async function readGrid(file: string, n: number): Promise<number[][]> {
  const { data, info } = await sharp(file)
    .flatten({ background: '#ffffff' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  // Khung bao của các pixel tối = đúng vùng QR (bỏ viền trắng)
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] < 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cw = (maxX - minX + 1) / n;
  const ch = (maxY - minY + 1) / n;
  const grid: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) {
      const px = Math.floor(minX + (c + 0.5) * cw);
      const py = Math.floor(minY + (r + 0.5) * ch);
      row.push(data[py * W + px] < 128 ? 1 : 0);
    }
    grid.push(row);
  }
  return grid;
}

async function main() {
  const [payload, ...files] = process.argv.slice(2);
  if (!payload || files.length === 0) throw new Error('Cách dùng: qr-match.ts <payload> <ảnh1> [ảnh2...]');

  const isAlnum = /^[0-9A-Z $%*+\-./:]+$/.test(payload);
  const modes: Array<'byte' | 'alphanumeric'> = isAlnum ? ['byte', 'alphanumeric'] : ['byte'];

  // Tạo toàn bộ ứng viên
  const candidates: { label: string; size: number; get: (r: number, c: number) => number }[] = [];
  for (const mode of modes) {
    for (const ec of ['L', 'M', 'Q', 'H'] as const) {
      for (let mask = 0; mask < 8; mask++) {
        for (let version = 1; version <= 5; version++) {
          try {
            const seg = mode === 'byte'
              ? [{ data: Buffer.from(payload, 'latin1'), mode }]
              : [{ data: payload, mode }];
            const qr: any = QRCode.create(seg as any, {
              errorCorrectionLevel: ec,
              maskPattern: mask as any,
              version,
            });
            candidates.push({
              label: `${mode} | EC=${ec} | mask=${mask} | version=${version} (${qr.modules.size}x${qr.modules.size})`,
              size: qr.modules.size,
              get: (r, c) => qr.modules.get(r, c),
            });
          } catch { /* version quá nhỏ cho chuỗi này, bỏ qua */ }
        }
      }
    }
  }

  for (const file of files) {
    const results: { label: string; diff: number }[] = [];
    for (const cand of candidates) {
      const grid = await readGrid(file, cand.size);
      let diff = 0;
      for (let r = 0; r < cand.size; r++)
        for (let c = 0; c < cand.size; c++)
          if (grid[r][c] !== cand.get(r, c)) diff++;
      results.push({ label: cand.label, diff: diff / (cand.size * cand.size) });
    }
    results.sort((a, b) => a.diff - b.diff);
    console.log(`\n=== ${file} ===`);
    for (const r of results.slice(0, 3)) console.log(`${(r.diff * 100).toFixed(1)}% ô lệch  ←  ${r.label}`);
  }
}
main();