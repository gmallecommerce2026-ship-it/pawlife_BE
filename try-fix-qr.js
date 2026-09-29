/**
 * Thử nhiều cách biến đổi ảnh để tìm ra vì sao jsQR/zbar không đọc được,
 * dù ảnh có tương phản đen/trắng bình thường (không trống).
 *
 * Cách chạy:
 *   node try-fix-qr.js src/database/QR_Codes/qr_00001.png
 */
const path = require('path');
const jimpModule = require('jimp');
const Jimp = jimpModule.Jimp ?? jimpModule.default ?? jimpModule;
const jsQR = require('jsqr');

function tryDecode(data, width, height) {
  try {
    const qr = jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'attemptBoth' });
    return qr ? qr.data : null;
  } catch (e) {
    return null;
  }
}

// Thêm viền trắng quanh ảnh
function padWhite(data, width, height, pad) {
  const newW = width + pad * 2;
  const newH = height + pad * 2;
  const out = new Uint8ClampedArray(newW * newH * 4).fill(255);
  for (let y = 0; y < height; y++) {
    const src = data.subarray(y * width * 4, (y + 1) * width * 4);
    out.set(src, ((y + pad) * newW + pad) * 4);
  }
  return { data: out, width: newW, height: newH };
}

// Nhị phân hoá: chỉ còn đen tuyệt đối hoặc trắng tuyệt đối
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

// Cắt lấy phần vuông trên cùng (giả định QR nằm ở top, chữ ID nằm dưới)
function cropTopSquare(data, width, height) {
  const side = Math.min(width, height);
  const out = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) {
    out.set(data.subarray(y * width * 4, y * width * 4 + side * 4), y * side * 4);
  }
  return { data: out, width: side, height: side };
}

// Phóng to 2x (nearest neighbor) - đôi khi giúp decoder bắt module rõ hơn
function upscale2x(data, width, height) {
  const newW = width * 2;
  const newH = height * 2;
  const out = new Uint8ClampedArray(newW * newH * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const d = ((y * 2 + dy) * newW + (x * 2 + dx)) * 4;
          out[d] = data[s];
          out[d + 1] = data[s + 1];
          out[d + 2] = data[s + 2];
          out[d + 3] = data[s + 3];
        }
      }
    }
  }
  return { data: out, width: newW, height: newH };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Dùng: node try-fix-qr.js <đường_dẫn_file.png>');
    process.exit(1);
  }

  const image = await Jimp.read(filePath);
  const { data, width, height } = image.bitmap;
  console.log(`📄 ${path.basename(filePath)} - ${width}x${height}\n`);

  const attempts = [];

  attempts.push(['Gốc, không đổi gì', { data, width, height }]);

  const padded60 = padWhite(data, width, height, 60);
  attempts.push(['Thêm viền trắng 60px', padded60]);

  const padded150 = padWhite(data, width, height, 150);
  attempts.push(['Thêm viền trắng 150px', padded150]);

  const bin = { data: binarize(data), width, height };
  attempts.push(['Nhị phân hoá (threshold 128)', bin]);

  const binPadded = padWhite(bin.data, width, height, 60);
  attempts.push(['Nhị phân hoá + viền trắng 60px', binPadded]);

  const cropped = cropTopSquare(data, width, height);
  attempts.push(['Cắt vuông góc trên (bỏ phần chữ dưới)', cropped]);

  const croppedPadded = padWhite(cropped.data, cropped.width, cropped.height, 60);
  attempts.push(['Cắt vuông + viền trắng 60px', croppedPadded]);

  const croppedBinPadded = padWhite(binarize(cropped.data), cropped.width, cropped.height, 60);
  attempts.push(['Cắt vuông + nhị phân hoá + viền trắng', croppedBinPadded]);

  const upscaled = upscale2x(data, width, height);
  attempts.push(['Phóng to 2x', upscaled]);

  const upscaledBin = { data: binarize(upscaled.data), width: upscaled.width, height: upscaled.height };
  attempts.push(['Phóng to 2x + nhị phân hoá', upscaledBin]);

  let anySuccess = false;
  for (const [label, img] of attempts) {
    const result = tryDecode(img.data, img.width, img.height);
    const status = result !== null ? `✅ THÀNH CÔNG -> "${result}"` : '❌ không đọc được';
    console.log(`${status}   (${label})`);
    if (result !== null) anySuccess = true;
  }

  console.log('\n' + (anySuccess
    ? '🎉 Có ít nhất 1 cách đọc được -> áp dụng đúng cách đó vào script seed chính thức.'
    : '⛔ KHÔNG cách nào đọc được -> nhiều khả năng ảnh không phải QR chuẩn (lỗi từ khâu tạo ảnh), cần kiểm tra công cụ generate QR gốc.'));
}

main().catch((e) => {
  console.error('Lỗi:', e);
  process.exit(1);
});