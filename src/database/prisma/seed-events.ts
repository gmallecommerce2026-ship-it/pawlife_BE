import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu dọn dẹp dữ liệu Event cũ...');
  // Chỉ xóa dữ liệu liên quan đến Event, KHÔNG xóa User, Shelter, hay Pet
  await prisma.eventImage.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.event.deleteMany();

  console.log('Đang tìm kiếm Shelters có sẵn để liên kết với Event...');
  // Lấy ra các Shelter hiện có trong database để gán vào Event
  const shelters = await prisma.shelter.findMany({
    take: 3,
  });

  if (shelters.length === 0) {
    console.log('❌ Không tìm thấy Shelter nào trong database. Vui lòng đảm bảo bạn đã có dữ liệu Shelter trước khi chạy file này!');
    return;
  }

  // Gán ID động từ dữ liệu thực tế (fallback về shelter đầu tiên nếu có ít hơn 3 shelter)
  const shelter1Id = shelters[0].id;
  const shelter2Id = shelters[1]?.id || shelters[0].id; 
  const shelter3Id = shelters[2]?.id || shelters[0].id;

  console.log('Đang tạo Events...');
  // Tạo mốc thời gian linh động cho sự kiện (Tuần tới và Tháng tới)
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Tạo 3 Sự kiện (Events)
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
      shelterId: shelter1Id,
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
      shelterId: shelter2Id,
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
      shelterId: shelter3Id,
    }
  });

  console.log('Đã tạo xong dữ liệu mẫu Event!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed database Event:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });