import { PrismaClient, VerificationStatus } from '@prisma/client';
import { randomUUID } from 'crypto'; // Import hàm tạo UUID chuẩn của Node.js

const prisma = new PrismaClient();

// Hàm kiểm tra xem chuỗi có phải là UUID hợp lệ không
const isUUID = (str: string) => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

async function main() {
  console.log('Bắt đầu dọn dẹp và cập nhật QR Code chuẩn UUID...');

  const allPets = await prisma.pet.findMany();

  for (const pet of allPets) {
    const existingTags = await prisma.tag.findMany({ where: { petId: pet.id } });

    // 1. Xóa các Tag bị lỗi định dạng (ví dụ: 'luna-lost-tag-id')
    const invalidTags = existingTags.filter(tag => !isUUID(tag.id));
    if (invalidTags.length > 0) {
      await prisma.tag.deleteMany({
        where: { id: { in: invalidTags.map(t => t.id) } }
      });
    }

    // 2. Nếu Pet chưa có Tag chuẩn UUID, tiến hành tạo mới
    const hasValidTag = existingTags.some(tag => isUUID(tag.id));
    if (!hasValidTag) {
      const newUuidTag = randomUUID(); // TẠO MÃ UUID CHUẨN
      
      // Tạo URL mã QR chứa UUID mới
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=pawlife://tag/${newUuidTag}`;

      // Cập nhật lại Pet với URL ảnh QR mới
      await prisma.pet.update({
        where: { id: pet.id },
        data: {
          qrCodeUrl: qrUrl,
          qrVerificationStatus: VerificationStatus.VERIFIED,
        }
      });

      // Tạo thẻ Tag chuẩn
      await prisma.tag.create({
        data: {
          id: newUuidTag,
          status: pet.status === 'LOST' ? 'LOST' : 'ACTIVE',
          petId: pet.id
        }
      });

      console.log(`✅ Đã cập nhật Tag UUID hợp lệ cho bé: ${pet.name}`);
    } else {
      console.log(`⏩ Bé ${pet.name} đã có mã UUID chuẩn, bỏ qua.`);
    }
  }

  console.log('🎉 Hoàn tất cập nhật mã QR chuẩn hệ thống!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi cập nhật QR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });