import { PrismaClient, ApplicationStatus, Pet, PetGender, PetSize } from '@prisma/client';

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
  // BƯỚC 2: TẠO 7 THÚ CƯNG ĐẦY ĐỦ THÔNG TIN (DOB, GENDER, SIZE, WEIGHT)
  // =====================================================================
  const mockPets = [
    { 
      name: 'Milo', species: 'Dog', breed: 'Corgi', gender: PetGender.MALE, size: PetSize.MEDIUM, weight: 12.5, statusId: mockPetIds[0], imgUrl: 'https://images.dog.ceo/breeds/corgi-cardigan/cg1.jpg', dob: getPastDate(2, 0),
      description: 'Milo là một bé Corgi cực kỳ thông minh và năng động. Bé rất thích chơi nhặt bóng, luôn quấn quýt bên người và có nụ cười tỏa nắng. Milo đã được huấn luyện lệnh cơ bản và biết đi vệ sinh đúng chỗ trên khay.',
      idealHome: 'Phù hợp với gia đình có không gian chơi đùa hoặc thường xuyên dắt bé đi dạo công viên. Bé cực kỳ thân thiện với trẻ em và hòa đồng với các chú chó khác.'
    }, 
    { 
      name: 'Luna', species: 'Cat', breed: 'British Shorthair', gender: PetGender.FEMALE, size: PetSize.SMALL, weight: 4.2, statusId: mockPetIds[1], imgUrl: 'https://cdn2.thecatapi.com/images/0XYvRd7oD.jpg', dob: getPastDate(1, 0),
      description: 'Luna là cô mèo Anh lông ngắn ngọt ngào, điềm tĩnh và thích được vuốt ve nọng cằm. Bé thường dành phần lớn thời gian để tắm nắng bên cửa sổ và ngủ nướng. Rất ngoan và không bao giờ cào đồ đạc.',
      idealHome: 'Cần một môi trường sống yên tĩnh, thư giãn. Rất phù hợp với người bận rộn, thích nuôi mèo độc lập nhưng vẫn tình cảm. Khuyến khích nuôi hoàn toàn trong nhà.'
    }, 
    { 
      name: 'Bella', species: 'Dog', breed: 'Golden Retriever', gender: PetGender.FEMALE, size: PetSize.LARGE, weight: 28.0, statusId: mockPetIds[2], imgUrl: 'https://images.dog.ceo/breeds/retriever-golden/n02099601_3004.jpg', dob: getPastDate(3, 6),
      description: 'Bella là một cô nàng Golden hiền lành, trung thành và mang năng lượng chữa lành tuyệt vời. Bé rất kiên nhẫn, thích bơi lội vào cuối tuần và không bao giờ kén ăn.',
      idealHome: 'Một gia đình ấm áp, lý tưởng nhất là có sân vườn rộng. Rất tuyệt vời để làm bạn với gia đình có trẻ nhỏ hoặc làm chó hỗ trợ tâm lý (therapy dog).'
    }, 
    { 
      name: 'Simba', species: 'Cat', breed: 'Persian', gender: PetGender.MALE, size: PetSize.SMALL, weight: 4.5, statusId: mockPetIds[3], imgUrl: 'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg', dob: getPastDate(0, 8),
      description: 'Simba là một cậu bé Ba Tư lông xù siêu đáng yêu và quấn chủ. Bé hơi nhút nhát với người lạ lúc đầu nhưng khi quen sẽ liên tục kêu gừ gừ và đòi bế.',
      idealHome: 'Cần một chủ nhân có thời gian và kinh nghiệm chải lông, lau mắt hàng ngày cho dòng lông dài. Không gian sống không nên có quá nhiều tiếng ồn lớn.'
    }, 
    { 
      name: 'Max', species: 'Dog', breed: 'Husky', gender: PetGender.MALE, size: PetSize.LARGE, weight: 24.5, statusId: mockPetIds[4], imgUrl: 'https://images.dog.ceo/breeds/husky/n02110185_10047.jpg', dob: getPastDate(4, 0),
      description: 'Max là một chàng trai Husky năng lượng ngập tràn, hay "cãi" chủ (husky howl) và vô cùng hài hước. Bé rất khỏe, thích kéo đồ và cực kỳ phấn khích khi được ra ngoài chạy bộ.',
      idealHome: 'Cần một chủ nhân yêu thể thao, có thể dắt bé chạy bộ nhiều km mỗi ngày để xả năng lượng. Bắt buộc nhà phải có sân với hàng rào cao, chắc chắn vì bé trốn rất giỏi.'
    }, 
    { 
      name: 'Daisy', species: 'Dog', breed: 'Poodle', gender: PetGender.FEMALE, size: PetSize.MEDIUM, weight: 15.0, statusId: mockPetIds[5], imgUrl: 'https://images.dog.ceo/breeds/poodle-standard/n02113799_2280.jpg', dob: getPastDate(2, 5),
      description: 'Daisy là cô bé Poodle nhỏ nhắn, lông xoăn tít và vô cùng lanh lợi. Bé rất quấn người, hay làm trò đứng bằng hai chân và hiểu ý chủ rất nhanh.',
      idealHome: 'Tuyệt vời cho cuộc sống căn hộ chung cư. Do Poodle ít rụng lông nên rất tốt cho những gia đình có người bị dị ứng. Cần người có thể dành thời gian ở nhà nhiều với bé.'
    }, 
    { 
      name: 'Charlie', species: 'Dog', breed: 'Beagle', gender: PetGender.MALE, size: PetSize.MEDIUM, weight: 10.5, statusId: mockPetIds[6], imgUrl: 'https://images.dog.ceo/breeds/beagle/n02088364_12440.jpg', dob: getPastDate(0, 10),
      description: 'Charlie là cậu nhóc Beagle với cái mũi tò mò luôn hoạt động hết công suất. Bé cực kỳ ham ăn, thích trò chơi đánh hơi giấu đồ và luôn vẫy đuôi thân thiện với tất cả mọi người.',
      idealHome: 'Cần gia đình kiên nhẫn huấn luyện vì dòng chó săn mùi thường hay lơ đãng khi ngửi thấy mùi lạ. Bé sẽ rất hạnh phúc nếu có một anh/chị chó khác năng động để chơi cùng.'
    },
  ];

  const createdPets: Pet[] = []; 
  
  for (const p of mockPets) {
    const pet = await prisma.pet.create({
      data: {
        id: p.statusId,
        name: p.name,
        species: p.species,
        breed: p.breed,
        dob: p.dob,
        gender: p.gender,
        size: p.size,
        weight: p.weight,
        description: p.description, // <--- Lấy text thật từ mảng
        idealHome: p.idealHome,     // <--- Lấy text thật từ mảng
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

  console.log('🎉 Hoàn tất seed 7 trạng thái cùng đầy đủ tuổi, giới tính, kích cỡ và cân nặng! Hãy reload lại app React Native nhé!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });