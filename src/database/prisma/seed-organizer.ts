import { PrismaClient } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module'; // Đảm bảo đường dẫn này trỏ đúng tới app.module.ts của bạn
import { TranslateService } from '../../translate/translate.service'; // Đảm bảo đường dẫn này chuẩn xác

const prisma = new PrismaClient();

// Helper function để gọi TranslateService và format thành JSON { vi, en }
async function buildBilingualField(
  text: string,
  translateService: TranslateService,
  sourceLang: 'vi' | 'en' = 'vi'
): Promise<string> {
  if (!text) return JSON.stringify({ vi: '', en: '' });

  const targetLang = sourceLang === 'vi' ? 'en' : 'vi';

  try {
    const translatedText = await translateService.translate(text, targetLang);
    return JSON.stringify({
      vi: sourceLang === 'vi' ? text : translatedText,
      en: sourceLang === 'en' ? text : translatedText,
    });
  } catch (error) {
    console.error(`[Lỗi Dịch Thuật] Không thể dịch: "${text}". Đang dùng fallback bản gốc.`);
    return JSON.stringify({ vi: text, en: text });
  }
}

async function main() {
  console.log('🌱 Đang khởi tạo ứng dụng thu nhỏ để lấy dịch vụ TranslateService...');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const translateService = appContext.get(TranslateService);

  console.log('🗑 Bắt đầu dọn dẹp dữ liệu Organizer và Event cũ...');
  // Xóa theo thứ tự để không bị lỗi khóa ngoại (Foreign Key)
  await prisma.eventImage.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organizer.deleteMany();

  console.log('Đang tạo Organizers (Dịch tự động)...');

  // Thêm thuộc tính sourceLang để quy định ngôn ngữ gốc của text
  const organizersData = [
    {
      sourceLang: 'vi' as const,
      name: 'PawLife Official',
      handle: '@pawlife_vn',
      about: 'Đơn vị tổ chức các sự kiện kết nối cộng đồng yêu thú cưng hàng đầu tại Việt Nam. Chúng tôi mang đến những trải nghiệm tuyệt vời nhất cho bạn và những người bạn bốn chân thông qua các workshop, hội chợ và buổi offline.',
      avatarUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=800&auto=format&fit=crop',
      followers: 12500,
    },
    {
      sourceLang: 'vi' as const,
      name: 'Pawsome Events Co.',
      handle: '@pawsome_events',
      about: 'Chuyên tổ chức các khóa huấn luyện, dog marathon và các hoạt động thể chất ngoài trời dành riêng cho cún cưng.',
      avatarUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?q=80&w=800&auto=format&fit=crop',
      followers: 8430,
    },
    {
      sourceLang: 'vi' as const, // Dù tên tiếng Anh nhưng mô tả tiếng Việt
      name: 'Feline Friends Hub',
      handle: '@feline_hub',
      about: 'Tổ chức phi lợi nhuận tập trung vào các sự kiện triển lãm mèo nghệ thuật, workshop chăm sóc sức khỏe mèo và các buổi cafe mèo cuối tuần.',
      avatarUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?q=80&w=800&auto=format&fit=crop',
      followers: 5200,
    },
    {
      sourceLang: 'vi' as const,
      name: 'City Pet Training',
      handle: '@citypettraining',
      about: 'Trung tâm huấn luyện thú cưng chuyên nghiệp, thường xuyên mở các buổi workshop giao lưu và dạy kỹ năng cơ bản cho chó con.',
      avatarUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?q=80&w=800&auto=format&fit=crop',
      followers: 3100,
    }
  ];

  const createdOrganizers: any[] = [];
  for (const org of organizersData) {
    console.log(`- Đang dịch Organizer: ${org.name}`);
    const aboutBilingual = await buildBilingualField(org.about, translateService, org.sourceLang);

    const createdOrg = await prisma.organizer.create({
      data: {
        name: org.name,
        handle: org.handle,
        about: aboutBilingual, // Lưu JSON song ngữ
        avatarUrl: org.avatarUrl,
        coverUrl: org.coverUrl,
        followers: org.followers,
      },
    });
    createdOrganizers.push(createdOrg);
  }

  console.log(`✅ Đã tạo thành công ${createdOrganizers.length} Organizers song ngữ!`);
  console.log('Đang tạo Events mẫu liên kết với Organizers (Dịch tự động)...');
  
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Khai báo data event trước để lặp qua dịch thay vì create cứng
  const rawEvents = [
    {
      sourceLang: 'vi' as const,
      organizerIndex: 0,
      title: 'Lớp học vẽ nghệ thuật cùng thú cưng', // Sửa nhẹ lại thành tiếng Việt để test auto-dịch sang Eng
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
      images: [
        'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?q=80&w=300&auto=format&fit=crop'
      ]
    },
    {
      sourceLang: 'vi' as const,
      organizerIndex: 1,
      title: 'Hội thi Chó chạy Marathon 2026',
      category: 'Sports',
      description: 'Giải chạy bộ đồng hành cùng thú cưng quy mô lớn nhất năm. Cơ hội để thú cưng của bạn thể hiện sức bền và nhận những phần quà giá trị.',
      bannerUrl: 'https://images.unsplash.com/photo-1537204696486-967f1b7198c8?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextMonth.setHours(6, 0, 0, 0)),
      endDate: new Date(nextMonth.setHours(10, 0, 0, 0)),
      locationName: 'Công viên Yên Sở',
      address: 'Hoàng Mai, Hà Nội',
      latitude: 20.955091,
      longitude: 105.868285,
      interestedCount: 840,
      images: [
        'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1504595403659-9088ce801e29?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517423568366-8b83523034fd?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546975490-a79ee8ebfb72?q=80&w=300&auto=format&fit=crop'
      ]
    },
    {
      sourceLang: 'en' as const, // Sự kiện này nguyên gốc là tiếng Anh
      organizerIndex: 2,
      title: 'Morning Yoga with Cats',
      category: 'Health',
      description: 'Start your morning with a relaxing yoga session surrounded by our adorable rescue cats. A perfect way to find your zen and maybe find a new furry family member.',
      bannerUrl: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextMonth.setHours(8, 0, 0, 0)),
      endDate: new Date(nextMonth.setHours(10, 0, 0, 0)),
      locationName: 'Central Park', // Đã loại bỏ bớt phần rườm rà để dịch chuẩn hơn
      address: 'Central Park West, New York, NY',
      latitude: 40.785091,
      longitude: -73.968285,
      interestedCount: 128,
      images: [
        'https://images.unsplash.com/photo-1596492784531-6e6eb5ea92b5?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1573865526739-10659fec78a5?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511044568932-338cba0ad803?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1501820488136-72669149e0d4?q=80&w=300&auto=format&fit=crop'
      ]
    },
    {
      sourceLang: 'en' as const, // Sự kiện này nguyên gốc là tiếng Anh
      organizerIndex: 3,
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
      images: [
        'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1544568100-847a948585b9?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1534361960057-19889db9621e?q=80&w=300&auto=format&fit=crop'
      ]
    }
  ];

  for (const raw of rawEvents) {
    console.log(`- Đang dịch Event: ${raw.title}`);
    const titleBilingual = await buildBilingualField(raw.title, translateService, raw.sourceLang);
    const descBilingual = await buildBilingualField(raw.description, translateService, raw.sourceLang);
    const categoryBilingual = await buildBilingualField(raw.category, translateService, raw.sourceLang);
    const locNameBilingual = await buildBilingualField(raw.locationName, translateService, raw.sourceLang);

    await prisma.event.create({
      data: {
        title: titleBilingual,
        category: categoryBilingual,
        description: descBilingual,
        locationName: locNameBilingual,
        address: raw.address, // Address giữ nguyên
        bannerUrl: raw.bannerUrl,
        startDate: raw.startDate,
        endDate: raw.endDate,
        latitude: raw.latitude,
        longitude: raw.longitude,
        interestedCount: raw.interestedCount,
        organizerId: createdOrganizers[raw.organizerIndex].id,
        images: {
          create: raw.images.map(url => ({ url }))
        }
      }
    });
  }

  console.log('✅ Đã tạo xong dữ liệu Organizer và Event song ngữ với đầy đủ Gallery ảnh!');
  
  // Tắt app để giải phóng cổng/bộ nhớ (quan trọng khi chạy trên VPS)
  await appContext.close();
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed event/organizer:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });