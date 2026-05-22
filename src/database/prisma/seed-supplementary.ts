import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Danh sách tọa độ và địa chỉ giả định (Khu vực Hà Nội) để thuật toán tìm kiếm Nearby hoạt động tốt
const mockLocations = [
  { address: "123 Đường Láng, Đống Đa, Hà Nội", lat: 21.0166, lng: 105.8115 },
  { address: "456 Nguyễn Trãi, Thanh Xuân, Hà Nội", lat: 20.9937, lng: 105.8083 },
  { address: "789 Cầu Giấy, Quan Hoa, Hà Nội", lat: 21.0333, lng: 105.7958 },
  { address: "101 Kim Mã, Ba Đình, Hà Nội", lat: 21.0311, lng: 105.8197 },
  { address: "202 Hai Bà Trưng, Hoàn Kiếm, Hà Nội", lat: 21.0254, lng: 105.8512 },
  { address: "55 Lê Lợi, Hà Đông, Hà Nội", lat: 20.9702, lng: 105.7725 },
];

async function main() {
  console.log('🚀 Bắt đầu bổ sung dữ liệu (Contact Info, Verified, Location, Organizer)...');

  // 1. Lấy tất cả Shelter hiện tại
  const shelters = await prisma.shelter.findMany();
  
  if (shelters.length === 0) {
    console.log('⚠️ Không tìm thấy Shelter nào trong DB. Vui lòng chạy file seed cũ trước.');
    return;
  }

  // Cập nhật từng Shelter để đổ dữ liệu
  for (let i = 0; i < shelters.length; i++) {
    const shelter = shelters[i];
    
    // Tạo data giả định cho email
    const emailDomain = shelter.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pawlife';
    const isVerified = Math.random() > 0.3; // 70% cơ hội được verify

    // Random ngày tham gia trong khoảng 1-2 năm trước
    const joinDate = new Date();
    joinDate.setFullYear(joinDate.getFullYear() - 1 - Math.floor(Math.random() * 2));
    const verifyDate = new Date(joinDate);
    verifyDate.setMonth(verifyDate.getMonth() + 1);

    // Lấy một location ngẫu nhiên (xoay vòng theo index để đảm bảo đa dạng)
    const location = mockLocations[i % mockLocations.length];

    await prisma.shelter.update({
      where: { id: shelter.id },
      data: {
        emailAddress: `contact@${emailDomain}.com`,
        isVerified: isVerified,
        createdAt: joinDate,
        verifiedAt: isVerified ? verifyDate : null,
        // BỔ SUNG LOCATION VÀ TỌA ĐỘ
        address: location.address,
        latitude: location.lat,
        longitude: location.lng,
      },
    });
    console.log(`✅ Đã cập nhật Contact & Location cho: ${shelter.name}`);
  }

  // 2. Cập nhật các Event chưa có Organizer (shelterId = null)
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