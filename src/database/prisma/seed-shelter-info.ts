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
  const shelterNames = ['Pawlife (HN)', 'Pawlife (HCM)', 'Pawlife (ĐN)'];
  const addresses = ['Hà Nội, Việt Nam', 'HCM việt nam', 'Đà nẵng Việt nam'];
  const bio = 'Đồng hành cùng hành trình tìm mái ấm của các bé bốn chân.';
  const intro = 'PawLife xây dựng cầu nối giữa trạm cứu hộ và người nhận nuôi trong một hệ sinh thái minh bạch. Từ danh tính số đến lịch sử thú cưng, mọi thông tin đều được ghi nhận để đảm bảo mỗi quyết định nhận nuôi là đúng đắn và có trách nhiệm.';
  
  // Gộp Bio và Phần giới thiệu vào chung field description
  const fullDescription = `${bio}\n\n${intro}`;

  // 3. Lặp và cập nhật từng shelter
  for (let i = 0; i < shelters.length; i++) {
    const shelter = shelters[i];
    const shelterName = shelterNames[i] || shelterNames[0];
    const shelterAddress = addresses[i] || addresses[0]; 

    await prisma.shelter.update({
      where: { id: shelter.id },
      data: {
        name: shelterName, // Cập nhật tên mới
        emailAddress: 'hello@pawlife.vn',
        contactInfo: '0913884409',
        address: shelterAddress,
        description: fullDescription,
        avatarUrl: 'shelter-avatar.jpg',
        coverUrl: 'shelter-cover.jpg',
      }
    });
    
    console.log(`✅ Đã cập nhật Shelter: Từ [${shelter.name}] thành [${shelterName}] - Địa chỉ: ${shelterAddress}`);
  }

  console.log('🎉 Hoàn tất cập nhật thông tin và đổi tên cho 3 shelters!');
}

main()
  .catch((e) => {
    console.error('Lỗi trong quá trình chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });