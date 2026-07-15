import { PrismaClient } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module'; // Đảm bảo đường dẫn trỏ đúng tới app.module.ts
import { TranslateService } from '../../translate/translate.service'; 

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
    // 3 Tổ chức mới
    {
      sourceLang: 'vi' as const,
      name: 'Eventure JSC',
      handle: '@eventure_jsc',
      about: 'Đơn vị tổ chức các sự kiện quy mô lớn, chuyên kết nối cộng đồng yêu thú cưng và các doanh nghiệp trong ngành công nghiệp thú cưng tại Việt Nam.',
      avatarUrl: 'organizer-1-avt.png',
      coverUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=800&auto=format&fit=crop',
      followers: 15400,
    },
    {
      sourceLang: 'vi' as const,
      name: 'Minh Vi VEAS',
      handle: '@minhvi_veas',
      about: 'Minh Vi Exhibition & Advertisement Services (VEAS) - Nhà tổ chức triển lãm quốc tế hàng đầu tại Việt Nam, mang đến các sự kiện B2B và B2C chuyên nghiệp.',
      avatarUrl: 'organizer-2-avt.png',
      coverUrl: 'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?q=80&w=800&auto=format&fit=crop',
      followers: 12300,
    },
    {
      sourceLang: 'vi' as const,
      name: 'Interpetfest',
      handle: '@interpetfest',
      about: 'Cộng đồng tổ chức Lễ hội và Triển lãm Thú cưng quốc tế, sân chơi chuyên nghiệp dành cho giới nuôi thú cưng tại Việt Nam và khu vực.',
      avatarUrl: 'organizer-3-avt.png',
      coverUrl: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?q=80&w=800&auto=format&fit=crop',
      followers: 25600,
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

  // Khai báo data event trước để lặp qua dịch thay vì create cứng
  const rawEvents = [
    {
      sourceLang: 'vi' as const,
      organizerIndex: 0, // Eventure JSC
      title: 'Triển lãm & lễ hội thú cưng Interpetfest',
      category: 'Mùa lễ hội',
      description: 'A. HÀNH TRÌNH TOÀN CẦU\nBan tổ chức InterPetFest thành lập các đoàn khách tham quan thương mại và đơn vị triển lãm Việt Nam để tham dự các sự kiện thú cưng uy tín trên khắp thế giới.\n\nQuảng bá gian hàng InterPetFest 2026 tại các triển lãm thú cưng quốc tế lớn trên toàn cầu.\n\nBan tổ chức InterPetFest đến tham quan các sự kiện thú cưng tại những quốc gia phát triển. Chúng tôi luôn mong muốn tiếp thu những ý tưởng mới, công nghệ mới để áp dụng cho kỳ InterPetFest 2026, đồng thời mở rộng mạng lưới quốc tế nhằm mang lại lợi ích thiết thực cho các đơn vị triển lãm và khách tham quan.\n\nB. SỰ KIỆN QUẢNG BÁ TRONG NƯỚC\nHướng tới phát triển ngành thú cưng Việt Nam, ban tổ chức InterPetFest không chỉ tạo điều kiện kết nối kinh doanh trong ngành, cập nhật xu hướng thú cưng toàn cầu, mà còn mang sứ mệnh nâng cao kiến thức cho người tiêu dùng, khuyến khích nuôi thú cưng, và thay đổi nhận thức của công chúng về thú cưng tại Việt Nam.\nĐiều này đạt được thông qua việc tổ chức các sự kiện cộng đồng như MallPetFest (sự kiện thú cưng tại trung tâm thương mại và Dogathon (Giải Chạy vì Tương lai Chó Mèo Việt Nam)',
      bannerUrl: 'database/mock/event-1-hero-banner.png',
      // Lấy theo mốc bắt đầu sớm nhất và kết thúc muộn nhất
      startDate: new Date('2026-04-17T09:30:00'),
      endDate: new Date('2026-04-19T18:30:00'),
      locationName: 'NECC',
      address: 'National Exhibition Construction Center (NECC) - 1 phố Đỗ Đức Dục, Phường Từ Liêm, Hà Nội',
      latitude: 21.0135,
      longitude: 105.7904,
      interestedCount: 1540,
      images: [
        'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=300&auto=format&fit=crop'
      ]
    },
    {
      sourceLang: 'vi' as const,
      organizerIndex: 1, // Minh Vi VEAS
      title: 'A Grand Season Festival Petfair Vietnam',
      category: 'Mùa lễ hội',
      description: 'Tại Grand Season Festival, chúng mình không chỉ mang đến một triển lãm - chúng mình tạo ra một không gian để bạn cùng "người bạn bốn chân" viết nên những kỷ niệm thật đẹp. Đây là nơi hàng nghìn tâm hồn đồng điệu của cộng đồng yêu thú cưng miền Bắc sẽ hội ngộ, cùng sẻ chia và lan tỏa tình yêu thương vô điều kiện!\n\nĐến đây, bạn sẽ thấy hạnh phúc hiện hữu qua từng trải nghiệm.\n\n• Nơi hàng nghìn "đồng môn" cùng đam mê gặp gỡ, sẻ chia bí kíp chăm Boss và cùng nhau tạo nên một cộng đồng vững mạnh.\n• Không cần qua màn hình, bạn sẽ được trực tiếp cũng Boss tham gia các diễn đận chia sẻ kiển thức, xem các màn trình diễn quốc tế và hòa mình vào không khí lễ hội tưng bừng.\n• Khu vực tương tác được thiết kế riêng để bạn và thú cưng cùng lưu lại những tấm hình kỷ niệm ý nghĩa trong không gian lễ hội rực rỡ.\n• Dành tặng cho Boss yêu những trải nghiệm chăm sóc sức khỏe và làm đẹp từ các đối tác thú y uy tín.\n\nTại Grand Season Festival, mọi kết nối đều là thật, mọi trải nghiệm đều đầy ắp sự thấu hiểu.',
      bannerUrl: 'database/mock/event-2-hero-banner.png',
      startDate: new Date('2026-11-18T09:00:00'),
      endDate: new Date('2026-11-21T16:00:00'),
      locationName: 'VEC',
      address: 'Vietnam Exposition Center (VEC) - Đường Cầu Tứ Liên, Phường Đông Anh, Hà Nội',
      latitude: 21.1118,
      longitude: 105.8344,
      interestedCount: 2200,
      images: [
        'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1504595403659-9088ce801e29?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517423568366-8b83523034fd?q=80&w=300&auto=format&fit=crop'
      ]
    },
    {
      sourceLang: 'vi' as const,
      organizerIndex: 2, // Interpetfest
      title: 'WCF Jubilee Cat Show 2026',
      category: 'Cuộc thi cho mèo',
      description: 'Nằm trong khuôn khổ Triển lãm và Lễ hội Thú cưng InterPetFest 2026, WCF Jubilee Cat Show 2026 là đấu trường chuyên nghiệp hàng đầu dành cho giới nuôi mèo chuyên nghiệp và cộng đồng yêu mèo tại Việt Nam và các nước lân cận.\n\nSự kiện quy tụ gần 100 thí sinh mèo xuất sắc thuộc đa dạng các giồng mèo, cùng sự xuất hiện của dàn Ban giám khảo (BGK) quốc tế uy tín từ Liên đoàn Mèo Thế giới (WCF).\n\nDANH SÁCH CÁC BẢNG THI ĐẤU:\n• Adult: Mèo trưởng thành\n• Junior: Mèo lứa tuối thanh niên\n• Kitten: Mèo nhỏ\n• Neuter: Mèo đã triệt sản\n• Household Pet: Mèo nhà\n\nBAN GIÁM KHẢO QUỐC TẾ:\n• Giám khảo JURGEN GUNTHER TRAUTMANN từ CHLB ĐỨC\n• Giám khảo OLGA KUZNETSOVA từ Liên Bang NGA\n• Giám khảo EKATERINA SHERSHAVIKOVA từ Liên Bang NGA',
      bannerUrl: 'database/mock/event-3-hero-banner.png',
      startDate: new Date('2026-08-29T09:00:00'),
      endDate: new Date('2026-08-30T18:00:00'),
      locationName: 'SECC',
      // Dùng địa chỉ user yêu cầu (mặc dù SECC thực tế ở Q7 TP.HCM, nhưng giữ nguyên data yêu cầu của bạn)
      address: 'Saigon Exhibition and Convention Center (SECC) - 1 phố Đỗ Đức Dục, Phường Từ Liêm, TP. Hồ Chí Minh',
      latitude: 10.7300,
      longitude: 106.7217,
      interestedCount: 3150,
      images: [
        'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1573865526739-10659fec78a5?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511044568932-338cba0ad803?q=80&w=300&auto=format&fit=crop'
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

  console.log('✅ Đã tạo xong dữ liệu Organizer và Event song ngữ với đầy đủ Gallery ảnh!');
  
  // Tắt app để giải phóng cổng/bộ nhớ
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