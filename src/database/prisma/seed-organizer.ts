import { PrismaClient } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module'; // Đảm bảo đường dẫn này trỏ đúng tới app.module.ts của bạn
import { TranslateService } from '../../translate/translate.service'; // Đảm bảo đường dẫn này chuẩn xác

/**
 * Script này khớp đúng với model Event/Organizer hiện có trong schema.prisma:
 *   - Event.category  -> dùng làm "tag nhỏ dưới title" (đúng như comment trong schema)
 *   - Event.startDate / endDate -> mốc bắt đầu/kết thúc tổng (Date đầu tiên -> Date cuối cùng)
 *   - Vì không có field riêng lưu lịch trình chi tiết nhiều khung giờ/ngày, phần lịch trình
 *     (VD: "17/04 9:30-17:30, 18-19/04 9:30-18:30") được nhúng làm đoạn đầu tiên của
 *     Event.description (cả bản vi lẫn en), để không mất thông tin hiển thị.
 *   - Event.locationName / Event.address giữ đúng ý nghĩa: locationName là tên rút gọn
 *     (dịch song ngữ), address là địa chỉ đầy đủ (giữ nguyên, không dịch).
 *
 * Script KHÔNG xoá dữ liệu cũ - chỉ append thêm 3 Organizer + 3 Event mới.
 */

const prisma = new PrismaClient();

async function buildBilingualField(
  text: string,
  translateService: TranslateService,
  sourceLang: 'vi' | 'en' = 'vi',
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

  console.log('Đang tạo 3 Organizers mới (Interpetfest ecosystem, dịch tự động)...');

  const organizersData = [
    {
      sourceLang: 'vi' as const,
      name: 'Eventure JSC',
      handle: '@eventure_jsc',
      about:
        'Đơn vị tổ chức các triển lãm và lễ hội thú cưng quy mô lớn tại Việt Nam, kết nối cộng đồng yêu thú cưng với các xu hướng và sản phẩm mới nhất trong ngành.',
      avatarUrl: 'database/mock/organizer-1-avt.png',
      coverUrl: 'database/mock/event-1-hero-banner.png',
      followers: 18200,
    },
    {
      sourceLang: 'vi' as const,
      name: 'Minh Vi VEAS',
      handle: '@minhvi_veas',
      about:
        'Đơn vị tổ chức sự kiện chuyên nghiệp, mang đến các lễ hội thú cưng thường niên dành cho cộng đồng yêu thú cưng khu vực miền Bắc.',
      avatarUrl: 'database/mock/organizer-2-avt.png',
      coverUrl: 'database/mock/event-2-hero-banner.png',
      followers: 9800,
    },
    {
      sourceLang: 'vi' as const,
      name: 'Interpetfest',
      handle: '@interpetfest',
      about:
        'Ban tổ chức chuỗi sự kiện thú cưng quốc tế InterPetFest, kết nối các đấu trường chuyên nghiệp dành cho cộng đồng nuôi mèo và chó tại Việt Nam.',
      avatarUrl: 'database/mock/organizer-3-avt.png',
      coverUrl: 'database/mock/event-3-hero-banner.png',
      followers: 6400,
    },
  ];

  const createdOrganizers: any[] = [];
  for (const org of organizersData) {
    console.log(`- Đang dịch Organizer: ${org.name}`);
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

  console.log(`✅ Đã tạo thành công ${createdOrganizers.length} Organizers mới!`);
  console.log('Đang tạo 3 Events mới liên kết với Organizers (Dịch tự động)...');

  const rawEvents = [
    // ================= SỰ KIỆN 1 =================
    {
      sourceLang: 'vi' as const,
      organizerIndex: 0, // Eventure JSC
      title: 'Triển lãm & lễ hội thú cưng Interpetfest',
      category: 'Mùa lễ hội', // Tag nhỏ dưới title
      description: `Lịch trình: 17/04/2026 lúc 9:30 - 17:30; 18-19/04/2026 lúc 9:30 - 18:30.

A. HÀNH TRÌNH TOÀN CẦU
Ban tổ chức InterPetFest thành lập các đoàn khách tham quan thương mại và đơn vị triển lãm Việt Nam để tham dự các sự kiện thú cưng uy tín trên khắp thế giới.
Quảng bá gian hàng InterPetFest 2026 tại các triển lãm thú cưng quốc tế lớn trên toàn cầu.
Ban tổ chức InterPetFest đến tham quan các sự kiện thú cưng tại những quốc gia phát triển. Chúng tôi luôn mong muốn tiếp thu những ý tưởng mới, công nghệ mới để áp dụng cho kỳ InterPetFest 2026, đồng thời mở rộng mạng lưới quốc tế nhằm mang lại lợi ích thiết thực cho các đơn vị triển lãm và khách tham quan.

B. SỰ KIỆN QUẢNG BÁ TRONG NƯỚC
Hướng tới phát triển ngành thú cưng Việt Nam, ban tổ chức InterPetFest không chỉ tạo điều kiện kết nối kinh doanh trong ngành, cập nhật xu hướng thú cưng toàn cầu, mà còn mang sứ mệnh nâng cao kiến thức cho người tiêu dùng, khuyến khích nuôi thú cưng, và thay đổi nhận thức của công chúng về thú cưng tại Việt Nam. Điều này đạt được thông qua việc tổ chức các sự kiện cộng đồng như MallPetFest (sự kiện thú cưng tại trung tâm thương mại) và Dogathon (Giải Chạy vì Tương lai Chó Mèo Việt Nam).`,
      bannerUrl: 'database/mock/event-1-hero-banner.png',
      startDate: new Date('2026-04-17T09:30:00+07:00'),
      endDate: new Date('2026-04-19T18:30:00+07:00'),
      locationName: 'NECC, Phường Từ Liêm, Hà Nội',
      address:
        'National Exhibition Construction Center (NECC) - 1 phố Đỗ Đức Dục, phường Từ Liêm, Hà Nội',
      latitude: 21.014444,
      longitude: 105.741944,
      interestedCount: 1240,
      images: [
        'https://images.unsplash.com/photo-1553688738-a278b9f063e0?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517849845537-4d257902861a?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1601758228041-3caa6a2ce6c3?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1543852786-1cf6624b9987?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=300&auto=format&fit=crop',
      ],
    },
    // ================= SỰ KIỆN 2 =================
    {
      sourceLang: 'vi' as const,
      organizerIndex: 1, // Minh Vi VEAS
      title: 'A Grand Season Festival Petfair Vietnam',
      category: 'Mùa lễ hội',
      description: `Lịch trình: 18-20/11/2026 lúc 9:00 - 17:00; 21/11/2026 lúc 9:00 - 16:00.

Tại Grand Season Festival, chúng mình không chỉ mang đến một triển lãm - chúng mình tạo ra một không gian để bạn cùng "người bạn bốn chân" viết nên những kỷ niệm thật đẹp. Đây là nơi hàng nghìn tâm hồn đồng điệu của cộng đồng yêu thú cưng miền Bắc sẽ hội ngộ, cùng sẻ chia và lan tỏa tình yêu thương vô điều kiện!

Đến đây, bạn sẽ thấy hạnh phúc hiện hữu qua từng trải nghiệm.
• Nơi hàng nghìn "đồng môn" cùng đam mê gặp gỡ, sẻ chia bí kíp chăm Boss và cùng nhau tạo nên một cộng đồng vững mạnh.
• Không cần qua màn hình, bạn sẽ được trực tiếp cùng Boss tham gia các diễn đàn chia sẻ kiến thức, xem các màn trình diễn quốc tế và hòa mình vào không khí lễ hội tưng bừng.
• Khu vực tương tác được thiết kế riêng để bạn và thú cưng cùng lưu lại những tấm hình kỷ niệm ý nghĩa trong không gian lễ hội rực rỡ.
• Dành tặng cho Boss yêu những trải nghiệm chăm sóc sức khỏe và làm đẹp từ các đối tác thú y uy tín.

Tại Grand Season Festival, mọi kết nối đều là thật, mọi trải nghiệm đều đầy ắp sự thấu hiểu.`,
      bannerUrl: 'database/mock/event-2-hero-banner.png',
      startDate: new Date('2026-11-18T09:00:00+07:00'),
      endDate: new Date('2026-11-21T16:00:00+07:00'),
      locationName: 'VEC, Phường Đông Anh, Hà Nội',
      address:
        'Vietnam Exposition Center (VEC) - Đường Cầu Tứ Liên, phường Đông Anh, Hà Nội',
      latitude: 21.133889,
      longitude: 105.850556,
      interestedCount: 980,
      images: [
        'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517423568366-8b83523034fd?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546975490-a79ee8ebfb72?q=80&w=300&auto=format&fit=crop',
      ],
    },
    // ================= SỰ KIỆN 3 =================
    {
      sourceLang: 'vi' as const,
      organizerIndex: 2, // Interpetfest
      title: 'WCF Jubilee Cat Show 2026',
      category: 'Cuộc thi cho mèo',
      description: `Lịch trình: 29-30/08/2026.

Nằm trong khuôn khổ Triển lãm và Lễ hội Thú cưng InterPetFest 2026, WCF Jubilee Cat Show 2026 là đấu trường chuyên nghiệp hàng đầu dành cho giới nuôi mèo chuyên nghiệp và cộng đồng yêu mèo tại Việt Nam và các nước lân cận.

Sự kiện quy tụ gần 100 thí sinh mèo xuất sắc thuộc đa dạng các giống mèo, cùng sự xuất hiện của dàn Ban giám khảo (BGK) quốc tế uy tín từ Liên đoàn Mèo Thế giới (WCF).

DANH SÁCH CÁC BẢNG THI ĐẤU:
• Adult: Mèo trưởng thành
• Junior: Mèo lứa tuổi thanh niên
• Kitten: Mèo nhỏ
• Neuter: Mèo đã triệt sản
• Household Pet: Mèo nhà

BAN GIÁM KHẢO QUỐC TẾ:
• Giám khảo Jurgen Gunther Trautmann từ CHLB Đức
• Giám khảo Olga Kuznetsova từ Liên Bang Nga
• Giám khảo Ekaterina Shershavikova từ Liên Bang Nga`,
      bannerUrl: 'database/mock/event-3-hero-banner.png',
      startDate: new Date('2026-08-29T09:00:00+07:00'),
      endDate: new Date('2026-08-30T18:00:00+07:00'),
      locationName: 'SECC, Phường Tân Mỹ, TP. Hồ Chí Minh',
      // ⚠️ Địa chỉ SECC bạn gửi bị trùng địa chỉ NECC (Hà Nội) - mình sửa lại cho
      // đúng khu vực TP.HCM, bạn kiểm tra và chỉnh lại địa chỉ chính xác nếu cần.
      address:
        'Saigon Exhibition and Convention Center (SECC) - 799 Nguyễn Văn Linh, phường Tân Mỹ, TP. Hồ Chí Minh',
      latitude: 10.729722,
      longitude: 106.721944,
      interestedCount: 760,
      images: [
        'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1573865526739-10659fec78a5?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1596492784531-6e6eb5ea92b5?q=80&w=300&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511044568932-338cba0ad803?q=80&w=300&auto=format&fit=crop',
      ],
    },
  ];

  for (const raw of rawEvents) {
    console.log(`- Đang dịch Event: ${raw.title}`);
    const titleBilingual = await buildBilingualField(raw.title, translateService, raw.sourceLang);
    const categoryBilingual = await buildBilingualField(raw.category, translateService, raw.sourceLang);
    const descBilingual = await buildBilingualField(raw.description, translateService, raw.sourceLang);
    const locNameBilingual = await buildBilingualField(raw.locationName, translateService, raw.sourceLang);

    await prisma.event.create({
      data: {
        title: titleBilingual,
        category: categoryBilingual, // dùng làm tag nhỏ dưới title
        description: descBilingual,
        locationName: locNameBilingual,
        address: raw.address, // Address giữ nguyên, không dịch
        bannerUrl: raw.bannerUrl,
        startDate: raw.startDate,
        endDate: raw.endDate,
        latitude: raw.latitude,
        longitude: raw.longitude,
        interestedCount: raw.interestedCount,
        organizerId: createdOrganizers[raw.organizerIndex].id,
        images: {
          create: raw.images.map((url) => ({ url })),
        },
      },
    });
  }

  console.log('✅ Đã tạo xong 3 Event + 3 Organizer song ngữ mới cho Interpetfest!');

  await appContext.close();
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed event/organizer Interpetfest:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });