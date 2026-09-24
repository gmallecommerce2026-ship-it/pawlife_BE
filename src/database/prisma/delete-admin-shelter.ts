import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const TARGET_EMAIL = 'admin@pawlife.vn';
  console.log(`🧹 Bắt đầu dọn dẹp tài khoản và trạm của: ${TARGET_EMAIL}`);

  try {
    // 1. Tìm User dựa trên email
    const userToDelete = await prisma.user.findUnique({
      where: { email: TARGET_EMAIL },
      select: { id: true, shelterId: true, name: true }, // Chỉ lấy các trường cần thiết
    });

    if (!userToDelete) {
      console.log(`⚠️ Không tìm thấy tài khoản nào với email: ${TARGET_EMAIL}`);
      return;
    }

    console.log(`🔍 Tìm thấy User: ${userToDelete.name} (ID: ${userToDelete.id})`);

    // 2. Xóa User trước để gỡ liên kết (tránh lỗi Foreign Key constraint)
    await prisma.user.delete({
      where: { id: userToDelete.id },
    });
    console.log(`✅ Đã xóa thành công tài khoản User: ${TARGET_EMAIL}`);

    // 3. Xóa Shelter liên kết với tài khoản này (nếu có)
    if (userToDelete.shelterId) {
      const deletedShelter = await prisma.shelter.delete({
        where: { id: userToDelete.shelterId },
      });
      console.log(`✅ Đã xóa thành công Trạm cứu hộ: ${deletedShelter.name}`);
    } else {
      console.log(`ℹ️ Tài khoản này không sở hữu Trạm cứu hộ nào.`);
    }

    console.log('🎉 Hoàn tất quá trình dọn dẹp!');
  } catch (error) {
    console.error('❌ Lỗi trong quá trình xóa dữ liệu:', error);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });