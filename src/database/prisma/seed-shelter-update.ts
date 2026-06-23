import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Bộ hồ sơ địa điểm thật sát thực tế để phân tán tọa độ, tránh bị trùng khoảng cách
const REAL_LOCATION_POOLS = [
  {
    keyword: 'hà nội',
    locations: [
      { address: 'Số 15, Ngõ 68, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội', lat: 21.036237, lng: 105.790583, phone: '0912345678' },
      { address: 'Số 22, Đường Quảng An, Phường Quảng An, Quận Tây Hồ, Hà Nội', lat: 21.062432, lng: 105.816345, phone: '0911223344' },
      { address: 'Số 8, Đường Yên Sở, Phường Yên Sở, Quận Hoàng Mai, Hà Nội', lat: 20.955091, lng: 105.868285, phone: '0988776655' }
    ]
  },
  {
    keyword: 'hồ chí minh',
    locations: [
      { address: 'Số 45, Đường Nguyễn Cư Trinh, Phường Nguyễn Cư Trinh, Quận 1, TP. Hồ Chí Minh', lat: 10.763456, lng: 106.688123, phone: '0987654321' },
      { address: 'Số 102, Đường Nguyễn Thị Thập, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh', lat: 10.743124, lng: 106.721456, phone: '0909090909' }
    ]
  },
  {
    keyword: 'đà nẵng',
    locations: [
      { address: 'Số 120, Đường Bạch Đằng, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng', lat: 16.071111, lng: 108.224321, phone: '0901112233' }
    ]
  }
];

// Dự phòng nếu trạm không thuộc 3 thành phố trên
const FALLBACK_LOCATIONS = [
  { address: 'Số 50, Phường Nghĩa Đô, Quận Cầu Giấy, Hà Nội', lat: 21.045612, lng: 105.801245, phone: '0955555666' },
  { address: 'Số 12, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', lat: 10.775612, lng: 106.701245, phone: '0966666777' }
];

async function main() {
  console.log('⏳ Bắt đầu quét và tối ưu vị trí, email cho các Shelter...');

  const shelters = await prisma.shelter.findMany();
  let poolIndex = 0;

  for (const shelter of shelters) {
    const shelterNameLower = shelter.name.toLowerCase();
    const shelterAddressLower = shelter.address.toLowerCase();
    
    let selectedLoc = null;

    // Tìm profile địa điểm phù hợp dựa trên tên hoặc địa chỉ cũ của trạm
    for (const pool of REAL_LOCATION_POOLS) {
      if (shelterNameLower.includes(pool.keyword) || shelterAddressLower.includes(pool.keyword)) {
        // Lấy ngẫu nhiên một địa điểm trong pool của thành phố đó
        selectedLoc = pool.locations[Math.floor(Math.random() * pool.locations.length)];
        break;
      }
    }

    // Nếu không khớp từ khóa nào, lấy xoay vòng trong danh sách fallback
    if (!selectedLoc) {
      selectedLoc = FALLBACK_LOCATIONS[poolIndex % FALLBACK_LOCATIONS.length];
      poolIndex++;
    }

    // Tạo email tự động chuẩn chỉnh theo tên trạm nếu chưa có email
    const cleanSlug = shelter.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
      .replace(/[^a-z0-9\s]/g, '')     // Bỏ ký tự đặc biệt
      .replace(/\s+/g, '');            // Viết liền
    const generatedEmail = `${cleanSlug}@pawlife.vn`;

    // 1. Cập nhật thông tin cho Shelter
    const updatedShelter = await prisma.shelter.update({
      where: { id: shelter.id },
      data: {
        address: selectedLoc.address,
        latitude: selectedLoc.lat,
        longitude: selectedLoc.lng,
        contactInfo: shelter.contactInfo === '0999999999' ? selectedLoc.phone : shelter.contactInfo,
        emailAddress: shelter.emailAddress || generatedEmail
      }
    });

    console.log(`🏢 Đã cập nhật Trạm: ${updatedShelter.name}`);
    console.log(`   📍 Địa chỉ: ${updatedShelter.address}`);
    console.log(`   ✉️ Email: ${updatedShelter.emailAddress}`);

    // 2. Đồng bộ trực tiếp thông tin liên hệ chi tiết xuống toàn bộ Pet thuộc Shelter này
    const syncPetsResult = await prisma.pet.updateMany({
      where: { shelterId: shelter.id },
      data: {
        contactName: updatedShelter.name,
        contactPhone: updatedShelter.contactInfo,
        contactAddress: updatedShelter.address
      }
    });

    if (syncPetsResult.count > 0) {
      console.log(`   🐾 Đã đồng bộ địa chỉ mới cho ${syncPetsResult.count} bé pet thuộc trạm này.`);
    }
    console.log('--------------------------------------------------');
  }

  console.log('\n🎉 HOÀN TẤT! Toàn bộ vị trí trạm và thông tin liên hệ của Pet đã được tối ưu chuẩn xác.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0); // Đảm bảo đóng tiến trình, chống deadlock ngầm
  })
  .catch(async (e) => {
    console.error('❌ Lỗi trong quá trình cập nhật vị trí:', e);
    await prisma.$disconnect();
    process.exit(1);
  });