import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const goodWithOptions = ['Dogs', 'Cats', 'Kids', 'Seniors', 'Other Pets', 'Strangers', 'Large crowds', 'Car rides'];
const badWithOptions = ['Cats', 'Small children', 'Loud noises', 'Other dogs', 'Small animals', 'Being left alone', 'Fast movements', 'Thunderstorms'];

function getRandomItems(array: string[], maxItems: number): string[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.floor(Math.random() * maxItems) + 1);
}

async function main() {
  console.log('Bắt đầu seeding Pet Behaviors (goodWith, badWith)...');

  const pets = await prisma.pet.findMany();
  console.log(`Tìm thấy ${pets.length} thú cưng. Đang tiến hành cập nhật...`);

  let updatedCount = 0;

  for (const pet of pets) {
    // Lấy ngẫu nhiên 1-3 đặc điểm goodWith
    const goodWith = getRandomItems(goodWithOptions, 3);
    
    // 60% tỉ lệ có đặc điểm badWith
    const hasBadWith = Math.random() > 0.4; 
    let badWith: string[] = [];
    
    if (hasBadWith) {
      const rawBadWith = getRandomItems(badWithOptions, 2);
      // Lọc logic cơ bản để không bị mâu thuẫn giữa Tốt và Xấu
      badWith = rawBadWith.filter(item => {
         if (item === 'Other dogs' && goodWith.includes('Dogs')) return false;
         if (item === 'Cats' && goodWith.includes('Cats')) return false;
         if (item === 'Small children' && goodWith.includes('Kids')) return false;
         return true;
      });
    }

    await prisma.pet.update({
      where: { id: pet.id },
      data: {
        goodWith: goodWith,
        badWith: badWith.length > 0 ? badWith : [], 
      },
    });
    
    updatedCount++;
    if (updatedCount % 50 === 0) {
        console.log(`Đã cập nhật ${updatedCount}/${pets.length} thú cưng...`);
    }
  }

  console.log('✅ Seeding Behavior thành công cho toàn bộ thú cưng!');
}

main()
  .catch((e) => {
    console.error('❌ Có lỗi xảy ra trong quá trình seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
