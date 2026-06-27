// src/database/prisma/update-medical-records-verified.ts
import { PrismaClient, VerificationStatus } from '@prisma/client';
import Redis from 'ioredis'; // hoặc import đúng theo cách RedisService của bạn khởi tạo client

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL); // chỉnh theo config thật của bạn

const VERIFIED_RATIO = 0.5;

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  console.log('Bắt đầu cập nhật trạng thái verification cho Medical Record...');

  // Lấy kèm petId để biết cache key nào cần xoá
  const medicalRecords = await prisma.medicalRecord.findMany({
    select: { id: true, type: true, verificationStatus: true, petId: true },
  });

  if (medicalRecords.length === 0) {
    console.log('Không có Medical Record nào trong database để cập nhật.');
    return;
  }

  const shuffled = shuffle(medicalRecords);
  const verifyCount = Math.round(shuffled.length * VERIFIED_RATIO);
  const recordsToVerify = shuffled.slice(0, verifyCount);
  const idsToVerify = recordsToVerify.map((r) => r.id);

  console.log(`- Tổng số Medical Record: ${shuffled.length}`);
  console.log(`- Số lượng sẽ chuyển sang VERIFIED: ${idsToVerify.length} (${VERIFIED_RATIO * 100}%)`);

  const result = await prisma.medicalRecord.updateMany({
    where: { id: { in: idsToVerify } },
    data: { verificationStatus: VerificationStatus.VERIFIED },
  });

  console.log(`\n✅ Thành công! Đã cập nhật ${result.count} Medical Record sang trạng thái VERIFIED.`);

  // ===== QUAN TRỌNG: xoá cache pet:detail cho TẤT CẢ pet bị ảnh hưởng =====
  const affectedPetIds = [...new Set(recordsToVerify.map((r) => r.petId))];
  for (const petId of affectedPetIds) {
    await redis.del(`pet:detail:${petId}`);
  }
  console.log(`🧹 Đã xoá cache pet:detail cho ${affectedPetIds.length} pet bị ảnh hưởng.`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi cập nhật trạng thái Medical Record:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });