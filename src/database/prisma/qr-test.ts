// qr-test.ts, chạy: npx ts-node qr-test.ts PL-00461
import QRCode from 'qrcode';

async function main() {
  const payload = process.argv[2];
  for (const level of ['L', 'M', 'Q', 'H'] as const) {
    await QRCode.toFile(
      `qr-test-${level}.png`,
      [{ data: payload, mode: 'byte' }], // ép byte để giống cách Wallet mã hoá
      { errorCorrectionLevel: level, margin: 4, scale: 10 },
    );
  }
}
main();