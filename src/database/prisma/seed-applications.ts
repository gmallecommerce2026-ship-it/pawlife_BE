import { PrismaClient, ApplicationStatus, Pet } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu cho Adoption Applications...');

  // 1. Tạo hoặc lấy Test User với email hello@pawlife.vn
  const testUser = await prisma.user.upsert({
    where: { email: 'hello@pawlife.vn' },
    update: {}, // Nếu user đã tồn tại thì giữ nguyên
    create: {
      email: 'hello@pawlife.vn',
      name: 'pawlife',
      phone: '0766668602',
      role: 'USER',
    },
  });

  console.log(`👤 Đã chuẩn bị User test: ${testUser.email}`);

  // 2. Định nghĩa danh sách 5 thú cưng tương ứng với 5 trạng thái đơn
  const mockPets = [
    { name: 'Milo', species: 'Dog', breed: 'Corgi', statusId: 'pet-milo-001' },
    { name: 'Luna', species: 'Cat', breed: 'British Shorthair', statusId: 'pet-luna-002' },
    { name: 'Bella', species: 'Dog', breed: 'Golden Retriever', statusId: 'pet-bella-003' },
    { name: 'Simba', species: 'Cat', breed: 'Persian', statusId: 'pet-simba-004' },
    { name: 'Max', species: 'Dog', breed: 'Husky', statusId: 'pet-max-005' },
  ];

  // Khai báo type rõ ràng để TypeScript không báo lỗi 'never'
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
    createdPets.push(pet); 
  }

  // 3. Chuẩn bị dữ liệu Commitments chuẩn JSON
  const standardCommitments = {
    vaccine: true,
    medical: true,
    expenses: true,
    updateStatus: true,
    homeVisit: true,
    provideID: true,
  };

  // 4. Dữ liệu seed 5 trạng thái đa dạng
  const applicationsData = [
    {
      petId: createdPets[0].id,
      status: ApplicationStatus.SUBMITTED,
      note: 'Vừa mới nộp, chờ hệ thống/shelter tiếp nhận.',
      adoptFor: 'Myself',
      housing: 'Apartment',
    },
    {
      petId: createdPets[1].id,
      status: ApplicationStatus.PENDING,
      note: 'Shelter đang xem xét hồ sơ, có thể đang gọi điện xác minh.',
      adoptFor: 'Myself',
      housing: 'House with Yard',
    },
    {
      petId: createdPets[2].id,
      status: ApplicationStatus.NEED_MORE_INFO,
      note: 'Thiếu hình ảnh chuồng trại hoặc thông tin thu nhập chưa rõ.',
      adoptFor: 'Family',
      housing: 'Townhouse',
    },
    {
      petId: createdPets[3].id,
      status: ApplicationStatus.ADOPTION_COMPLETED,
      note: 'Nhận nuôi thành công! Thú cưng đã về nhà.',
      adoptFor: 'Myself',
      housing: 'Apartment',
    },
    {
      petId: createdPets[4].id,
      status: ApplicationStatus.CLOSED,
      note: 'Hồ sơ bị từ chối hoặc user tự hủy đơn.',
      adoptFor: 'Someone else',
      housing: 'Shared Apartment',
    },
  ];

  // 5. Thực thi seed bằng Upsert để chống duplicate data
  for (const app of applicationsData) {
    const petName = createdPets.find(p => p.id === app.petId)?.name || 'thú cưng';
    
    await prisma.adoptionApplication.upsert({
      where: {
        userId_petId: {
          userId: testUser.id,
          petId: app.petId,
        },
      },
      update: {
        status: app.status, 
      },
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
        adoptionReason: `Tôi rất thích bé ${petName} và tự tin có đủ tài chính, thời gian chăm sóc. ${app.note}`,
        commitments: standardCommitments,
      },
    });
    console.log(`✅ Seeded Application cho pet ${app.petId} với trạng thái [${app.status}]`);
  }

  console.log('🎉 Hoàn tất seed dữ liệu My Applications!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });