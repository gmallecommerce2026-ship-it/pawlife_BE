import { PrismaClient, ApplicationStatus, Pet } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed 7 trạng thái Adoption Applications...');

  // 1. User Test
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

  // 2. Tạo 7 Pet ứng với 7 trạng thái (Thêm Daisy và Charlie)
  const mockPets = [
    { name: 'Milo', species: 'Dog', breed: 'Corgi', statusId: 'pet-milo-001', imgUrl: 'https://images.dog.ceo/breeds/corgi-cardigan/cg1.jpg' },
    { name: 'Luna', species: 'Cat', breed: 'British Shorthair', statusId: 'pet-luna-002', imgUrl: 'https://cdn2.thecatapi.com/images/0XYvRd7oD.jpg' },
    { name: 'Bella', species: 'Dog', breed: 'Golden Retriever', statusId: 'pet-bella-003', imgUrl: 'https://images.dog.ceo/breeds/retriever-golden/n02099601_3004.jpg' },
    { name: 'Simba', species: 'Cat', breed: 'Persian', statusId: 'pet-simba-004', imgUrl: 'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg' },
    { name: 'Max', species: 'Dog', breed: 'Husky', statusId: 'pet-max-005', imgUrl: 'https://images.dog.ceo/breeds/husky/n02110185_10047.jpg' },
    { name: 'Daisy', species: 'Dog', breed: 'Poodle', statusId: 'pet-daisy-006', imgUrl: 'https://images.dog.ceo/breeds/poodle-standard/n02113799_2280.jpg' },
    { name: 'Charlie', species: 'Dog', breed: 'Beagle', statusId: 'pet-charlie-007', imgUrl: 'https://images.dog.ceo/breeds/beagle/n02088364_12440.jpg' },
  ];

  const createdPets: Pet[] = []; 
  
  for (const p of mockPets) {
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

    // Reset lại ảnh để đảm bảo luôn có hình
    await prisma.petImage.deleteMany({ where: { petId: pet.id } });
    await prisma.petImage.create({ data: { url: p.imgUrl, petId: pet.id } });

    createdPets.push(pet); 
  }

  const standardCommitments = {
    vaccine: true, medical: true, expenses: true,
    updateStatus: true, homeVisit: true, provideID: true,
  };

  // 3. Dữ liệu seed BẢY trạng thái đầy đủ
  const applicationsData = [
    { petId: createdPets[0].id, status: ApplicationStatus.SUBMITTED, note: 'Vừa mới nộp, chờ hệ thống tiếp nhận.', adoptFor: 'Myself', housing: 'Apartment' },
    { petId: createdPets[1].id, status: ApplicationStatus.PENDING, note: 'Đang xem xét hồ sơ sơ bộ.', adoptFor: 'Myself', housing: 'House with Yard' },
    { petId: createdPets[2].id, status: ApplicationStatus.NEED_MORE_INFO, note: 'Yêu cầu bổ sung hình ảnh nơi ở hiện tại.', adoptFor: 'Family', housing: 'Townhouse' },
    { petId: createdPets[3].id, status: ApplicationStatus.INTERVIEW_SCHEDULED, note: 'Đã hẹn lịch phỏng vấn qua điện thoại vào sáng mai.', adoptFor: 'Myself', housing: 'Apartment' }, // MỚI
    { petId: createdPets[4].id, status: ApplicationStatus.APPROVED, note: 'Hồ sơ đạt chuẩn. Chuẩn bị qua trạm đón bé.', adoptFor: 'Family', housing: 'House with Yard' }, // MỚI
    { petId: createdPets[5].id, status: ApplicationStatus.ADOPTION_COMPLETED, note: 'Nhận nuôi thành công, bé đã về nhà.', adoptFor: 'Myself', housing: 'Apartment' },
    { petId: createdPets[6].id, status: ApplicationStatus.CLOSED, note: 'Đơn bị từ chối do không đủ điều kiện chăm sóc.', adoptFor: 'Someone else', housing: 'Shared Apartment' },
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

  console.log('🎉 Hoàn tất seed 7 trạng thái! Hãy reload lại app React Native nhé!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });