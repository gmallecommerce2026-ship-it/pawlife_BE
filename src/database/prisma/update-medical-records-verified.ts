// src/database/prisma/update-medical-records-verified.ts
import { PrismaClient, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Tỷ lệ % medical record sẽ được chuyển sang VERIFIED (0.5 = 50%)
const VERIFIED_RATIO = 0.5;

/**
 * Xáo trộn mảng theo Fisher-Yates để chọn ngẫu nhiên record cần verify,
 * tránh việc luôn verify các record được tạo đầu tiên (data test sẽ thiên lệch)
 */
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

  // 1. Lấy toàn bộ medical record hiện có (chỉ select id + status hiện tại cho nhẹ)
  const medicalRecords = await prisma.medicalRecord.findMany({
    select: { id: true, type: true, verificationStatus: true },
  });

  if (medicalRecords.length === 0) {
    console.log('Không có Medical Record nào trong database để cập nhật.');
    return;
  }

  // 2. Xáo trộn ngẫu nhiên rồi cắt lấy đúng 50%
  const shuffled = shuffle(medicalRecords);
  const verifyCount = Math.round(shuffled.length * VERIFIED_RATIO);
  const recordsToVerify = shuffled.slice(0, verifyCount);
  const idsToVerify = recordsToVerify.map((r) => r.id);

  console.log(`- Tổng số Medical Record: ${shuffled.length}`);
  console.log(`- Số lượng sẽ chuyển sang VERIFIED: ${idsToVerify.length} (${VERIFIED_RATIO * 100}%)`);

  // 3. Update đồng loạt (updateMany nhanh hơn nhiều so với loop update từng cái)
  const result = await prisma.medicalRecord.updateMany({
    where: { id: { in: idsToVerify } },
    data: { verificationStatus: VerificationStatus.VERIFIED },
  });

  console.log(`\n✅ Thành công! Đã cập nhật ${result.count} Medical Record sang trạng thái VERIFIED.`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi cập nhật trạng thái Medical Record:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });