import { PrismaClient, PetSize } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Bắt đầu cập nhật dữ liệu Size cho Pet...");

  // Lấy tất cả thú cưng
  const pets = await prisma.pet.findMany();

  for (const pet of pets) {
    if (!pet.weight) continue;

    let newSize: PetSize = PetSize.MEDIUM; // Mặc định là vừa

    // Logic phân loại size
    if (pet.weight < 5) {
      newSize = PetSize.SMALL;
    } else if (pet.weight > 15) {
      newSize = PetSize.LARGE;
    } else {
      newSize = PetSize.MEDIUM;
    }

    // Cập nhật vào DB
    await prisma.pet.update({
      where: { id: pet.id },
      data: { size: newSize },
    });

    console.log(`✅ Đã cập nhật ${pet.name} (${pet.weight}kg) -> ${newSize}`);
  }

  console.log("✨ Hoàn tất cập nhật Size cho toàn bộ Pet!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });