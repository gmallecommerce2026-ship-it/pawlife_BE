// prisma/seed-supplementary.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Bắt đầu bổ sung dữ liệu (Contact Info, Verified, Organizer)...');

  // 1. Lấy tất cả Shelter hiện tại
  const shelters = await prisma.shelter.findMany();
  
  if (shelters.length === 0) {
    console.log('⚠️ Không tìm thấy Shelter nào trong DB. Vui lòng chạy file seed cũ trước.');
    return;
  }

  // Cập nhật từng Shelter để đổ dữ liệu cho tab Contact
  for (const shelter of shelters) {
    // Tạo data giả định có vẻ "thật" dựa trên tên của trạm
    const emailDomain = shelter.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pawlife';
    const isVerified = Math.random() > 0.3; // 70% cơ hội được verify

    // Random ngày tham gia trong khoảng 1-2 năm trước
    const joinDate = new Date();
    joinDate.setFullYear(joinDate.getFullYear() - 1 - Math.floor(Math.random() * 2));
    
    const verifyDate = new Date(joinDate);
    verifyDate.setMonth(verifyDate.getMonth() + 1); // Verify sau khi join 1 tháng

    await prisma.shelter.update({
      where: { id: shelter.id },
      data: {
        emailAddress: `contact@${emailDomain}.com`,
        isVerified: isVerified,
        createdAt: joinDate,
        verifiedAt: isVerified ? verifyDate : null,
      },
    });
    console.log(`✅ Đã cập nhật Contact Info cho Shelter: ${shelter.name}`);
  }

  // 2. Cập nhật các Event chưa có Organizer (shelterId = null)
  // Lấy bừa 1 Shelter làm Organizer mặc định để FE có cái hiển thị
  const defaultOrganizer = shelters[0]; 
  
  const eventsWithoutOrganizer = await prisma.event.findMany({
    where: { shelterId: null },
  });

  for (const event of eventsWithoutOrganizer) {
    await prisma.event.update({
      where: { id: event.id },
      data: {
        shelterId: defaultOrganizer.id,
      },
    });
    console.log(`✅ Đã gán Organizer (${defaultOrganizer.name}) cho Event: ${event.title}`);
  }

  console.log('🎉 Hoàn tất quá trình bổ sung dữ liệu!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi chạy seed bổ sung:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });