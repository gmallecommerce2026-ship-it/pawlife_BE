import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Hàm tạo ngày sinh ngẫu nhiên (từ 6 tháng đến 5 tuổi)
function getRandomDob(): Date {
  const now = new Date();
  const yearsToSubtract = Math.floor(Math.random() * 5); // 0 đến 4 năm
  const monthsToSubtract = Math.floor(Math.random() * 12) + 1; // 1 đến 12 tháng
  
  now.setFullYear(now.getFullYear() - yearsToSubtract);
  now.setMonth(now.getMonth() - monthsToSubtract);
  return now;
}

async function main() {
  console.log('⏳ Bắt đầu quét và cập nhật ngày sinh (dob) cho toàn bộ Pet...');
  
  // Lấy danh sách toàn bộ Pet
  const pets = await prisma.pet.findMany();
  let updatedCount = 0;

  for (const pet of pets) {
    // Chỉ cập nhật cho những bé bị thiếu dob (bị null)
    // Nếu bạn muốn RESET dob cho TẤT CẢ, hãy bỏ câu lệnh if (!pet.dob) này đi
    if (!pet.dob) {
      const newDob = getRandomDob();
      await prisma.pet.update({
        where: { id: pet.id },
        data: { dob: newDob }
      });
      updatedCount++;
      console.log(`✅ Đã cập nhật dob cho bé: ${pet.name} -> ${newDob.toLocaleDateString('vi-VN')}`);
    }
  }

  console.log(`\n🎉 HOÀN TẤT! Đã cập nhật ngày sinh cho ${updatedCount} bé Pet bị thiếu dữ liệu.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Lỗi khi cập nhật dob:', e);
    await prisma.$disconnect();
    process.exit(1);
  });