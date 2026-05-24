import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Danh sách các tính cách có thể có
const POSSIBLE_TRAITS = [
  'Playful', 'Clingy', 'Friendly', 'Quiet', 'Active', 
  'Smart', 'Lazy', 'Curious', 'Shy', 'Loud', 'Gentle',
  'Loyal', 'Independent', 'Energetic', 'Calm'
];

// Hàm trộn và lấy ngẫu nhiên n phần tử từ mảng
function getRandomTraits(count: number) {
  const shuffled = [...POSSIBLE_TRAITS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function main() {
  console.log('🌱 Bắt đầu random traits (tính cách) cho TOÀN BỘ thú cưng trong hệ thống...');

  // 1. Lấy danh sách toàn bộ Pet trong database
  const pets = await prisma.pet.findMany({
    select: { id: true, name: true }
  });

  if (pets.length === 0) {
    console.log('⚠️ Không tìm thấy thú cưng nào trong hệ thống!');
    return;
  }

  console.log(`👉 Tìm thấy ${pets.length} thú cưng. Đang tiến hành cập nhật...`);

  // 2. Vòng lặp cập nhật cho từng bé
  for (const pet of pets) {
    // Random số lượng traits từ 2 đến 3
    const numTraits = Math.floor(Math.random() * 2) + 2; 
    const randomSelectedTraits = getRandomTraits(numTraits);

    await prisma.pet.update({
      where: { id: pet.id },
      data: {
        traitsList: {
          // Xóa toàn bộ traits cũ của bé này (để tránh trùng lặp nếu chạy file nhiều lần)
          deleteMany: {}, 
          // Tạo mới các traits vừa random
          create: randomSelectedTraits.map(traitName => ({ name: traitName }))
        }
      }
    });

    console.log(`✅ Đã cập nhật cho bé [${pet.name}] các tính cách: ${randomSelectedTraits.join(', ')}`);
  }

  console.log('🎉 HOÀN TẤT! Toàn bộ thú cưng đã được gắn tính cách ngẫu nhiên.');
}

main()
  .catch((e) => {
    console.error('❌ Có lỗi xảy ra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });