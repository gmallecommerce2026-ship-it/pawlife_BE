import { PrismaClient, Role, PetGender, PetSize, PetStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu dọn dẹp dữ liệu cũ...');
  // Xóa dữ liệu cũ để tránh lỗi duplicate khi chạy seed nhiều lần
  // Lưu ý: Phải xóa các bảng có khóa ngoại (relations) trước
  await prisma.eventImage.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.event.deleteMany();
  
  await prisma.petImage.deleteMany();
  await prisma.petInteraction.deleteMany();
  await prisma.favoritePet.deleteMany();
  await prisma.pet.deleteMany();
  
  await prisma.followedShelter.deleteMany();
  await prisma.shelter.deleteMany();
  await prisma.user.deleteMany();

  console.log('Đang tạo Users...');
  // 1. Tạo 2 tài khoản User
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
  // 2. Tạo 3 Trạm cứu hộ (Shelter)
  const shelter1 = await prisma.shelter.create({
    data: {
      name: 'Hà Nội Pet Rescue',
      address: 'Quận Cầu Giấy, Hà Nội',
      contactInfo: '0911111111',
      description: 'Trạm cứu hộ động vật khu vực Hà Nội.',
      policy: '1. Người nhận nuôi phải trên 18 tuổi.\n2. Có công việc và thu nhập ổn định.\n3. Đồng ý cho trạm cập nhật tình hình bé mỗi tháng 1 lần trong 6 tháng đầu.\n4. Ký cam kết không bỏ rơi hoặc tự ý chuyển nhượng thú cưng.',
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
      policy: '1. Cam kết tiêm phòng đầy đủ hàng năm.\n2. Trạm sẽ ưu tiên những bạn có kinh nghiệm nuôi mèo/chó.\n3. Nếu không thể tiếp tục nuôi, BẮT BUỘC phải trả lại cho trạm.',
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
      policy: '1. Trạm cần kiểm tra điều kiện sống (có rào chắn, ban công an toàn) trước khi duyệt.\n2. Phí vía nhận nuôi: 300.000đ (để hỗ trợ y tế cho các bé khác).',
      avatarUrl: 'https://loremflickr.com/200/200/apartment',
      latitude: 16.054407,
      longitude: 108.202164,
    },
  });

  console.log('Đang tạo Events...');
  // Tạo mốc thời gian linh động cho sự kiện (Tuần tới và Tháng tới)
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 3. Tạo 3 Sự kiện (Events)
  await prisma.event.create({
    data: {
      title: 'Dog art therapy & painting class',
      category: 'Art',
      description: 'Join us for a unique and therapeutic art experience with your furry friends! Our dog art therapy & painting class combines creative expression with the joy of spending quality time with your pet. This event is designed for both beginners and experienced artists, providing all materials and guidance needed to create beautiful memories together.',
      bannerUrl: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextWeek.setHours(18, 0, 0, 0)), // Bắt đầu lúc 18:00
      endDate: new Date(nextWeek.setHours(21, 0, 0, 0)),   // Kết thúc lúc 21:00
      locationName: 'Paw Studio, Brooklyn',
      address: '123 Art Street, Brooklyn, NY, United States',
      latitude: 40.678178,
      longitude: -73.944158,
      interestedCount: 255,
      shelterId: shelter1.id,
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=300&auto=format&fit=crop' },
        ]
      }
    }
  });

  await prisma.event.create({
    data: {
      title: 'Morning Yoga with Cats',
      category: 'Health',
      description: 'Start your morning with a relaxing yoga session surrounded by our adorable rescue cats. A perfect way to find your zen and maybe find a new furry family member.',
      bannerUrl: 'https://images.unsplash.com/photo-1535241556843-adbd92d4e673?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextMonth.setHours(8, 0, 0, 0)),
      endDate: new Date(nextMonth.setHours(10, 0, 0, 0)),
      locationName: 'Central Park, NY',
      address: 'Central Park West, New York, NY',
      latitude: 40.785091,
      longitude: -73.968285,
      interestedCount: 128,
      shelterId: shelter2.id,
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1596492784531-6e6eb5ea92b5?q=80&w=300&auto=format&fit=crop' }
        ]
      }
    }
  });

  await prisma.event.create({
    data: {
      title: 'Puppy Socialization Hour',
      category: 'Training',
      description: 'Bring your puppies for a fun, safe, and supervised socialization hour. This helps them build confidence and learn how to interact properly with other dogs.',
      bannerUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextMonth.setHours(15, 0, 0, 0)),
      endDate: new Date(nextMonth.setHours(17, 0, 0, 0)),
      locationName: 'City Pet Center',
      address: '456 Pet Avenue, Los Angeles, CA',
      latitude: 34.052235,
      longitude: -118.243683,
      interestedCount: 340,
      shelterId: shelter3.id,
    }
  });

  console.log('Đang tạo Pets...');
  // 4. Tạo 15 Pets với dữ liệu đa dạng để test Filter Modal
  const petData = [
    // Shelter 1: Hà Nội Pet Rescue
    { name: 'Milo', species: 'Dog', breed: 'Golden Retriever', age: 2, gender: PetGender.MALE, size: PetSize.LARGE, color: 'Vàng', shelterId: shelter1.id, imageUrl: 'https://loremflickr.com/400/400/dog' },
    { name: 'Miu', species: 'Cat', breed: 'Mèo mướp', age: 1, gender: PetGender.FEMALE, size: PetSize.SMALL, color: 'Vằn', shelterId: shelter1.id, imageUrl: 'https://loremflickr.com/400/400/cat' },
    { name: 'Ki', species: 'Dog', breed: 'Corgi', age: 3, gender: PetGender.MALE, size: PetSize.MEDIUM, color: 'Trắng Vàng', shelterId: shelter1.id, imageUrl: 'https://loremflickr.com/400/400/corgi' },
    { name: 'Bông', species: 'Cat', breed: 'Mèo Anh Lông Dài', age: 2, gender: PetGender.FEMALE, size: PetSize.MEDIUM, color: 'Trắng', shelterId: shelter1.id, imageUrl: 'https://loremflickr.com/400/400/kitten' },
    { name: 'Lu', species: 'Dog', breed: 'Chó cỏ', age: 4, gender: PetGender.UNKNOWN, size: PetSize.MEDIUM, color: 'Đen', shelterId: shelter1.id, imageUrl: 'https://loremflickr.com/400/400/puppy' },

    // Shelter 2: Sài Gòn Animal Rescue
    { name: 'Tomy', species: 'Cat', breed: 'Mèo Anh Lông Ngắn', age: 1, gender: PetGender.MALE, size: PetSize.MEDIUM, color: 'Xám', shelterId: shelter2.id, imageUrl: 'https://loremflickr.com/400/400/cat,grey' },
    { name: 'Rex', species: 'Dog', breed: 'Becgie', age: 5, gender: PetGender.MALE, size: PetSize.LARGE, color: 'Đen Vàng', shelterId: shelter2.id, imageUrl: 'https://loremflickr.com/400/400/germanshepherd' },
    { name: 'Na', species: 'Cat', breed: 'Mèo Xiêm', age: 3, gender: PetGender.FEMALE, size: PetSize.SMALL, color: 'Trắng Đen', shelterId: shelter2.id, imageUrl: 'https://loremflickr.com/400/400/siamese' },
    { name: 'Bull', species: 'Dog', breed: 'Bulldog', age: 2, gender: PetGender.MALE, size: PetSize.MEDIUM, color: 'Trắng', shelterId: shelter2.id, imageUrl: 'https://loremflickr.com/400/400/bulldog' },
    { name: 'Đốm', species: 'Dog', breed: 'Dalmatian', age: 1, gender: PetGender.FEMALE, size: PetSize.LARGE, color: 'Trắng Đen', shelterId: shelter2.id, imageUrl: 'https://loremflickr.com/400/400/dalmatian' },

    // Shelter 3: Đà Nẵng Furry Friends
    { name: 'Cam', species: 'Cat', breed: 'Mèo vàng', age: 2, gender: PetGender.MALE, size: PetSize.SMALL, color: 'Cam', shelterId: shelter3.id, imageUrl: 'https://loremflickr.com/400/400/orange,cat' },
    { name: 'Husky', species: 'Dog', breed: 'Husky Sibir', age: 3, gender: PetGender.MALE, size: PetSize.LARGE, color: 'Xám Trắng', shelterId: shelter3.id, imageUrl: 'https://loremflickr.com/400/400/husky' },
    { name: 'Mika', species: 'Cat', breed: 'Mèo Ba Tư', age: 4, gender: PetGender.FEMALE, size: PetSize.MEDIUM, color: 'Trắng', shelterId: shelter3.id, imageUrl: 'https://loremflickr.com/400/400/persian,cat' },
    { name: 'Gấu', species: 'Dog', breed: 'Poodle', age: 1, gender: PetGender.FEMALE, size: PetSize.SMALL, color: 'Nâu', shelterId: shelter3.id, imageUrl: 'https://loremflickr.com/400/400/poodle' },
    { name: 'Béo', species: 'Cat', breed: 'Mèo Anh Lông Ngắn', age: 5, gender: PetGender.UNKNOWN, size: PetSize.LARGE, color: 'Xanh xám', shelterId: shelter3.id, imageUrl: 'https://loremflickr.com/400/400/fat,cat' },
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
            { url: `${pet.imageUrl}?random=2` } 
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