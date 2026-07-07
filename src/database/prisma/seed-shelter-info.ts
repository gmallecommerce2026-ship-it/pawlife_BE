import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu cập nhật thông tin Shelters...');

  // 1. Lấy danh sách các shelter hiện tại, loại trừ shelter có chứa từ "foster"
  const shelters = await prisma.shelter.findMany({
    where: {
      NOT: {
        name: {
          contains: 'foster',
        },
      },
    },
    take: 3, // Giới hạn lấy 3 shelter theo yêu cầu
    orderBy: {
      createdAt: 'asc' // Sắp xếp theo ngày tạo để nhất quán thứ tự
    }
  });

  if (shelters.length === 0) {
    console.log('❌ Không tìm thấy shelter nào phù hợp để cập nhật.');
    return;
  }

  // 2. Chuẩn bị dữ liệu cập nhật
  const addresses = ['Hà Nội, Việt Nam', 'HCM việt nam', 'Đà nẵng Việt nam'];
  const bio = 'Đồng hành cùng hành trình tìm mái ấm của các bé bốn chân.';
  const intro = 'PawLife xây dựng cầu nối giữa trạm cứu hộ và người nhận nuôi trong một hệ sinh thái minh bạch. Từ danh tính số đến lịch sử thú cưng, mọi thông tin đều được ghi nhận để đảm bảo mỗi quyết định nhận nuôi là đúng đắn và có trách nhiệm.';
  
  // Gộp Bio và Phần giới thiệu vào chung field description
  const fullDescription = `${bio}\n\n${intro}`;

  // 3. Lặp và cập nhật từng shelter
  for (let i = 0; i < shelters.length; i++) {
    const shelter = shelters[i];
    const shelterAddress = addresses[i] || addresses[0]; // Dự phòng nếu mảng thiếu

    await prisma.shelter.update({
      where: { id: shelter.id },
      data: {
        emailAddress: 'hello@pawlife.vn',
        contactInfo: '0913884409',
        address: shelterAddress,
        description: fullDescription,
        // Ghi chú: Nếu hệ thống bạn dùng Cloudflare R2 (tôi thấy có r2.service.ts), 
        // bạn có thể đổi chuỗi này thành URL public đầy đủ, ví dụ: 'https://cdn.pawlife.vn/shelter-avatar.jpg'
        // Ở đây tạm lưu theo tên file bạn vừa đặt vào prisma/data/images/
        avatarUrl: 'shelter-avatar.jpg',
        coverUrl: 'shelter-cover.jpg',
      }
    });
    
    console.log(`✅ Đã cập nhật Shelter: [${shelter.name}] - Địa chỉ được gán: ${shelterAddress}`);
  }

  console.log('🎉 Hoàn tất cập nhật thông tin cho 3 shelters!');
}

main()
  .catch((e) => {
    console.error('Lỗi trong quá trình chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });