import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu tạo Tag (QR Code) cho thú cưng...');

  // Lấy tất cả thú cưng chưa có Tag nào (mảng tags rỗng)
  const petsWithoutTag = await prisma.pet.findMany({
    where: {
      tags: {
        none: {} 
      },
    },
  });

  if (petsWithoutTag.length === 0) {
    console.log('Tất cả thú cưng đều đã có QR Code.');
    return;
  }

  for (const pet of petsWithoutTag) {
    // Không cần truyền id/uid vì Prisma sẽ tự động sinh UUID theo @default(uuid())
    await prisma.tag.create({
      data: {
        petId: pet.id,
        status: 'ACTIVE', // Cài đặt mặc định là vòng cổ đang hoạt động
      },
    });
    console.log(`✅ Đã tạo QR Code cho bé: ${pet.name}`);
  }

  console.log('Hoàn tất seed QR Code!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });