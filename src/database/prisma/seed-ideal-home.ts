import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const idealHomeOptions = [
  "A quiet home with no small children or other pets.",
  "An active family who loves outdoors and hiking.",
  "A cozy apartment with a warm lap to snuggle on.",
  "A home with a securely fenced yard for running.",
  "Experienced pet owners who can continue training.",
  "A calm environment with older kids.",
  "Someone who works from home or is around often.",
  "A multi-pet household where they can have a playmate.",
  "A patient owner willing to give them time to adjust.",
  "A loving family looking for a loyal companion.",
  "A home with plenty of indoor space for playtime.",
  "Someone looking for a couch potato to watch movies with.",
  "A rural setting with lots of space to explore safely."
];

async function main() {
  console.log('Bắt đầu seeding Ideal Home...');

  const pets = await prisma.pet.findMany();
  console.log(`Tìm thấy ${pets.length} thú cưng. Đang tiến hành cập nhật...`);

  let updatedCount = 0;

  for (const pet of pets) {
    // Lấy ngẫu nhiên 1 mô tả môi trường sống lý tưởng
    const randomIdealHome = idealHomeOptions[Math.floor(Math.random() * idealHomeOptions.length)];

    await prisma.pet.update({
      where: { id: pet.id },
      data: {
        idealHome: randomIdealHome,
      },
    });
    
    updatedCount++;
    if (updatedCount % 50 === 0) {
        console.log(`Đã cập nhật ${updatedCount}/${pets.length} thú cưng...`);
    }
  }

  console.log('✅ Seeding Ideal Home thành công cho toàn bộ thú cưng!');
}

main()
  .catch((e) => {
    console.error('❌ Có lỗi xảy ra trong quá trình seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
