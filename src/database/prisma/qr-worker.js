const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const sharp = require('sharp');
const jsQR = require('jsqr');

const QR_DIR = workerData.qrDir;

async function decode(file) {
  const p = path.join(QR_DIR, file);
  for (const width of [700, undefined]) {
    let img = sharp(p);
    if (width) img = img.resize({ width, withoutEnlargement: true });
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const qr = jsQR(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
      info.width,
      info.height,
      { inversionAttempts: 'dontInvert' },
    );
    if (qr) return qr.data.trim().split('/').pop().trim().toUpperCase();
  }
  return null;
}

(async () => {
  const out = {};
  for (const f of workerData.files) {
    try { out[f] = await decode(f); } catch { out[f] = null; }
  }
  parentPort.postMessage(out);
})();