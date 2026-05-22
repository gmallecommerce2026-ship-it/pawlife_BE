import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu dọn dẹp dữ liệu Event cũ...');
  await prisma.eventImage.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.event.deleteMany();

  console.log('Đang tìm kiếm Shelters có sẵn để liên kết với Event...');
  const shelters = await prisma.shelter.findMany({
    take: 3,
  });

  if (shelters.length === 0) {
    console.log('❌ Không tìm thấy Shelter nào trong database. Cần seed Shelter trước!');
    return;
  }

  const shelter1Id = shelters[0].id;
  const shelter2Id = shelters[1]?.id || shelters[0].id; 
  const shelter3Id = shelters[2]?.id || shelters[0].id;

  console.log('Đang tạo Events...');
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Sự kiện 1
  await prisma.event.create({
    data: {
      title: 'Dog art therapy & painting class',
      category: 'Art',
      description: 'Join us for a unique and therapeutic art experience with your furry friends! Our dog art therapy & painting class combines creative expression with the joy of spending quality time with your pet.',
      bannerUrl: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextWeek.setHours(18, 0, 0, 0)),
      endDate: new Date(nextWeek.setHours(21, 0, 0, 0)),
      locationName: 'Paw Studio, Brooklyn',
      address: '123 Art Street, Brooklyn, NY, United States',
      latitude: 40.678178,
      longitude: -73.944158,
      interestedCount: 255,
      shelterId: shelter1Id, // Liên kết với Shelter thực
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?q=80&w=300&auto=format&fit=crop' }
        ]
      }
    }
  });

  // Sự kiện 2
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
          { url: 'https://images.unsplash.com/photo-1596492784531-6e6eb5ea92b5?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1511044568932-338cba0ad803?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1501820488136-72669149e0d4?q=80&w=300&auto=format&fit=crop' }
        ]
      }
    }
  });

  // Sự kiện 3
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
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1544568100-847a948585b9?q=80&w=300&auto=format&fit=crop' },
          { url: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?q=80&w=300&auto=format&fit=crop' }
        ]
      }
    }
  });

  console.log('Đã tạo xong dữ liệu mẫu Event với tối thiểu 5 ảnh cho mỗi Gallery!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed database Event:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });