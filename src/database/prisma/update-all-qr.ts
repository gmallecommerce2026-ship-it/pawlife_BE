import { PrismaClient, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu kiểm tra và cập nhật QR Code cho TOÀN BỘ thú cưng...');

  // 1. Lấy tất cả thú cưng đang chưa có QR Code
  const petsWithoutQR = await prisma.pet.findMany({
    where: {
      qrCodeUrl: null,
    }
  });

  if (petsWithoutQR.length === 0) {
    console.log('Tất cả thú cưng đều đã có QR Code. Không cần cập nhật thêm.');
    return;
  }

  console.log(`Tìm thấy ${petsWithoutQR.length} bé thú cưng cần cập nhật QR Code.`);

  // 2. Lặp qua từng bé để tạo QR Code và gắn Tag
  for (const pet of petsWithoutQR) {
    // Lấy 8 ký tự đầu của ID làm mã Tag giả lập
    const tagId = `tag-${pet.id.substring(0, 8)}`; 
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=pawlife://tag/${tagId}`;

    // Cập nhật Pet với URL ảnh QR và tự động cho Verify thành công
    await prisma.pet.update({
      where: { id: pet.id },
      data: {
        qrCodeUrl: qrUrl,
        qrVerificationStatus: VerificationStatus.VERIFIED,
      }
    });

    // Bổ sung luôn thẻ Tag vào DB để đảm bảo luồng Fallback hoạt động
    const existingTag = await prisma.tag.findFirst({ where: { petId: pet.id } });
    if (!existingTag) {
      await prisma.tag.create({
        data: {
          id: tagId,
          status: 'ACTIVE',
          petId: pet.id
        }
      });
    }

    console.log(`✅ Đã seed QR Code thành công cho bé: ${pet.name}`);
  }

  console.log('🎉 Hoàn tất cập nhật mã QR cho toàn bộ hệ thống!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi cập nhật QR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });