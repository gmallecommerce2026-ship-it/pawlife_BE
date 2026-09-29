/**
 * Chẩn đoán nhanh: file ảnh QR có thực sự chứa pixel đen (mã QR thật)
 * hay chỉ là nền trắng/gần trắng (ảnh bị lỗi lúc generate)?
 * Không phụ thuộc jsQR - chỉ đếm tỉ lệ pixel tối trên ảnh.
 *
 * Cách chạy:
 *   node check-qr-images.js src/database/QR_Codes/qr_00001.png
 *   node check-qr-images.js src/database/QR_Codes/qr_00001.png src/database/QR_Codes/qr_06973.png
 *
 * Không truyền file nào -> tự lấy 10 file ngẫu nhiên trong thư mục QR_Codes.
 */
const fs = require('fs');
const path = require('path');

const jimpModule = require('jimp');
const Jimp = jimpModule.Jimp ?? jimpModule.default ?? jimpModule;
const jsQR = require('jsqr');

const QR_DIR = path.join(process.cwd(), 'src/database/QR_Codes');

async function checkFile(filePath) {
  const image = await Jimp.read(filePath);
  const { data, width, height } = image.bitmap;

  let dark = 0;
  let minLum = 255;
  let maxLum = 0;
  const total = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
    if (lum < 128) dark++;
  }

  const darkRatio = (dark / total) * 100;

  // Thử decode trực tiếp để đối chiếu
  let qrResult = 'null';
  try {
    const qr = jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'attemptBoth' });
    qrResult = qr ? `"${qr.data}"` : 'null (không tìm thấy)';
  } catch (e) {
    qrResult = `lỗi: ${e.message}`;
  }

  console.log(`\n📄 ${path.basename(filePath)}`);
  console.log(`   Kích thước: ${width}x${height}, tổng ${total} px`);
  console.log(`   Độ sáng: min=${minLum.toFixed(0)} max=${maxLum.toFixed(0)} (0=đen, 255=trắng)`);
  console.log(`   Tỉ lệ pixel tối (<128): ${darkRatio.toFixed(2)}%`);
  console.log(`   jsQR decode: ${qrResult}`);

  if (darkRatio < 1) {
    console.log('   ⚠️  KẾT LUẬN: ảnh gần như trắng hoàn toàn -> KHÔNG có nội dung QR thật, lỗi ở bước generate ảnh.');
  } else if (maxLum - minLum < 50) {
    console.log('   ⚠️  KẾT LUẬN: ảnh thiếu tương phản (toàn màu xám gần giống nhau) -> có thể lỗi màu/blend lúc generate.');
  } else {
    console.log('   ✅ Ảnh có tương phản đen/trắng bình thường, cần kiểm tra riêng vì sao jsQR không đọc được.');
  }
}

async function main() {
  let files = process.argv.slice(2);

  if (files.length === 0) {
    const all = fs.readdirSync(QR_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
    const sampleCount = Math.min(10, all.length);
    const step = Math.floor(all.length / sampleCount) || 1;
    files = [];
    for (let i = 0; i < all.length && files.length < sampleCount; i += step) {
      files.push(path.join(QR_DIR, all[i]));
    }
    console.log(`Không truyền file cụ thể, tự chọn ${files.length} file rải rác trong thư mục để kiểm tra.`);
  }

  for (const f of files) {
    try {
      await checkFile(f);
    } catch (e) {
      console.log(`\n📄 ${f}\n   ❌ Lỗi đọc file: ${e.message}`);
    }
  }
}

main();