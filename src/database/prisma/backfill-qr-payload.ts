// scripts/backfill-qr-payload.ts
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import sharp from 'sharp';
import jsQR from 'jsqr';

const prisma = new PrismaClient();
const R2 = process.env.R2_PUBLIC_URL ?? 'https://pub-35c6d59c9e96467b9783df2a4e890a09.r2.dev';

async function decode(tagId: string): Promise<string | null> {
  const res = await axios.get<ArrayBuffer>(`${R2}/qr-codes/${tagId}.png`, {
    responseType: 'arraybuffer',
    timeout: 8000,
  });
  const src = Buffer.from(res.data);

  for (const width of [600, 1000]) {
    const { data, info } = await sharp(src)
      .flatten({ background: '#ffffff' })
      .extend({ top: 40, bottom: 40, left: 40, right: 40, background: '#ffffff' })
      .resize({ width, kernel: 'nearest' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code?.data) return code.data;
  }
  return null;
}

async function main() {
  const tags = await prisma.tag.findMany({ where: { qrPayload: null }, select: { id: true } });
  let same = 0, different = 0, failed = 0;

  for (const tag of tags) {
    try {
      const payload = await decode(tag.id);
      if (!payload) { failed++; console.warn('❌ Không giải mã được:', tag.id); continue; }
      await prisma.tag.update({ where: { id: tag.id }, data: { qrPayload: payload } });
      payload === tag.id ? same++ : different++;
      if (payload !== tag.id && different <= 3) console.log('Mẫu payload ≠ id:', payload);
    } catch (e) {
      failed++;
      console.warn('❌ Lỗi tải/giải mã:', tag.id, e instanceof Error ? e.message : e);
    }
  }
  console.log({ total: tags.length, payloadBangId: same, payloadKhacId: different, thatBai: failed });
}

main().finally(() => prisma.$disconnect());