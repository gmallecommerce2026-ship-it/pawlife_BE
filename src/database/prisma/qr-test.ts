// src/database/prisma/qr-test.ts
// chạy: npx ts-node --transpile-only src/database/prisma/qr-test.ts PL-00461
import QRCode from 'qrcode';

async function main() {
  const payload = process.argv[2];
  if (!payload) throw new Error('Thiếu payload: ... qr-test.ts <payload>');

  const isAlnum = /^[0-9A-Z $%*+\-./:]+$/.test(payload); // alphanumeric không có chữ thường và dấu _

  for (const level of ['L', 'M', 'Q', 'H'] as const) {
    // Chế độ byte: data phải là Buffer
    await QRCode.toFile(
      `qr-test-byte-${level}.png`,
      [{ data: Buffer.from(payload, 'latin1'), mode: 'byte' }],
      { errorCorrectionLevel: level, margin: 4, scale: 10 },
    );

    // Chế độ alphanumeric: chỉ tạo nếu payload hợp lệ
    if (isAlnum) {
      await QRCode.toFile(
        `qr-test-alnum-${level}.png`,
        [{ data: payload, mode: 'alphanumeric' }],
        { errorCorrectionLevel: level, margin: 4, scale: 10 },
      );
    }
  }
  console.log('Xong. Alphanumeric:', isAlnum ? 'đã tạo' : 'bỏ qua (payload có ký tự không hợp lệ)');
}
main();