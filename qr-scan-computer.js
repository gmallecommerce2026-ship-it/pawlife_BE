/**
 * QR SCANNER - quét trực tiếp toàn bộ máy tính, không cần bước tạo index riêng.
 * Đưa vào 1 ảnh mẫu (hoặc gõ ID), chọn thư mục/ổ đĩa cần quét (để trống = quét
 * mọi ổ đĩa), app tự đệ quy và giải mã từng ảnh .png/.jpg ngay khi quét tới.
 *
 * Chạy:
 *   node qr-scan-computer.js
 * Rồi mở: http://localhost:4100
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const jsQR = require('jsqr');

const jimpModule = require('jimp');
const Jimp = jimpModule.Jimp ?? jimpModule.default ?? jimpModule;

const PORT = process.env.PORT || 4100;

// Thư mục hệ thống ít khả năng chứa ảnh QR - bỏ qua để quét nhanh hơn nhiều.
const SKIP_DIR_NAMES = new Set([
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
  '$recycle.bin',
  'system volume information',
  'node_modules',
  'appdata',
  '.git',
]);

let scan = null; // { id, targetId, scannedCount, matches: [], done, cancelled }

function normalizeTagId(raw) {
  const m = raw.match(/PL[-_\s]?(\d{1,5})(?!\d)/i);
  if (!m) return null;
  return `PL-${m[1].padStart(5, '0')}`;
}

function binarize(data, threshold = 128) {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = lum < threshold ? 0 : 255;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  return out;
}

async function decodeFile(filePath) {
  try {
    const image = await Jimp.read(filePath);
    const { data, width, height } = image.bitmap;
    const cleaned = binarize(data);
    const qr = jsQR(cleaned, width, height, { inversionAttempts: 'attemptBoth' });
    if (!qr) return null;
    const raw = qr.data.trim();
    return { raw, id: normalizeTagId(raw) };
  } catch {
    return null;
  }
}

function listDrives() {
  const drives = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const p = `${letter}:\\`;
    if (fs.existsSync(p)) drives.push(p);
  }
  return drives;
}

function sleep0() {
  return new Promise((r) => setImmediate(r));
}

async function runScan(scanState, roots) {
  for (const root of roots) {
    if (scanState.cancelled) break;
    const stack = [root];
    while (stack.length > 0) {
      if (scanState.cancelled) break;
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (scanState.cancelled) break;
        if (entry.isDirectory()) {
          if (!SKIP_DIR_NAMES.has(entry.name.toLowerCase())) {
            stack.push(path.join(dir, entry.name));
          }
        } else if (entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name)) {
          const full = path.join(dir, entry.name);
          const result = await decodeFile(full);
          scanState.scannedCount++;
          if (result && result.id === scanState.targetId) {
            scanState.matches.push({ path: full, raw: result.raw });
          }
          if (scanState.scannedCount % 5 === 0) await sleep0();
        }
      }
    }
  }
  scanState.done = true;
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>QR Scanner - Quét toàn máy</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; color: #1a1a1a; }
  h1 { font-size: 20px; }
  .box { border: 1px solid #ddd; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  input[type=text] { width: 100%; padding: 10px; font-size: 16px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 6px; }
  button { margin-top: 10px; padding: 10px 18px; font-size: 15px; border: none; border-radius: 6px; background: #2563eb; color: white; cursor: pointer; margin-right: 8px; }
  button:hover { background: #1d4ed8; }
  button.stop { background: #dc2626; }
  #progress { margin-top: 16px; font-family: monospace; font-size: 14px; white-space: pre-wrap; background: #f7f7f7; padding: 14px; border-radius: 8px; display: none; }
  .match { margin-top: 10px; padding: 10px; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 8px; }
  .match img { max-width: 160px; display: block; margin-top: 8px; }
</style>
</head>
<body>
  <h1>🔎 Quét tìm QR trên toàn máy tính</h1>

  <div class="box">
    <b>Mục tiêu cần tìm</b><br>
    <input type="text" id="idInput" placeholder="Gõ thẳng ID nếu đã biết, VD: PL-00006" style="margin-top:8px">
    <div style="margin-top:8px">— hoặc —</div>
    <input type="file" id="imgInput" accept="image/*" style="margin-top:8px">
  </div>

  <div class="box">
    <b>Phạm vi quét</b><br>
    <input type="text" id="rootInput" placeholder="VD: D:\\Downloads  (để trống = quét TẤT CẢ ổ đĩa)" style="margin-top:8px">
    <button onclick="startScan()">Bắt đầu quét</button>
    <button class="stop" onclick="stopScan()">Dừng</button>
  </div>

  <div id="progress"></div>
  <div id="matches"></div>

<script>
let polling = null;

async function resolveTargetId() {
  const typed = document.getElementById('idInput').value.trim();
  if (typed) return typed;

  const fileInput = document.getElementById('imgInput');
  if (!fileInput.files[0]) { alert('Nhập ID hoặc chọn ảnh mẫu trước.'); return null; }

  const file = fileInput.files[0];
  const b64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
  const res = await fetch('/api/decode-sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: b64 }),
  });
  const data = await res.json();
  if (data.error) { alert(data.error); return null; }
  return data.id;
}

async function startScan() {
  const targetId = await resolveTargetId();
  if (!targetId) return;
  const root = document.getElementById('rootInput').value.trim();

  document.getElementById('matches').innerHTML = '';
  document.getElementById('progress').style.display = 'block';
  document.getElementById('progress').textContent = 'Đang bắt đầu quét mục tiêu ' + targetId + ' ...';

  await fetch('/api/start-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId, root }),
  });

  if (polling) clearInterval(polling);
  polling = setInterval(pollStatus, 1000);
}

async function stopScan() {
  await fetch('/api/cancel-scan', { method: 'POST' });
}

async function pollStatus() {
  const res = await fetch('/api/scan-status');
  const s = await res.json();
  document.getElementById('progress').textContent =
    'Đã quét: ' + s.scannedCount + ' ảnh' + (s.done ? '  ✅ HOÀN TẤT' : '  (đang quét...)') +
    '\\nTìm thấy: ' + s.matches.length + ' file khớp';

  const box = document.getElementById('matches');
  box.innerHTML = '';
  for (const m of s.matches) {
    const div = document.createElement('div');
    div.className = 'match';
    div.innerHTML = '<b>✅ ' + m.path + '</b><br>Nội dung QR: "' + m.raw + '"';
    const img = document.createElement('img');
    img.src = '/image?path=' + encodeURIComponent(m.path);
    div.appendChild(img);
    box.appendChild(div);
  }

  if (s.done && polling) { clearInterval(polling); polling = null; }
}
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML_PAGE);
  }

  if (url.pathname === '/api/decode-sample' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const { imageBase64 } = JSON.parse(body);
        const base64 = imageBase64.split(',').pop();
        const buffer = Buffer.from(base64, 'base64');
        const tmpPath = path.join(require('os').tmpdir(), `qr-sample-${Date.now()}.png`);
        fs.writeFileSync(tmpPath, buffer);
        const result = await decodeFile(tmpPath);
        fs.unlinkSync(tmpPath);
        if (!result) return sendJson(res, 200, { error: 'Không đọc được mã QR trong ảnh mẫu.' });
        if (!result.id) return sendJson(res, 200, { error: `Nội dung "${result.raw}" không đúng định dạng PL-xxxxx.` });
        return sendJson(res, 200, { id: result.id, raw: result.raw });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    });
    return;
  }

  if (url.pathname === '/api/start-scan' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { targetId, root } = JSON.parse(body);
        const id = normalizeTagId(targetId) || targetId.toUpperCase();
        let roots;
        if (root) {
          if (!fs.existsSync(root)) return sendJson(res, 200, { error: 'Thư mục không tồn tại: ' + root });
          roots = [root];
        } else {
          roots = listDrives();
        }
        scan = { targetId: id, scannedCount: 0, matches: [], done: false, cancelled: false };
        runScan(scan, roots); // chạy nền, không chờ
        return sendJson(res, 200, { started: true, roots });
      } catch (e) {
        return sendJson(res, 500, { error: e.message });
      }
    });
    return;
  }

  if (url.pathname === '/api/scan-status' && req.method === 'GET') {
    if (!scan) return sendJson(res, 200, { scannedCount: 0, matches: [], done: true });
    return sendJson(res, 200, { scannedCount: scan.scannedCount, matches: scan.matches, done: scan.done });
  }

  if (url.pathname === '/api/cancel-scan' && req.method === 'POST') {
    if (scan) scan.cancelled = true;
    return sendJson(res, 200, { cancelled: true });
  }

  if (url.pathname === '/image' && req.method === 'GET') {
    const p = url.searchParams.get('path') || '';
    if (!fs.existsSync(p) || !/\.(png|jpe?g)$/i.test(p)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': /\.png$/i.test(p) ? 'image/png' : 'image/jpeg' });
    return fs.createReadStream(p).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`✅ QR Scanner đang chạy tại: http://localhost:${PORT}`);
});