import { PrismaClient, ApplicationStatus, Pet } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu My Applications (Focus: Pet Avatars)...');

  // 1. Tạo Test User
  const testUser = await prisma.user.upsert({
    where: { email: 'hello@pawlife.vn' },
    update: {
      // Dùng PNG thay vì SVG để React Native Image đọc được ngay
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

  // 2. Danh sách Pet với Link ảnh .jpg/.png cực nhẹ, chống lỗi RN
  // Dùng place.dog và cataas (hoặc các dịch vụ trả về binary image sạch)
  const mockPets = [
    { name: 'Milo', species: 'Dog', breed: 'Corgi', statusId: 'pet-milo-001', imgUrl: 'https://images.dog.ceo/breeds/corgi-cardigan/cg1.jpg' },
    { name: 'Luna', species: 'Cat', breed: 'British Shorthair', statusId: 'pet-luna-002', imgUrl: 'https://cdn2.thecatapi.com/images/0XYvRd7oD.jpg' },
    { name: 'Bella', species: 'Dog', breed: 'Golden Retriever', statusId: 'pet-bella-003', imgUrl: 'https://images.dog.ceo/breeds/retriever-golden/n02099601_3004.jpg' },
    { name: 'Simba', species: 'Cat', breed: 'Persian', statusId: 'pet-simba-004', imgUrl: 'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg' },
    { name: 'Max', species: 'Dog', breed: 'Husky', statusId: 'pet-max-005', imgUrl: 'https://images.dog.ceo/breeds/husky/n02110185_10047.jpg' },
  ];

  const createdPets: Pet[] = []; 
  
  for (const p of mockPets) {
    // 2.1 Upsert thông tin Pet
    const pet = await prisma.pet.upsert({
      where: { id: p.statusId },
      update: {},
      create: {
        id: p.statusId,
        name: p.name,
        species: p.species,
        breed: p.breed,
        description: `Bé ${p.name} rất đáng yêu và đang tìm mái ấm.`,
        status: 'AVAILABLE',
      },
    });

    // 2.2 Xử lý Avatar cho Pet (Lưu vào PetImage)
    // - Bước 1: Xóa toàn bộ ảnh cũ bị lỗi link của pet này
    await prisma.petImage.deleteMany({
      where: { petId: pet.id }
    });
    
    // - Bước 2: Tạo ảnh mới với định dạng chuẩn JPG
    await prisma.petImage.create({
      data: {
        url: p.imgUrl,
        petId: pet.id,
      }
    });

    createdPets.push(pet); 
  }

  console.log(`🐾 Đã nạp thành công Avatar (ảnh đại diện) xịn cho ${createdPets.length} thú cưng`);

  const standardCommitments = {
    vaccine: true, medical: true, expenses: true,
    updateStatus: true, homeVisit: true, provideID: true,
  };

  // 4. Seed các trạng thái My Application
  const applicationsData = [
    { petId: createdPets[0].id, status: ApplicationStatus.SUBMITTED, note: 'Vừa mới nộp, chờ hệ thống tiếp nhận.', adoptFor: 'Myself', housing: 'Apartment' },
    { petId: createdPets[1].id, status: ApplicationStatus.PENDING, note: 'Đang xem xét hồ sơ, chờ gọi điện xác minh.', adoptFor: 'Myself', housing: 'House with Yard' },
    { petId: createdPets[2].id, status: ApplicationStatus.NEED_MORE_INFO, note: 'Thiếu hình ảnh chuồng trại hoặc thu nhập.', adoptFor: 'Family', housing: 'Townhouse' },
    { petId: createdPets[3].id, status: ApplicationStatus.ADOPTION_COMPLETED, note: 'Nhận nuôi thành công!', adoptFor: 'Myself', housing: 'Apartment' },
    { petId: createdPets[4].id, status: ApplicationStatus.CLOSED, note: 'Hồ sơ bị từ chối hoặc user tự hủy.', adoptFor: 'Someone else', housing: 'Shared Apartment' },
  ];

  for (const app of applicationsData) {
    const petName = createdPets.find(p => p.id === app.petId)?.name || 'thú cưng';
    
    await prisma.adoptionApplication.upsert({
      where: {
        userId_petId: { userId: testUser.id, petId: app.petId },
      },
      update: { status: app.status },
      create: {
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

  console.log('🎉 Hoàn tất seed! Hãy reload lại app React Native nhé!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });