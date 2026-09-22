// database/scripts/seed-pawpawpaw.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetName = "Pawpawpaw";

  console.log(`Đang tìm kiếm tài khoản Shelter có tên: "${targetName}"...`);

  // 1. Tìm User có tên là Pawpawpaw và có role là SHELTER
  const user = await prisma.user.findFirst({
    where: { 
      name: targetName,
      role: 'SHELTER'
    },
    include: {
      shelter: true
    }
  });

  if (!user || !user.shelterId) {
    console.log(`❌ Không tìm thấy tài khoản SHELTER nào có tên "${targetName}" hoặc tài khoản này chưa liên kết với Trạm nào.`);
    return;
  }

  // 2. Thực hiện duyệt Trạm (Update isVerified = true)
  if (user.shelter?.isVerified) {
    console.log(`✅ Trạm "${user.shelter.name}" của user "${targetName}" đã được duyệt từ trước!`);
  } else {
    await prisma.shelter.update({
      where: { id: user.shelterId },
      data: {
        isVerified: true,
        verifiedAt: new Date(), // Ghi nhận thời gian duyệt
      }
    });
    console.log(`🎉 Đã duyệt thành công Trạm cứu hộ: "${user.shelter?.name}" (Chủ sở hữu: ${targetName}).`);
  }
}

main()
  .catch((e) => {
    console.error("Lỗi trong quá trình chạy Seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });