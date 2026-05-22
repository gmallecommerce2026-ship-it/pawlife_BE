import { PrismaClient, PetSize } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🎲 Bắt đầu gán Size ngẫu nhiên cho toàn bộ Pet...");

  // Lấy toàn bộ Pet
  const pets = await prisma.pet.findMany({
    select: { id: true, name: true }
  });

  const sizes = [PetSize.SMALL, PetSize.MEDIUM, PetSize.LARGE];
  let count = 0;

  for (const pet of pets) {
    // Chọn ngẫu nhiên một giá trị từ mảng sizes
    const randomSize = sizes[Math.floor(Math.random() * sizes.length)];

    await prisma.pet.update({
      where: { id: pet.id },
      data: { size: randomSize },
    });

    count++;
    if (count % 10 === 0) console.log(`...đã cập nhật ${count}/${pets.length} bé`);
  }

  console.log(`✨ Hoàn tất! Đã cập nhật ngẫu nhiên cho ${count} thú cưng.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });