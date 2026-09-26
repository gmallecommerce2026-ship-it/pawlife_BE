import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Bắt đầu chạy script cập nhật và kiểm tra dữ liệu...\n');

  // ============================================================
  // 1. CẬP NHẬT MẬT KHẨU CHO USER
  // ============================================================
  const targetEmail = 'hellopawlife@gmail.com';
  const NEW_PASSWORD = 'NewPawlifePassword@2026'; // Đổi mật khẩu mới tại đây
  const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

  try {
    const updatedUser = await prisma.user.update({
      where: { email: targetEmail },
      data: { password: hashedPassword },
    });
    console.log(`✅ Đã cập nhật mật khẩu thành công cho tài khoản: ${updatedUser.email}`);
    console.log(`🔑 Mật khẩu mới là: ${NEW_PASSWORD}\n`);
  } catch (error) {
    console.log(`⚠️ Không thể cập nhật mật khẩu. Có thể tài khoản ${targetEmail} chưa được tạo trong DB.`);
  }

  // ============================================================
  // 2. KIỂM TRA DANH SÁCH SHELTER TRONG HỆ THỐNG
  // ============================================================
  console.log('--- 📋 DANH SÁCH SHELTER HIỆN CÓ TRONG HỆ THỐNG ---');
  
  const allShelters = await prisma.shelter.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      emailAddress: true,
      isVerified: true,
    },
  });

  if (allShelters.length === 0) {
    console.log('Trống! Chưa có shelter nào trong cơ sở dữ liệu.');
  } else {
    // In ra dưới dạng bảng cho dễ nhìn
    console.table(allShelters);
    console.log(`\n📊 Tổng cộng có: ${allShelters.length} shelter.`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Lỗi trong quá trình chạy script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });