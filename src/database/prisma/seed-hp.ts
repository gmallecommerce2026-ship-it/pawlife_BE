// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu chạy Seed cập nhật tên trạm...');

  // 1. Tìm tất cả các trạm có tên chứa chữ "havepaws" (không phân biệt hoa thường)
  const shelters = await prisma.shelter.findMany({
    where: {
      name: {
        contains: 'havepaws',
      },
    },
  });

  if (shelters.length > 0) {
    // 2. Lặp qua và cập nhật tên thành "HavePaws" đúng chuẩn
    for (const shelter of shelters) {
      const updatedShelter = await prisma.shelter.update({
        where: { id: shelter.id },
        data: {
          name: 'HavePaws', // 🚀 Đổi tên chuẩn tại đây
        },
      });
      console.log(`✅ Đã CẬP NHẬT tên trạm (ID: ${shelter.id}) thành: "${updatedShelter.name}"`);
    }
  } else {
    console.log('⚠️ Không tìm thấy trạm cứu hộ nào có tên "havepaws" để cập nhật.');
  }

  console.log('🎉 Seed dữ liệu hoàn tất!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });