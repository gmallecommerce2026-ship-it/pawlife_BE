import { PrismaClient, Role, PetGender, PetSize, PetStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu dọn dẹp dữ liệu cũ...');
  // Xóa dữ liệu cũ để tránh lỗi duplicate khi chạy seed nhiều lần
  await prisma.eventImage.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.event.deleteMany();
  await prisma.tagReport.deleteMany();
  await prisma.tag.deleteMany();  
  await prisma.adoptionApplication.deleteMany();
  await prisma.adoptionRequest.deleteMany();  
  await prisma.petImage.deleteMany();
  await prisma.petInteraction.deleteMany();
  await prisma.favoritePet.deleteMany();
  await prisma.pet.deleteMany();
  
  await prisma.followedShelter.deleteMany();
  await prisma.shelter.deleteMany();
  await prisma.user.deleteMany();

  console.log('Đang tạo Users...');
  const user1 = await prisma.user.create({
    data: {
      email: 'user1@example.com',
      name: 'Nguyễn Văn A',
      role: Role.USER,
      phone: '0901234567',
      gender: 'MALE',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      name: 'Trần Thị B',
      role: Role.USER,
      phone: '0987654321',
      gender: 'FEMALE',
    },
  });

  console.log('Đang tạo Shelters...');
  const shelter1 = await prisma.shelter.create({
    data: {
      name: 'Hà Nội Pet Rescue',
      address: 'Quận Cầu Giấy, Hà Nội',
      contactInfo: '0911111111',
      description: 'Trạm cứu hộ động vật khu vực Hà Nội.',
      policy: '1. Người nhận nuôi phải trên 18 tuổi.\n2. Có công việc và thu nhập ổn định.',
      avatarUrl: 'https://loremflickr.com/200/200/house',
      latitude: 21.028511,
      longitude: 105.804817,
    },
  });

  const shelter2 = await prisma.shelter.create({
    data: {
      name: 'Sài Gòn Animal Rescue',
      address: 'Quận 1, TP. Hồ Chí Minh',
      contactInfo: '0922222222',
      description: 'Mái nhà chung cho chó mèo hoang tại Sài Gòn.',
      policy: '1. Cam kết tiêm phòng đầy đủ hàng năm.',
      avatarUrl: 'https://loremflickr.com/200/200/building',
      latitude: 10.762622,
      longitude: 106.660172,
    },
  });

  const shelter3 = await prisma.shelter.create({
    data: {
      name: 'Đà Nẵng Furry Friends',
      address: 'Quận Hải Châu, Đà Nẵng',
      contactInfo: '0933333333',
      description: 'Cứu hộ và tìm nhà mới cho thú cưng tại Đà Nẵng.',
      policy: '1. Trạm cần kiểm tra điều kiện sống.',
      avatarUrl: 'https://loremflickr.com/200/200/apartment',
      latitude: 16.054407,
      longitude: 108.202164,
    },
  });

  // LƯU Ý: Phần tạo Event đã được gỡ bỏ khỏi file này để nhường chỗ cho seed-organizer.ts

  console.log('Đang tạo Pets...');
  const petData = [
    { name: 'Milo', species: 'Dog', breed: 'Golden Retriever', age: 2, gender: PetGender.MALE, size: PetSize.LARGE, color: 'Vàng', shelterId: shelter1.id, imageUrl: 'https://loremflickr.com/400/400/dog' },
    { name: 'Miu', species: 'Cat', breed: 'Mèo mướp', age: 1, gender: PetGender.FEMALE, size: PetSize.SMALL, color: 'Vằn', shelterId: shelter1.id, imageUrl: 'https://loremflickr.com/400/400/cat' },
    { name: 'Tomy', species: 'Cat', breed: 'Mèo Anh Lông Ngắn', age: 1, gender: PetGender.MALE, size: PetSize.MEDIUM, color: 'Xám', shelterId: shelter2.id, imageUrl: 'https://loremflickr.com/400/400/cat,grey' },
    { name: 'Rex', species: 'Dog', breed: 'Becgie', age: 5, gender: PetGender.MALE, size: PetSize.LARGE, color: 'Đen Vàng', shelterId: shelter2.id, imageUrl: 'https://loremflickr.com/400/400/germanshepherd' },
    { name: 'Cam', species: 'Cat', breed: 'Mèo vàng', age: 2, gender: PetGender.MALE, size: PetSize.SMALL, color: 'Cam', shelterId: shelter3.id, imageUrl: 'https://loremflickr.com/400/400/orange,cat' },
    { name: 'Husky', species: 'Dog', breed: 'Husky Sibir', age: 3, gender: PetGender.MALE, size: PetSize.LARGE, color: 'Xám Trắng', shelterId: shelter3.id, imageUrl: 'https://loremflickr.com/400/400/husky' },
  ];

  for (const pet of petData) {
    await prisma.pet.create({
      data: {
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        gender: pet.gender,
        size: pet.size,
        color: pet.color,
        status: PetStatus.AVAILABLE,
        isVaccinated: true,
        isSpayedNeutered: false,
        shelterId: pet.shelterId,
        images: {
          create: [
            { url: pet.imageUrl }, 
            { url: `${pet.imageUrl}?random=1` },
          ],
        },
      },
    });
  }

  console.log('Đã tạo xong dữ liệu mẫu (Seed Database thành công)!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });