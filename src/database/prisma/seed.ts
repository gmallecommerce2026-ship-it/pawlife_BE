import { PrismaClient, Role } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { TranslateService } from '../../translate/translate.service';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper: Dịch tự động hoặc dùng Fallback nếu thiếu API Key
async function buildBilingualField(
  text: string,
  translateService: TranslateService,
  sourceLang: 'vi' | 'en' = 'vi'
): Promise<any> {
  if (!text) return { vi: '', en: '' };

  const targetLang = sourceLang === 'vi' ? 'en' : 'vi';

  try {
    const translatedText = await translateService.translate(text, targetLang);
    return {
      vi: sourceLang === 'vi' ? text : translatedText,
      en: sourceLang === 'en' ? text : translatedText,
    };
  } catch (error) {
    return { vi: text, en: text };
  }
}

async function main() {
  console.log('🌱 Đang khởi tạo ứng dụng NestJS để lấy cấu hình...');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const translateService = appContext.get(TranslateService);

  console.log('🗑 Bắt đầu dọn dẹp dữ liệu Event cũ (Không chạm vào Pet)...');
  await prisma.eventImage.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organizer.deleteMany();

  // ==========================================
  // 1. TẠO TÀI KHOẢN ADMIN PAWLIFE
  // ==========================================
  console.log('\n👤 Đang khởi tạo/cập nhật tài khoản Admin...');
  const adminEmail = 'hello@pawlife.vn';
  const rawPassword = '#Motconvit1205';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      role: Role.ADMIN,
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'PawLife Admin',
      phone: '0999999999',
      role: Role.ADMIN,
      isTwoFactorEnabled: false,
    }
  });
  console.log(`✅ Đã tạo/cập nhật tài khoản Admin: ${adminEmail}`);

  // ==========================================
  // 2. TẠO 3 DỮ LIỆU ORGANIZER
  // ==========================================
  console.log('\n🏢 Đang tạo 3 Organizers (Hỗ trợ Song ngữ)...');
  const organizersData = [
    {
      sourceLang: 'vi' as const,
      name: 'PawLife Official',
      handle: '@pawlife_vn',
      about: 'Đơn vị tổ chức các sự kiện kết nối cộng đồng yêu thú cưng hàng đầu tại Việt Nam.',
      avatarUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=800&auto=format&fit=crop',
      followers: 12500,
    },
    {
      sourceLang: 'vi' as const,
      name: 'Pawsome Events Co.',
      handle: '@pawsome_events',
      about: 'Chuyên tổ chức các khóa huấn luyện, dog marathon và hoạt động thể chất ngoài trời cho cún cưng.',
      avatarUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?q=80&w=800&auto=format&fit=crop',
      followers: 8430,
    },
    {
      sourceLang: 'en' as const,
      name: 'Feline Friends Hub',
      handle: '@feline_hub',
      about: 'A non-profit organization focused on cat art exhibitions, health workshops, and weekend cat cafe meetups.',
      avatarUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=200&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?q=80&w=800&auto=format&fit=crop',
      followers: 5200,
    }
  ];

  const createdOrganizers: any[] = [];
  for (const org of organizersData) {
    const aboutBilingual = await buildBilingualField(org.about, translateService, org.sourceLang);
    const createdOrg = await prisma.organizer.create({
      data: {
        name: org.name,
        handle: org.handle,
        about: aboutBilingual,
        avatarUrl: org.avatarUrl,
        coverUrl: org.coverUrl,
        followers: org.followers,
      },
    });
    createdOrganizers.push(createdOrg);
  }
  console.log(`✅ Đã tạo thành công 3 Organizers.`);

  // ==========================================
  // 3. TẠO 5 DỮ LIỆU EVENTS
  // ==========================================
  console.log('\n🎟 Đang tạo 5 Events liên kết với Organizers...');
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const rawEvents = [
    {
      sourceLang: 'vi' as const,
      organizerIndex: 0, // PawLife Official
      title: 'Lớp học vẽ nghệ thuật cùng thú cưng',
      category: 'Nghệ thuật',
      description: 'Tham gia lớp học vẽ nghệ thuật cùng những người bạn bốn chân. Trải nghiệm thư giãn tuyệt vời dành cho những người yêu chó và đam mê hội họa.',
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
        'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=300&auto=format&fit=crop'
      ]
    },
    {
      sourceLang: 'vi' as const,
      organizerIndex: 1, // Pawsome Events Co.
      title: 'Hội thi Chó chạy Marathon 2026',
      category: 'Thể thao',
      description: 'Giải chạy bộ đồng hành cùng thú cưng quy mô lớn nhất năm. Cơ hội để thú cưng của bạn thể hiện sức bền và nhận những phần quà giá trị từ nhà tài trợ.',
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
        'https://images.unsplash.com/photo-1504595403659-9088ce801e29?q=80&w=300&auto=format&fit=crop'
      ]
    },
    {
      sourceLang: 'en' as const,
      organizerIndex: 2, // Feline Friends Hub
      title: 'Morning Yoga with Cats',
      category: 'Health',
      description: 'Start your morning with a relaxing yoga session surrounded by our adorable rescue cats. Find your zen and maybe find a new furry family member.',
      bannerUrl: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextMonth.setHours(8, 0, 0, 0)),
      endDate: new Date(nextMonth.setHours(10, 0, 0, 0)),
      locationName: 'Central Park',
      address: 'Central Park West, New York, NY',
      latitude: 40.785091,
      longitude: -73.968285,
      interestedCount: 128,
      images: [
        'https://images.unsplash.com/photo-1596492784531-6e6eb5ea92b5?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop'
      ]
    },
    {
      sourceLang: 'en' as const,
      organizerIndex: 1, // Pawsome Events Co.
      title: 'Puppy Socialization Hour',
      category: 'Training',
      description: 'Bring your puppies for a fun, safe, and supervised socialization hour. This helps them build confidence and learn how to interact properly.',
      bannerUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextWeek.setHours(15, 0, 0, 0)),
      endDate: new Date(nextWeek.setHours(17, 0, 0, 0)),
      locationName: 'City Pet Center',
      address: '456 Pet Avenue, Los Angeles, CA',
      latitude: 34.052235,
      longitude: -118.243683,
      interestedCount: 340,
      images: [
        'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1544568100-847a948585b9?q=80&w=300&auto=format&fit=crop'
      ]
    },
    {
      sourceLang: 'vi' as const,
      organizerIndex: 0, // PawLife Official
      title: 'Ngày hội Nhận Nuôi Chó Mèo 2026',
      category: 'Cộng đồng',
      description: 'Cùng nhau tìm mái ấm cho hơn 50 bé chó mèo cơ nhỡ. Rất nhiều hoạt động vui chơi, tư vấn thú y miễn phí và quà tặng từ nhà tài trợ.',
      bannerUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=800&auto=format&fit=crop',
      startDate: new Date(nextMonth.setHours(9, 0, 0, 0)),
      endDate: new Date(nextMonth.setHours(17, 0, 0, 0)),
      locationName: 'Sân vận động Hoa Lư',
      address: 'Quận 1, TP. Hồ Chí Minh',
      latitude: 10.785369,
      longitude: 106.698377,
      interestedCount: 1550,
      images: [
        'https://images.unsplash.com/photo-1517423568366-8b83523034fd?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?q=80&w=300&auto=format&fit=crop'
      ]
    }
  ];

  for (const raw of rawEvents) {
    console.log(`- Đang xử lý Event: ${raw.title}`);
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
        address: raw.address,
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

  console.log('✅ Đã tạo xong 5 Event song ngữ.');
  await appContext.close();
}

main()
  .then(async () => {
    console.log('\n🎉 HOÀN TẤT! Đã đóng mọi kết nối an toàn.');
    await prisma.$disconnect();
    process.exit(0); 
  })
  .catch(async (e) => {
    console.error('❌ Lỗi khi seed event:', e);
    await prisma.$disconnect();
    process.exit(1);
  });