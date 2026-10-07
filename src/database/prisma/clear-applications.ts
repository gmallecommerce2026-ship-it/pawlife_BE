/**
 * Script xoá toàn bộ đơn nhận nuôi (AdoptionApplication) của một Shelter cụ thể.
 * 
 * Cách chạy:
 * npx ts-node src/database/clear-applications.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shelterName = "Sân Nhà Nhiều Chó"; // Đổi tên nếu cần thiết
  
  console.log(`🚀 Bắt đầu quá trình dọn dẹp đơn nhận nuôi của trạm "${shelterName}"...`);

  // 1. Tìm Shelter theo tên
  const shelter = await prisma.shelter.findFirst({
    where: { 
      name: {
        contains: shelterName // Dùng contains để tránh sai lệch do khoảng trắng thừa
      }
    }
  });

  if (!shelter) {
    console.error(`❌ Không tìm thấy trạm cứu hộ nào có tên chứa "${shelterName}". Vui lòng kiểm tra lại.`);
    process.exitCode = 1;
    return;
  }

  console.log(`✅ Đã tìm thấy trạm: ${shelter.name} (ID: ${shelter.id})`);

  // 2. Đếm số lượng Application đang tồn tại của Shelter này
  const applicationCount = await prisma.adoptionApplication.count({
    where: {
      pet: {
        shelterId: shelter.id
      }
    }
  });

  if (applicationCount === 0) {
    console.log(`✨ Trạm "${shelter.name}" hiện không có đơn nhận nuôi nào. Không cần dọn dẹp.`);
    return;
  }

  console.log(`🔎 Tìm thấy tổng cộng ${applicationCount} đơn nhận nuôi (cả PENDING, REJECTED,...). Đang tiến hành xoá...`);

  // 3. Tiến hành xoá toàn bộ
  // Lưu ý: Các record ăn theo (ApplicationNote, ApplicationDocument, Appointment, Tags...) 
  // sẽ tự động bị xoá sạch nhờ thiết lập onDelete: Cascade trong schema
  const result = await prisma.adoptionApplication.deleteMany({
    where: {
      pet: {
        shelterId: shelter.id
      }
    }
  });

  console.log(`🎉 HOÀN TẤT! Đã xoá thành công ${result.count} đơn nhận nuôi và toàn bộ rác liên quan.`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });