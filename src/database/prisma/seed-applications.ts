import { PrismaClient, ApplicationStatus, Pet } from '@prisma/client';

const prisma = new PrismaClient();

// Hàm Helper để tính lùi thời gian (Tạo ngày sinh giả lập)
// Ví dụ: getPastDate(2, 6) => Ngày này của 2 năm 6 tháng trước
const getPastDate = (years: number, months: number = 0) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  date.setMonth(date.getMonth() - months);
  return date;
};

async function main() {
  console.log('🌱 Bắt đầu seed 7 trạng thái Adoption Applications...');

  // =====================================================================
  // BƯỚC 0: REFRESH DỮ LIỆU (DỌN DẸP SẠCH SẼ NHƯ MỚI)
  // =====================================================================
  console.log('🧹 Đang dọn dẹp dữ liệu cũ (Applications, Pets, Images)...');
  
  // 1. Xóa TOÀN BỘ đơn đăng ký nhận nuôi (Refresh toàn bộ Application)
  await prisma.adoptionApplication.deleteMany({});
  
  // 2. Định nghĩa sẵn ID của 7 con Pet để dễ dàng xóa & tạo lại
  const mockPetIds = [
    'pet-milo-001', 'pet-luna-002', 'pet-bella-003', 'pet-simba-004', 
    'pet-max-005', 'pet-daisy-006', 'pet-charlie-007'
  ];

  // 3. Xóa ảnh và Pet cũ tương ứng với các ID trên
  await prisma.petImage.deleteMany({ where: { petId: { in: mockPetIds } } });
  await prisma.pet.deleteMany({ where: { id: { in: mockPetIds } } });

  console.log('✅ Đã dọn dẹp xong. Bắt đầu tạo dữ liệu mới tinh...');


  // =====================================================================
  // BƯỚC 1: TẠO USER TEST
  // =====================================================================
  const testUser = await prisma.user.upsert({
    where: { email: 'hello@pawlife.vn' },
    update: {
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/png?seed=AnDev&size=256', 
    },
    create: {
      email: 'hello@pawlife.vn',
      name: 'pawlife',
      phone: '0766668602',
      role: 'USER',
      avatarUrl: 'https://api.dicebear.com/9.x/avataaars/png?seed=AnDev&size=256',
    },
  });

  // =====================================================================
  // BƯỚC 2: TẠO 7 THÚ CƯNG CÓ KÈM NGÀY SINH (DOB) ĐỂ HIỂN THỊ TUỔI
  // =====================================================================
  const mockPets = [
    { name: 'Milo', species: 'Dog', breed: 'Corgi', statusId: mockPetIds[0], imgUrl: 'https://images.dog.ceo/breeds/corgi-cardigan/cg1.jpg', dob: getPastDate(2, 0) }, // 2 tuổi
    { name: 'Luna', species: 'Cat', breed: 'British Shorthair', statusId: mockPetIds[1], imgUrl: 'https://cdn2.thecatapi.com/images/0XYvRd7oD.jpg', dob: getPastDate(1, 0) }, // 1 tuổi
    { name: 'Bella', species: 'Dog', breed: 'Golden Retriever', statusId: mockPetIds[2], imgUrl: 'https://images.dog.ceo/breeds/retriever-golden/n02099601_3004.jpg', dob: getPastDate(3, 6) }, // 3.5 tuổi
    { name: 'Simba', species: 'Cat', breed: 'Persian', statusId: mockPetIds[3], imgUrl: 'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg', dob: getPastDate(0, 8) }, // 8 tháng
    { name: 'Max', species: 'Dog', breed: 'Husky', statusId: mockPetIds[4], imgUrl: 'https://images.dog.ceo/breeds/husky/n02110185_10047.jpg', dob: getPastDate(4, 0) }, // 4 tuổi
    { name: 'Daisy', species: 'Dog', breed: 'Poodle', statusId: mockPetIds[5], imgUrl: 'https://images.dog.ceo/breeds/poodle-standard/n02113799_2280.jpg', dob: getPastDate(2, 5) }, // 2 tuổi 5 tháng
    { name: 'Charlie', species: 'Dog', breed: 'Beagle', statusId: mockPetIds[6], imgUrl: 'https://images.dog.ceo/breeds/beagle/n02088364_12440.jpg', dob: getPastDate(0, 10) }, // 10 tháng
  ];

  const createdPets: Pet[] = []; 
  
  for (const p of mockPets) {
    // Vì đã xóa sạch ở trên, ta có thể dùng .create thay vì .upsert cho mượt
    const pet = await prisma.pet.create({
      data: {
        id: p.statusId,
        name: p.name,
        species: p.species,
        breed: p.breed,
        dob: p.dob, // <--- BỔ SUNG NGÀY SINH (DOB) Ở ĐÂY
        description: `Bé ${p.name} rất đáng yêu và đang tìm mái ấm.`,
        status: 'AVAILABLE',
      },
    });

    await prisma.petImage.create({ data: { url: p.imgUrl, petId: pet.id } });
    createdPets.push(pet); 
  }

  // =====================================================================
  // BƯỚC 3: SEED 7 ĐƠN ĐĂNG KÝ (APPLICATIONS)
  // =====================================================================
  const standardCommitments = {
    vaccine: true, medical: true, expenses: true,
    updateStatus: true, homeVisit: true, provideID: true,
  };

  const applicationsData = [
    { petId: createdPets[0].id, status: ApplicationStatus.SUBMITTED, note: 'Vừa mới nộp, chờ hệ thống tiếp nhận.', adoptFor: 'Myself', housing: 'Apartment' },
    { petId: createdPets[1].id, status: ApplicationStatus.PENDING, note: 'Đang xem xét hồ sơ sơ bộ.', adoptFor: 'Myself', housing: 'House with Yard' },
    { petId: createdPets[2].id, status: ApplicationStatus.NEED_MORE_INFO, note: 'Yêu cầu bổ sung hình ảnh nơi ở hiện tại.', adoptFor: 'Family', housing: 'Townhouse' },
    { petId: createdPets[3].id, status: ApplicationStatus.INTERVIEW_SCHEDULED, note: 'Đã hẹn lịch phỏng vấn qua điện thoại vào sáng mai.', adoptFor: 'Myself', housing: 'Apartment' },
    { petId: createdPets[4].id, status: ApplicationStatus.APPROVED, note: 'Hồ sơ đạt chuẩn. Chuẩn bị qua trạm đón bé.', adoptFor: 'Family', housing: 'House with Yard' },
    { petId: createdPets[5].id, status: ApplicationStatus.ADOPTION_COMPLETED, note: 'Nhận nuôi thành công, bé đã về nhà.', adoptFor: 'Myself', housing: 'Apartment' },
    { petId: createdPets[6].id, status: ApplicationStatus.CLOSED, note: 'Đơn bị từ chối do không đủ điều kiện chăm sóc.', adoptFor: 'Someone else', housing: 'Shared Apartment' },
  ];

  for (const app of applicationsData) {
    const petName = createdPets.find(p => p.id === app.petId)?.name || 'thú cưng';
    
    // Đã clear data, dùng .create thẳng luôn
    await prisma.adoptionApplication.create({
      data: {
        userId: testUser.id,
        petId: app.petId,
        status: app.status,
        fullName: testUser.name || 'Nguyễn Thiên Ân',
        phone: testUser.phone || '0901234567',
        zalo: '0901234567',
        adoptFor: app.adoptFor,
        location: 'Quận Cầu Giấy, Hà Nội',
        housing: app.housing,
        children: 'No',
        cage: 'Sometimes',
        petExperience: 'Yes, had a dog for 5 years.',
        prevPetHistory: 'Bé cún trước đây mất do tuổi già.',
        employmentStatus: 'Full-time Developer',
        adoptionReason: `Tôi rất thích bé ${petName} và tự tin có đủ tài chính chăm sóc. ${app.note}`,
        commitments: standardCommitments,
      },
    });
  }

  console.log('🎉 Hoàn tất seed 7 trạng thái cùng đầy đủ tuổi (DOB)! Hãy reload lại app React Native nhé!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });