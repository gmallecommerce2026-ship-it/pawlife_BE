import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu dọn dẹp dữ liệu Organizer cũ...');
  // Chú ý: Cần xóa Event trước vì có khóa ngoại trỏ tới Organizer
  await prisma.eventInterest.deleteMany();
  await prisma.eventImage.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organizer.deleteMany();

  console.log('Đang tạo Organizers...');

  const organizersData = [
    {
      name: 'PawLife Official',
      handle: '@pawlife_vn',
      about: 'Đơn vị tổ chức các sự kiện kết nối cộng đồng yêu thú cưng hàng đầu tại Việt Nam. Chúng tôi mang đến những trải nghiệm tuyệt vời nhất cho bạn và những người bạn bốn chân thông qua các workshop, hội chợ và buổi offline.',
      avatarUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=800&auto=format&fit=crop',
      followers: 12500,
    },
    {
      name: 'Pawsome Events Co.',
      handle: '@pawsome_events',
      about: 'Chuyên tổ chức các khóa huấn luyện, dog marathon và các hoạt động thể chất ngoài trời dành riêng cho cún cưng.',
      avatarUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?q=80&w=800&auto=format&fit=crop',
      followers: 8430,
    },
    {
      name: 'Feline Friends Hub',
      handle: '@feline_hub',
      about: 'Tổ chức phi lợi nhuận tập trung vào các sự kiện triển lãm mèo nghệ thuật, workshop chăm sóc sức khỏe mèo và các buổi cafe mèo cuối tuần.',
      avatarUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?q=80&w=800&auto=format&fit=crop',
      followers: 5200,
    }
  ];

  const createdOrganizers: any[] = [];
  for (const org of organizersData) {
    const createdOrg = await prisma.organizer.create({
      data: org,
    });
    createdOrganizers.push(createdOrg);
  }

  console.log(`Đã tạo thành công ${createdOrganizers.length} Organizers!`);

  console.log('Đang tạo Events mẫu liên kết với Organizers...');
  
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.event.create({
    data: {
      title: 'Dog art therapy & painting class',
      category: 'Art',
      description: 'Tham gia lớp học vẽ nghệ thuật cùng những người bạn bốn chân. Trải nghiệm thư giãn tuyệt vời dành cho những người yêu chó và đam mê nghệ thuật.',
      bannerUrl: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextWeek.setHours(18, 0, 0, 0)),
      endDate: new Date(nextWeek.setHours(21, 0, 0, 0)),
      locationName: 'Paw Studio',
      address: 'Quận Tây Hồ, Hà Nội',
      latitude: 21.058178,
      longitude: 105.804158,
      interestedCount: 255,
      organizerId: createdOrganizers[0].id, // Gắn với PawLife Official
    }
  });

  await prisma.event.create({
    data: {
      title: 'Hội thi Chó chạy Marathon 2026',
      category: 'Sports',
      description: 'Giải chạy bộ đồng hành cùng thú cưng quy mô lớn nhất năm. Cơ hội để thú cưng của bạn thể hiện sức bền và nhận những phần quà giá trị.',
      bannerUrl: 'https://images.unsplash.com/photo-1535241556843-adbd92d4e673?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextMonth.setHours(6, 0, 0, 0)),
      endDate: new Date(nextMonth.setHours(10, 0, 0, 0)),
      locationName: 'Công viên Yên Sở',
      address: 'Hoàng Mai, Hà Nội',
      latitude: 20.955091,
      longitude: 105.868285,
      interestedCount: 840,
      organizerId: createdOrganizers[1].id, // Gắn với Pawsome Events Co.
    }
  });

  console.log('Đã tạo xong dữ liệu Organizer và Event mẫu!');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed organizer:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });