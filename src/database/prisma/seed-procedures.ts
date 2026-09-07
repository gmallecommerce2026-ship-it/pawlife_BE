// prisma/seed-procedures.ts
import { PrismaClient, ProcedureDocType } from '@prisma/client';

const prisma = new PrismaClient();

const STEP_MICROCHIP_STANDARD = {
  stepCode: 's_microchip_std',
  title: 'Gắn microchip (số định danh)',
  subtitle: 'Bệnh viện/phòng khám thú y',
  desc: 'Gắn microchip 15 số đạt tiêu chuẩn ISO cho chó/mèo trước khi tiêm vaccine dại để bắt đầu quy trình nhập cảnh.',
  notes: [
    'Microchip phải tuân thủ các tiêu chuẩn ISO 11784 và ISO 11785',
    'Đảm bảo số microchip có thể được đọc bằng thiết bị đọc microchip tại các bệnh viện/phòng khám thú y.',
  ],
  hasButton: true,
};

const STEP_RABIES_1_STANDARD = {
  stepCode: 's_rabies_1_std',
  title: 'Tiêm mũi vaccine dại đầu tiên',
  subtitle: 'Bệnh viện/phòng khám thú y',
  desc: 'Vaccine phòng bệnh dại phải được tiêm sau khi cấy microchip.',
  notes: [
    'Chó/mèo phải đủ ít nhất 91 ngày tuổi tại thời điểm tiêm phòng (ngày sinh được tính là ngày 0).',
    'Tiêm vaccine dại có thể thực hiện cùng ngày cấy microchip.',
  ],
  hasButton: true,
};

const STEP_FLIGHT_BOOKING = {
  stepCode: 's_flight_booking',
  title: 'Đặt chỗ trước cho thú cưng',
  subtitle: 'Đại diện hãng hàng không',
  desc: 'Liên hệ hotline hoặc phòng vé của hãng hàng không ngay sau khi mua vé máy bay.',
  notes: [
    'Các chuyến bay giới hạn số lượng động vật sống trên mỗi chuyến, nếu không đặt trước chó/mèo có thể bị từ chối vận chuyển.',
  ],
  hasButton: true,
};

const STEP_RABIES_2_STANDARD = {
  stepCode: 's_rabies_2_std',
  title: 'Tiêm mũi vaccine dại thứ 2',
  subtitle: 'Bệnh viện/phòng khám thú y',
  desc: 'Tiêm nhắc lại để duy trì hiệu lực bảo vệ và tiếp tục quy trình nhập cảnh.',
  notes: [
    'Ít nhất 30 ngày sau lần tiêm phòng đầu tiên (ngày tiêm phòng đầu tiên được tính là ngày 0)',
    'Trong thời gian hiệu lực của lần tiêm phòng đầu tiên',
  ],
  hasButton: true,
};

const STEP_FLIGHT_CONFIRM = {
  stepCode: 's_flight_confirm',
  title: 'Xác nhận chỗ cho thú cưng',
  subtitle: 'Đại diện hãng hàng không',
  desc: 'Sau khi đã có đủ giấy tờ, liên hệ lại hãng hàng không để bổ sung giấy tờ và thanh toán chi phí.',
  notes: [
    'Lồng vận chuyển bắt buộc phải tuân thủ nghiêm ngặt theo tiêu chuẩn của IATA (Hiệp hội Vận tải Hàng không Quốc tế).',
  ],
  hasButton: true,
};

const STEP_HEALTH_CERT_STANDARD = {
  stepCode: 's_health_cert_std',
  title: 'Giấy chứng nhận sức khỏe',
  subtitle: 'Thú y có thẩm quyền được Cục Thú Y xác nhận',
  desc: 'Chó/mèo phải được bác sĩ thú y thực hiện kiểm tra sức khỏe lâm sàng trong vòng 10 ngày trước khi lên máy bay.',
  notes: ['Xác nhận không có bất kỳ dấu hiệu lâm sàng nào của bệnh truyền nhiễm.'],
  hasButton: true,
};

const STEP_EXPORT_REG = {
  stepCode: 's_export_reg',
  title: 'Đăng ký thủ tục kiểm dịch xuất khẩu',
  subtitle: 'Chi cục Thú y Vùng',
  desc: 'Mang thú cưng cùng toàn bộ hồ sơ (sổ tiêm, kết quả huyết thanh dại, giấy chứng nhận sức khỏe, hộ chiếu chủ nuôi, vé máy bay) để làm thủ tục kiểm dịch xuất khẩu.',
  notes: [
    'Địa chỉ nộp hồ sơ tại Việt Nam:',
    'Tại TP.HCM: Chi cục Thú y vùng VI (Số 521 Hoàng Văn Thụ, Phường 4, Quận Tân Bình).',
    'Tại Hà Nội: Chi cục Thú y vùng I (Số 50 ngõ 102 Trường Chinh, Phương Mai, Đống Đa).',
  ],
  hasButton: true,
};

const STEP_EXPORT_CERT_30D = {
  stepCode: 's_export_cert_30d',
  title: 'Giấy chứng nhận kiểm dịch động vật xuất khẩu',
  subtitle: 'Cơ quan nhà nước có thẩm quyền của quốc gia xuất khẩu',
  desc: 'Đến Chi cục Thú y vùng nhận Giấy chứng nhận kiểm dịch xuất khẩu chính thức và sẵn sàng xuất cảnh.',
  notes: [
    'Nếu giấy chứng nhận có thiếu sót hoặc không đáp ứng yêu cầu, chó/mèo có thể phải cách ly kiểm dịch tại cơ sở lưu giữ trong thời gian tối đa 30 ngày hoặc bị đưa trở lại quốc gia xuất khẩu.',
  ],
  hasButton: true,
};

const STEP_EU_LOCK = {
  stepCode: 's_eu_lock',
  title: 'Chờ thời gian khóa kiểm dịch',
  subtitle: 'Thú y có thẩm quyền được Cục Thú Y xác nhận',
  desc: 'Quy định bắt buộc thú cưng không được nhập cảnh EU trong vòng 3 tháng (90 ngày) kể từ ngày lấy máu.',
  notes: ['Ngày lấy mẫu máu được tính là ngày 0'],
  hasButton: false,
};

const STEP_RABIES_TEST_EU = {
  stepCode: 's_rabies_test_eu',
  title: 'Xét nghiệm kháng thể dại',
  subtitle: 'Phòng xét nghiệm được chỉ định',
  desc: 'Mẫu máu (huyết thanh) sẽ được gửi sang Lab được EU cấp phép tại châu Âu.',
  notes: [
    'Hiệu giá kháng thể bệnh dại phải đạt từ 0,5 IU/ml trở lên.',
    'Thời gian đợi kết quả giấy tờ gửi về thường mất từ 2 - 4 tuần.',
  ],
  hasButton: true,
};

const createCustomsStep = (countryName: string) => ({
  stepCode: `s_customs_${countryName}`,
  title: 'Khai báo và kiểm dịch tại hải quan',
  subtitle: 'Kiểm dịch động vật (Animal Quarantine Service)',
  desc: `Người nhập khẩu phải khai báo thông tin để cán bộ hải quan tiến hành kiểm dịch đối chiếu ngay khi đến ${countryName}.`,
  notes: [
    'Cơ quan Kiểm dịch Động vật sẽ cấp Giấy chứng nhận kiểm dịch nhập khẩu (Import Quarantine Certificate) cho chó/mèo đủ điều kiện.',
  ],
  hasButton: true,
});

const COUNTRIES = [
  { id: 'japan', nameVi: 'Nhật Bản', nameEn: 'Japan', flag: '🇯🇵', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e', anchorX: 0, anchorY: 0, anchorScale: 1.05, sortOrder: 1 },
  { id: 'china', nameVi: 'Trung Quốc', nameEn: 'China', flag: '🇨🇳', durationVi: '1-2 tháng', durationEn: '1-2 months', imageUrl: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d', anchorX: 0, anchorY: 0.55, anchorScale: 1.05, sortOrder: 2 },
  { id: 'vietnam', nameVi: 'Việt Nam', nameEn: 'Vietnam', flag: '🇻🇳', durationVi: '1 tháng', durationEn: '1 month', imageUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592', anchorX: 0, anchorY: -0.1, anchorScale: 1.05, sortOrder: 3 },
  { id: 'france', nameVi: 'Pháp', nameEn: 'France', flag: '🇫🇷', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34', anchorX: 0, anchorY: 0.8, anchorScale: 1.05, sortOrder: 4 },
  { id: 'italy', nameVi: 'Ý', nameEn: 'Italy', flag: '🇮🇹', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963', anchorX: 0, anchorY: 0.5, anchorScale: 1.05, sortOrder: 5 },
  { id: 'egypt', nameVi: 'Ai Cập', nameEn: 'Egypt', flag: '🇪🇬', durationVi: '1 tháng', durationEn: '1 month', imageUrl: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368', anchorX: 0, anchorY: -0.7, anchorScale: 1.05, sortOrder: 6 },
  { id: 'greece', nameVi: 'Hy Lạp', nameEn: 'Greece', flag: '🇬🇷', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077', anchorX: 0, anchorY: -0.3, anchorScale: 1.05, sortOrder: 7 },
  { id: 'korea', nameVi: 'Hàn Quốc', nameEn: 'South Korea', flag: '🇰🇷', durationVi: '2 tháng', durationEn: '2 months', imageUrl: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451', anchorX: 0, anchorY: 0, anchorScale: 1.05, sortOrder: 8 },
  { id: 'germany', nameVi: 'Đức', nameEn: 'Germany', flag: '🇩🇪', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b', anchorX: 0, anchorY: 0.25, anchorScale: 1.05, sortOrder: 9 },
  { id: 'switzerland', nameVi: 'Thụy Sỹ', nameEn: 'Switzerland', flag: '🇨🇭', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99', anchorX: 0, anchorY: 0, anchorScale: 1.05, sortOrder: 10 },
];

export async function seedProcedures() {
  console.log('Seeding Entry Procedures & Milestones...');

  for (const c of COUNTRIES) {
    await prisma.countryProcedure.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    });
  }

  // Seed Milestones cho Nhật Bản
  const jpMilestones = [
    { dateLabel: 'Ngày 0', sortOrder: 1, steps: [STEP_MICROCHIP_STANDARD, STEP_RABIES_1_STANDARD, STEP_FLIGHT_BOOKING] },
    {
      dateLabel: 'Ngày 30 - 40',
      sortOrder: 2,
      steps: [
        STEP_RABIES_2_STANDARD,
        {
          stepCode: 'jp_test',
          title: 'Xét nghiệm kháng thể dại',
          subtitle: 'Phòng xét nghiệm được chỉ định',
          desc: 'Mẫu máu để xét nghiệm phải được lấy sau lần tiêm phòng bệnh dại thứ hai.',
          notes: ['Hiệu giá kháng thể bệnh dại phải đạt từ 0,5 IU/ml trở lên.', 'Kết quả xét nghiệm có giá trị trong vòng 2 năm kể từ ngày lấy mẫu máu.'],
          hasButton: true,
        },
      ],
    },
    {
      dateLabel: 'Ngày 40 - 220',
      sortOrder: 3,
      steps: [
        {
          stepCode: 'jp_wait',
          title: 'Thời gian chờ (180 ngày)',
          subtitle: 'Ngày lấy mẫu máu được tính là ngày 0',
          desc: 'Chó/mèo nhập cảnh vào Nhật Bản sau khi đã đủ 180 ngày kể từ ngày lấy mẫu máu để xét nghiệm kháng thể dại.',
          hasButton: false,
        },
        STEP_FLIGHT_CONFIRM,
      ],
    },
    {
      dateLabel: 'Ngày 40 - 180',
      sortOrder: 4,
      steps: [
        {
          stepCode: 'jp_notify',
          title: 'Thông báo trước khi nhập cảnh',
          subtitle: 'Kiểm dịch động vật (Animal Quarantine Service)',
          desc: 'Nộp đơn thông báo nhập cảnh động vật cho AQS ít nhất 40 ngày trước chuyến bay đến Nhật Bản.',
          notes: ['Chó chỉ được phép nhập cảnh vào Nhật Bản thông qua các sân bay và cảng biển được chỉ định.'],
          hasButton: true,
        },
      ],
    },
    {
      dateLabel: 'Ngày 210 - 215',
      sortOrder: 5,
      steps: [
        {
          stepCode: 'jp_health',
          title: 'Kiểm tra sức khỏe trước khi xuất cảnh',
          subtitle: 'Thú y có thẩm quyền được Cục Thú Y xác nhận',
          desc: 'Chó/mèo phải được bác sĩ thú y thực hiện kiểm tra lâm sàng trong vòng 10 ngày trước khi lên máy bay.',
          notes: ['Xác nhận không có bất kỳ dấu hiệu lâm sàng nào của bệnh dại.', 'Đối với chó, cần xác nhận thêm rằng không có bất kỳ dấu hiệu nào của bệnh leptospirosis (bệnh xoắn khuẩn).'],
          hasButton: true,
        },
        STEP_EXPORT_REG,
      ],
    },
    {
      dateLabel: 'Ngày 215 - 219',
      sortOrder: 6,
      steps: [
        {
          stepCode: 'jp_cert',
          title: 'Giấy chứng nhận kiểm dịch động vật xuất khẩu',
          subtitle: 'Cơ quan nhà nước có thẩm quyền của quốc gia xuất khẩu',
          desc: 'Đến Chi cục Thú y vùng nhận Giấy chứng nhận kiểm dịch xuất khẩu chính thức và sẵn sàng xuất cảnh.',
          notes: ['Nếu giấy chứng nhận có thiếu sót hoặc không đáp ứng yêu cầu, chó/mèo có thể phải cách ly kiểm dịch tại cơ sở lưu giữ trong thời gian tối đa 180 ngày hoặc bị đưa trở lại quốc gia xuất khẩu.'],
          hasButton: true,
        },
      ],
    },
    {
      dateLabel: 'Ngày 220: Nhập cảnh Nhật Bản',
      sortOrder: 7,
      steps: [
        {
          stepCode: 'jp_entry',
          title: 'Nhập cảnh và kiểm dịch động vật',
          subtitle: 'Kiểm dịch động vật (Animal Quarantine Service)',
          desc: 'Người nhập khẩu phải đăng ký yêu cầu kiểm tra nhập khẩu với Cơ quan Kiểm dịch Động vật ngay khi đến Nhật Bản.',
          notes: ['Cơ quan Kiểm dịch Động vật sẽ cấp Giấy chứng nhận kiểm dịch nhập khẩu (Import Quarantine Certificate) cho chó/mèo đủ điều kiện.'],
          hasButton: true,
        },
      ],
    },
  ];

  // Lưu milestones và steps
  for (const m of jpMilestones) {
    const createdMilestone = await prisma.procedureMilestone.create({
      data: {
        countryId: 'japan',
        dateLabel: m.dateLabel,
        sortOrder: m.sortOrder,
        steps: {
          create: m.steps.map((s, idx) => ({
            stepCode: s.stepCode,
            title: s.title,
            subtitle: s.subtitle,
            desc: s.desc,
            notes: s.notes || [],
            hasButton: s.hasButton ?? true,
            sortOrder: idx,
          })),
        },
      },
    });
  }

  // Seed mẫu Pet Paradise liên kết với Nhật Bản
  await prisma.petParadise.upsert({
    where: { id: '1' },
    update: {},
    create: {
      id: '1',
      countryId: 'japan',
      name: 'Đảo Tashirojima',
      categoryVi: 'Đảo nhỏ ngoài khơi',
      categoryEn: 'Small offshore island',
      statusTextVi: 'Đang mở',
      statusTextEn: 'Opening',
      introText: 'Hòn đảo nhỏ hòa mình với biển xanh, làng chài yên bình và cả một "vương quốc mèo" thân thiện.',
      areaVi: 'Hòn đảo có chu vi khoảng 11 km',
      areaEn: 'The island has a circumference of about 11 km',
      howToGetVi: 'Thời gian di chuyển bằng tàu hoặc phà ra đảo từ cảng tại thành phố Ishinomaki mất khoảng 40 phút.',
      howToGetEn: 'Travel time by boat or ferry to the island from the port in Ishinomaki city takes about 40 minutes.',
      addressVi: 'Thành phố Ishinomaki, Miyagi, Nhật Bản',
      addressEn: 'Ishinomaki City, Miyagi, Japan',
      latitude: 38.2974,
      longitude: 141.4172,
      rating: 4.8,
      reviewsCount: 123,
      heroImage: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=1000&auto=format&fit=crop',
      galleryImages: [
        'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=800&auto=format&fit=crop',
      ],
      experiences: [
        {
          titleVi: 'Vương quốc của loài mèo',
          titleEn: 'Cat Kingdom',
          descVi: 'Số lượng mèo ở đây lớn hơn rất nhiều so với người dân, được người dân địa phương xem là biểu tượng mang lại may mắn và thịnh vượng.',
          descEn: 'The cat population far outnumbers local residents and is regarded as a symbol of good luck and prosperity.',
        },
      ],
    },
  });

  console.log('Seeding procedures completed successfully!');
}

seedProcedures()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });