// src/database/prisma/seed-all.ts
import { PrismaClient, ProcedureDocType } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// =========================================================================
// 1. TYPESAFE INTERFACES
// =========================================================================
export interface StepItem {
  stepCode?: string;
  title: string;
  subtitle: string;
  desc: string;
  notes?: string[];
  hasButton?: boolean;
  borderColor?: string;
}

export interface MilestoneItem {
  dateLabel: string;
  sortOrder: number;
  steps: StepItem[];
}

export interface DocumentSeedItem {
  countryId: string;
  titleVi: string;
  titleEn: string;
  meta: string;
  type: ProcedureDocType;
  fileUrl: string;
  category: string;
  sortOrder: number;
}

export interface PetParadiseSeedItem {
  id: string;
  countryId: string;
  name: string;
  categoryVi: string;
  categoryEn: string;
  statusTextVi: string;
  statusTextEn: string;
  introText: string;
  areaVi?: string;
  areaEn?: string;
  howToGetVi?: string;
  howToGetEn?: string;
  addressVi: string;
  addressEn: string;
  latitude: number;
  longitude: number;
  googlePlaceKeyword: string;
  googlePlaceId?: string;
  rating: number;
  reviewsCount: number;
  heroImage: string;
  galleryImages: string[];
  experiences: Array<{
    titleVi: string;
    titleEn: string;
    descVi: string;
    descEn: string;
  }>;
}

// =========================================================================
// 2. CÁC BƯỚC MẪU (STANDARD STEPS)
// =========================================================================
const STEP_MICROCHIP_STANDARD: StepItem = {
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

const STEP_RABIES_1_STANDARD: StepItem = {
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

const STEP_FLIGHT_BOOKING: StepItem = {
  stepCode: 's_flight_booking',
  title: 'Đặt chỗ trước cho thú cưng',
  subtitle: 'Đại diện hãng hàng không',
  desc: 'Liên hệ hotline hoặc phòng vé của hãng hàng không ngay sau khi mua vé máy bay.',
  notes: [
    'Các chuyến bay giới hạn số lượng động vật sống trên mỗi chuyến, nếu không đặt trước chó/mèo có thể bị từ chối vận chuyển.',
  ],
  hasButton: true,
};

const STEP_RABIES_2_STANDARD: StepItem = {
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

const STEP_FLIGHT_CONFIRM: StepItem = {
  stepCode: 's_flight_confirm',
  title: 'Xác nhận chỗ cho thú cưng',
  subtitle: 'Đại diện hãng hàng không',
  desc: 'Sau khi đã có đủ giấy tờ, liên hệ lại hãng hàng không để bổ sung giấy tờ và thanh toán chi phí.',
  notes: [
    'Lồng vận chuyển bắt buộc phải tuân thủ nghiêm ngặt theo tiêu chuẩn của IATA (Hiệp hội Vận tải Hàng không Quốc tế).',
  ],
  hasButton: true,
};

const STEP_HEALTH_CERT_STANDARD: StepItem = {
  stepCode: 's_health_cert_std',
  title: 'Giấy chứng nhận sức khỏe',
  subtitle: 'Thú y có thẩm quyền được Cục Thú Y xác nhận',
  desc: 'Chó/mèo phải được bác sĩ thú y thực hiện kiểm tra sức khỏe lâm sàng trong vòng 10 ngày trước khi lên máy bay.',
  notes: ['Xác nhận không có bất kỳ dấu hiệu lâm sàng nào của bệnh truyền nhiễm.'],
  hasButton: true,
};

const STEP_EXPORT_REG: StepItem = {
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

const STEP_EXPORT_CERT_30D: StepItem = {
  stepCode: 's_export_cert_30d',
  title: 'Giấy chứng nhận kiểm dịch động vật xuất khẩu',
  subtitle: 'Cơ quan nhà nước có thẩm quyền của quốc gia xuất khẩu',
  desc: 'Đến Chi cục Thú y vùng nhận Giấy chứng nhận kiểm dịch xuất khẩu chính thức và sẵn sàng xuất cảnh.',
  notes: [
    'Nếu giấy chứng nhận có thiếu sót hoặc không đáp ứng yêu cầu, chó/mèo có thể phải cách ly kiểm dịch tại cơ sở lưu giữ trong thời gian tối đa 30 ngày hoặc bị đưa trở lại quốc gia xuất khẩu.',
  ],
  hasButton: true,
};

const STEP_EU_LOCK: StepItem = {
  stepCode: 's_eu_lock',
  title: 'Chờ thời gian khóa kiểm dịch',
  subtitle: 'Thú y có thẩm quyền được Cục Thú Y xác nhận',
  desc: 'Quy định bắt buộc thú cưng không được nhập cảnh EU trong vòng 3 tháng (90 ngày) kể từ ngày lấy máu.',
  notes: ['Ngày lấy mẫu máu được tính là ngày 0'],
  hasButton: false,
};

const STEP_RABIES_TEST_EU: StepItem = {
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

const createCustomsStep = (countryName: string): StepItem => ({
  stepCode: `s_customs_${countryName}`,
  title: 'Khai báo và kiểm dịch tại hải quan',
  subtitle: 'Kiểm dịch động vật (Animal Quarantine Service)',
  desc: `Người nhập khẩu phải khai báo thông tin để cán bộ hải quan tiến hành kiểm dịch đối chiếu ngay khi đến ${countryName}.`,
  notes: [
    'Cơ quan Kiểm dịch Động vật sẽ cấp Giấy chứng nhận kiểm dịch nhập khẩu (Import Quarantine Certificate) cho chó/mèo đủ điều kiện.',
  ],
  hasButton: true,
});

// =========================================================================
// 3. DANH SÁCH 10 QUỐC GIA (COUNTRIES)
// =========================================================================
const COUNTRIES = [
  { id: 'japan', nameVi: 'Nhật Bản', nameEn: 'Japan', flag: '🇯🇵', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'japan-img.png', anchorX: 0, anchorY: 0, anchorScale: 1.05, sortOrder: 1 },
  { id: 'china', nameVi: 'Trung Quốc', nameEn: 'China', flag: '🇨🇳', durationVi: '1-2 tháng', durationEn: '1-2 months', imageUrl: 'china-img.png', anchorX: 0, anchorY: 0.55, anchorScale: 1.05, sortOrder: 2 },
  { id: 'vietnam', nameVi: 'Việt Nam', nameEn: 'Vietnam', flag: '🇻🇳', durationVi: '1 tháng', durationEn: '1 month', imageUrl: 'vietnam-img.png', anchorX: 0, anchorY: -0.1, anchorScale: 1.05, sortOrder: 3 },
  { id: 'france', nameVi: 'Pháp', nameEn: 'France', flag: '🇫🇷', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'franch-img.png', anchorX: 0, anchorY: 0.8, anchorScale: 1.05, sortOrder: 4 },
  { id: 'italy', nameVi: 'Ý', nameEn: 'Italy', flag: '🇮🇹', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'italy-img.png', anchorX: 0, anchorY: 0.5, anchorScale: 1.05, sortOrder: 5 },
  { id: 'egypt', nameVi: 'Ai Cập', nameEn: 'Egypt', flag: '🇪🇬', durationVi: '1 tháng', durationEn: '1 month', imageUrl: 'egypt-img.png', anchorX: 0, anchorY: -0.7, anchorScale: 1.05, sortOrder: 6 },
  { id: 'greece', nameVi: 'Hy Lạp', nameEn: 'Greece', flag: '🇬🇷', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'greece-img.png', anchorX: 0, anchorY: -0.3, anchorScale: 1.05, sortOrder: 7 },
  { id: 'korea', nameVi: 'Hàn Quốc', nameEn: 'South Korea', flag: '🇰🇷', durationVi: '2 tháng', durationEn: '2 months', imageUrl: 'korea-img.png', anchorX: 0, anchorY: 0, anchorScale: 1.05, sortOrder: 8 },
  { id: 'germany', nameVi: 'Đức', nameEn: 'Germany', flag: '🇩🇪', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'germany-img.png', anchorX: 0, anchorY: 0.25, anchorScale: 1.05, sortOrder: 9 },
  { id: 'switzerland', nameVi: 'Thụy Sỹ', nameEn: 'Switzerland', flag: '🇨🇭', durationVi: '3-4 tháng', durationEn: '3-4 months', imageUrl: 'sw-img.png', anchorX: 0, anchorY: 0, anchorScale: 1.05, sortOrder: 10 },
];

// =========================================================================
// 4. MILESTONES CỦA CÁC QUỐC GIA
// =========================================================================
const ALL_COUNTRY_MILESTONES: Record<string, MilestoneItem[]> = {
  japan: [
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
          notes: [
            'Xác nhận không có bất kỳ dấu hiệu lâm sàng nào của bệnh dại.',
            'Đối với chó, cần xác nhận thêm rằng không có bất kỳ dấu hiệu nào của bệnh leptospirosis (bệnh xoắn khuẩn).',
          ],
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
          notes: [
            'Nếu giấy chứng nhận có thiếu sót hoặc không đáp ứng yêu cầu, chó/mèo có thể phải cách ly kiểm dịch tại cơ sở lưu giữ trong thời gian tối đa 180 ngày hoặc bị đưa trở lại quốc gia xuất khẩu.',
          ],
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
  ],
  china: [
    {
      dateLabel: 'Ngày 0',
      sortOrder: 1,
      steps: [
        STEP_MICROCHIP_STANDARD,
        STEP_RABIES_1_STANDARD,
        {
          stepCode: 'cn_vaccine',
          title: 'Tiêm vaccine FVRCP/DHPPi+L',
          subtitle: 'Bệnh viện/phòng khám thú y',
          desc: 'Mèo nên được tiêm vaccine FVRCP. Chó nên được tiêm vaccine DHPPi+L để đảm bảo an toàn sức khỏe.',
          notes: ['Hiệu lực không quá 12 tháng và không ít hơn 30 ngày trước ngày nhập cảnh.'],
          hasButton: true,
        },
        STEP_FLIGHT_BOOKING,
      ],
    },
    {
      dateLabel: 'Ngày 30',
      sortOrder: 2,
      steps: [
        STEP_RABIES_2_STANDARD,
        {
          stepCode: 'cn_test',
          title: 'Xét nghiệm kháng thể dại',
          subtitle: 'Phòng xét nghiệm được chỉ định',
          desc: 'Mẫu máu để xét nghiệm nên được lấy sau lần tiêm phòng bệnh dại thứ hai.',
          notes: ['Hiệu giá kháng thể bệnh dại phải đạt từ 0,5 IU/ml trở lên.', 'Kết quả xét nghiệm có giá trị trong vòng 2 năm kể từ ngày lấy mẫu máu.'],
          hasButton: true,
        },
      ],
    },
    { dateLabel: 'Ngày 40', sortOrder: 3, steps: [STEP_HEALTH_CERT_STANDARD, STEP_FLIGHT_CONFIRM] },
    { dateLabel: 'Ngày 72 - 73', sortOrder: 4, steps: [STEP_EXPORT_REG] },
    { dateLabel: 'Ngày 75 - 76', sortOrder: 5, steps: [STEP_EXPORT_CERT_30D] },
    { dateLabel: 'Ngày 80: Nhập cảnh Trung Quốc', sortOrder: 6, steps: [createCustomsStep('Trung Quốc')] },
  ],
  vietnam: [
    {
      dateLabel: 'Ngày 0',
      sortOrder: 1,
      steps: [
        {
          stepCode: 'vn_microchip',
          title: 'Gắn microchip (số định danh)',
          subtitle: 'Bệnh viện/phòng khám thú y',
          desc: 'Gắn microchip cho chó/mèo nếu nước xuất khẩu yêu cầu.',
          notes: ['Không bắt buộc trong hồ sơ nhập khẩu Việt Nam. Tùy thuộc vào yêu cầu của nước xuất khẩu.'],
          hasButton: true,
        },
        {
          stepCode: 'vn_rabies',
          title: 'Tiêm vaccine phòng bệnh dại',
          subtitle: 'Bệnh viện/phòng khám thú y',
          desc: 'Đảm bảo chó/mèo được phòng bệnh bằng vaccine theo yêu cầu kiểm dịch.',
          notes: [
            'Chó/mèo phải đủ ít nhất 91 ngày tuổi tại thời điểm tiêm phòng (ngày sinh được tính là ngày 0).',
            'Sổ/giấy xác nhận tiêm phòng còn hiệu lực để xuất cảnh.',
          ],
          hasButton: true,
        },
        STEP_FLIGHT_BOOKING,
      ],
    },
    {
      dateLabel: 'Ngày 1 - 25',
      sortOrder: 2,
      steps: [
        STEP_HEALTH_CERT_STANDARD,
        {
          stepCode: 'vn_export_cert',
          title: 'Giấy chứng nhận kiểm dịch của nước xuất khẩu',
          subtitle: 'Kiểm dịch động vật (Animal Quarantine Service)',
          desc: 'Được cấp sau khi chó/mèo đạt yêu cầu về sức khỏe và kiểm dịch.',
          notes: ['Kiểm tra thời hạn hiệu lực trước ngày bay.'],
          hasButton: true,
        },
        STEP_FLIGHT_CONFIRM,
      ],
    },
    {
      dateLabel: 'Ngày 30: Nhập cảnh Việt Nam',
      sortOrder: 3,
      steps: [
        {
          stepCode: 'vn_entry',
          title: 'Nhập cảnh và kiểm dịch động vật',
          subtitle: 'Kiểm dịch động vật (Animal Quarantine Service)',
          desc: 'Người nhập khẩu phải đăng ký yêu cầu kiểm tra nhập khẩu với Cơ quan Kiểm dịch Động vật ngay khi đến Việt Nam.',
          notes: ['Cơ quan Kiểm dịch Động vật sẽ cấp Giấy chứng nhận kiểm dịch nhập khẩu (Vietnam Quarantine Certificate) cho chó/mèo đủ điều kiện.'],
          hasButton: true,
        },
      ],
    },
  ],
  france: [
    { dateLabel: 'Ngày 0', sortOrder: 1, steps: [STEP_MICROCHIP_STANDARD, STEP_RABIES_1_STANDARD, STEP_FLIGHT_BOOKING] },
    { dateLabel: 'Ngày 30', sortOrder: 2, steps: [STEP_RABIES_2_STANDARD, STEP_RABIES_TEST_EU] },
    { dateLabel: 'Ngày 31 - 121', sortOrder: 3, steps: [STEP_EU_LOCK] },
    { dateLabel: 'Ngày 122 - 125', sortOrder: 4, steps: [STEP_HEALTH_CERT_STANDARD, STEP_EXPORT_REG, STEP_FLIGHT_CONFIRM] },
    { dateLabel: 'Ngày 125 - 129', sortOrder: 5, steps: [STEP_EXPORT_CERT_30D] },
    { dateLabel: 'Ngày 130: Nhập cảnh Pháp', sortOrder: 6, steps: [createCustomsStep('Pháp')] },
  ],
  italy: [
    { dateLabel: 'Ngày 0', sortOrder: 1, steps: [STEP_MICROCHIP_STANDARD, STEP_RABIES_1_STANDARD, STEP_FLIGHT_BOOKING] },
    { dateLabel: 'Ngày 30', sortOrder: 2, steps: [STEP_RABIES_2_STANDARD, STEP_RABIES_TEST_EU] },
    { dateLabel: 'Ngày 31 - 121', sortOrder: 3, steps: [STEP_EU_LOCK] },
    { dateLabel: 'Ngày 122 - 125', sortOrder: 4, steps: [STEP_HEALTH_CERT_STANDARD, STEP_EXPORT_REG, STEP_FLIGHT_CONFIRM] },
    { dateLabel: 'Ngày 125 - 129', sortOrder: 5, steps: [STEP_EXPORT_CERT_30D] },
    { dateLabel: 'Ngày 130: Nhập cảnh Ý', sortOrder: 6, steps: [createCustomsStep('Ý')] },
  ],
  egypt: [
    {
      dateLabel: 'Ngày 0',
      sortOrder: 1,
      steps: [
        {
          stepCode: 'eg_microchip',
          title: 'Gắn microchip (số định danh)',
          subtitle: 'Bệnh viện/phòng khám thú y',
          desc: 'Gắn microchip cho chó/mèo nếu nước xuất khẩu yêu cầu.',
          notes: ['Không bắt buộc trong hồ sơ nhập khẩu Việt Nam. Tùy thuộc vào yêu cầu của nước xuất khẩu.'],
          hasButton: true,
        },
        {
          stepCode: 'eg_rabies',
          title: 'Tiêm vaccine phòng bệnh dại',
          subtitle: 'Bệnh viện/phòng khám thú y',
          desc: 'Đảm bảo chó/mèo được phòng bệnh bằng vaccine theo yêu cầu kiểm dịch.',
          notes: [
            'Chó/mèo phải đủ ít nhất 91 ngày tuổi tại thời điểm tiêm phòng (ngày sinh được tính là ngày 0).',
            'Mũi tiêm dại được tiêm ít nhất 30 ngày trước khi nhập cảnh.',
          ],
          hasButton: true,
        },
        STEP_FLIGHT_BOOKING,
      ],
    },
    { dateLabel: 'Ngày 1 - 25', sortOrder: 2, steps: [STEP_HEALTH_CERT_STANDARD, STEP_EXPORT_REG] },
    { dateLabel: 'Ngày 25 - 29', sortOrder: 3, steps: [STEP_EXPORT_CERT_30D] },
    { dateLabel: 'Ngày 30: Nhập cảnh Ai Cập', sortOrder: 4, steps: [createCustomsStep('Ai Cập')] },
  ],
  greece: [
    { dateLabel: 'Ngày 0', sortOrder: 1, steps: [STEP_MICROCHIP_STANDARD, STEP_RABIES_1_STANDARD, STEP_FLIGHT_BOOKING] },
    { dateLabel: 'Ngày 30', sortOrder: 2, steps: [STEP_RABIES_2_STANDARD, STEP_RABIES_TEST_EU] },
    { dateLabel: 'Ngày 31 - 121', sortOrder: 3, steps: [STEP_EU_LOCK] },
    { dateLabel: 'Ngày 122 - 125', sortOrder: 4, steps: [STEP_HEALTH_CERT_STANDARD, STEP_EXPORT_REG, STEP_FLIGHT_CONFIRM] },
    { dateLabel: 'Ngày 125 - 129', sortOrder: 5, steps: [STEP_EXPORT_CERT_30D] },
    { dateLabel: 'Ngày 130: Nhập cảnh Hy Lạp', sortOrder: 6, steps: [createCustomsStep('Hy Lạp')] },
  ],
  korea: [
    { dateLabel: 'Ngày 0', sortOrder: 1, steps: [STEP_MICROCHIP_STANDARD, STEP_RABIES_1_STANDARD, STEP_FLIGHT_BOOKING] },
    {
      dateLabel: 'Ngày 30',
      sortOrder: 2,
      steps: [
        STEP_RABIES_2_STANDARD,
        {
          stepCode: 'kr_test',
          title: 'Xét nghiệm kháng thể dại',
          subtitle: 'Phòng xét nghiệm được chỉ định',
          desc: 'Mẫu máu để xét nghiệm nên được lấy sau lần tiêm phòng bệnh dại thứ hai.',
          notes: ['Hiệu giá kháng thể bệnh dại phải đạt từ 0,5 IU/ml trở lên.', 'Thời gian đợi kết quả giấy tờ gửi về thường mất từ 2 - 4 tuần.'],
          hasButton: true,
        },
      ],
    },
    { dateLabel: 'Ngày 50 - 55', sortOrder: 3, steps: [STEP_HEALTH_CERT_STANDARD, STEP_EXPORT_REG, STEP_FLIGHT_CONFIRM] },
    { dateLabel: 'Ngày 56 - 58', sortOrder: 4, steps: [STEP_EXPORT_CERT_30D] },
    { dateLabel: 'Ngày 60: Nhập cảnh Hàn Quốc', sortOrder: 5, steps: [createCustomsStep('Hàn Quốc')] },
  ],
  germany: [
    {
      dateLabel: 'Ngày 0',
      sortOrder: 1,
      steps: [
        STEP_MICROCHIP_STANDARD,
        STEP_RABIES_1_STANDARD,
        {
          ...STEP_FLIGHT_BOOKING,
          desc: 'Liên hệ hotline hoặc phòng vé của hãng hàng không ngay sau khi mua vé máy bay (ít nhất trước 3 - 5 ngày bay).',
        },
      ],
    },
    { dateLabel: 'Ngày 30', sortOrder: 2, steps: [STEP_RABIES_2_STANDARD, STEP_RABIES_TEST_EU] },
    { dateLabel: 'Ngày 31 - 121', sortOrder: 3, steps: [STEP_EU_LOCK] },
    {
      dateLabel: 'Ngày 122 - 125',
      sortOrder: 4,
      steps: [
        {
          ...STEP_HEALTH_CERT_STANDARD,
          desc: 'Chó/mèo phải được bác sĩ thú y thực hiện kiểm tra sức khỏe lâm sàng trong vòng 10 ngày trước khi lên máy bay/tàu.',
        },
        {
          stepCode: 'de_eu_declaration',
          title: 'Tờ khai di chuyển động vật không vì mục đích thương mại',
          subtitle: 'Chủ nuôi thú cưng',
          desc: 'Hoàn thiện tờ khai di chuyển động vật không vì mục đích thương mại theo mẫu quy định của EU trước khi xuất cảnh.',
          notes: [
            'Điền và ký tờ khai di chuyển động vật không vì mục đích thương mại',
            'Đính kèm giấy chứng nhận sức khỏe',
            'Xác nhận thú cưng được đưa sang EU cho mục đích cá nhân, không nhằm bán hoặc chuyển giao quyền sở hữu.',
          ],
          hasButton: true,
          borderColor: '#FF0000',
        },
        STEP_EXPORT_REG,
        STEP_FLIGHT_CONFIRM,
      ],
    },
    { dateLabel: 'Ngày 125 - 129', sortOrder: 5, steps: [STEP_EXPORT_CERT_30D] },
    { dateLabel: 'Ngày 130: Nhập cảnh Đức', sortOrder: 6, steps: [createCustomsStep('Đức')] },
  ],
  switzerland: [
    {
      dateLabel: 'Ngày 0',
      sortOrder: 1,
      steps: [
        STEP_MICROCHIP_STANDARD,
        STEP_RABIES_1_STANDARD,
        {
          ...STEP_FLIGHT_BOOKING,
          desc: 'Liên hệ hotline hoặc phòng vé của hãng hàng không ngay sau khi mua vé máy bay (ít nhất trước 3 - 5 ngày bay).',
        },
      ],
    },
    { dateLabel: 'Ngày 30', sortOrder: 2, steps: [STEP_RABIES_2_STANDARD, STEP_RABIES_TEST_EU] },
    {
      dateLabel: 'Ngày 31 - 121',
      sortOrder: 3,
      steps: [
        STEP_EU_LOCK,
        {
          stepCode: 'ch_import_permit',
          title: 'Xin giấy phép nhập khẩu thú cưng',
          subtitle: 'Federal Food Safety and Veterinary Office',
          desc: 'Nộp đơn cho FSVO để xin Swiss Import Licence khi thú cưng nhập cảnh trực tiếp bằng đường hàng không từ quốc gia có nguy cơ bệnh dại.',
          notes: ['Chỉ áp dụng cho trường hợp nhập cảnh trực tiếp bằng máy bay từ quốc gia thuộc diện nguy cơ bệnh dại (có Việt Nam).'],
          hasButton: true,
          borderColor: '#FF0000',
        },
      ],
    },
    {
      dateLabel: 'Ngày 122 - 125',
      sortOrder: 4,
      steps: [
        {
          ...STEP_HEALTH_CERT_STANDARD,
          desc: 'Chó/mèo phải được bác sĩ thú y thực hiện kiểm tra sức khỏe lâm sàng trong vòng 10 ngày trước khi lên máy bay/tàu.',
        },
        STEP_EXPORT_REG,
        STEP_FLIGHT_CONFIRM,
      ],
    },
    { dateLabel: 'Ngày 125 - 129', sortOrder: 5, steps: [STEP_EXPORT_CERT_30D] },
    { dateLabel: 'Ngày 130: Nhập cảnh Thụy Sỹ', sortOrder: 6, steps: [createCustomsStep('Thụy Sỹ')] },
  ],
};

// =========================================================================
// 5. PROCEDURE DOCUMENTS
// =========================================================================
const ALL_PROCEDURE_DOCUMENTS: DocumentSeedItem[] = [
  {
    countryId: 'vietnam',
    titleVi: 'Đơn đăng ký kiểm dịch xuất khẩu',
    titleEn: 'Export animal quarantine application',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.PDF,
    fileUrl: 'don-dang-ky-kiem-dich-dong-vat-xuat-khau.pdf',
    category: 'VIETNAM',
    sortOrder: 1,
  },
  {
    countryId: 'vietnam',
    titleVi: 'Thủ tục hành chính lĩnh vực thú y',
    titleEn: 'Veterinary administrative procedures',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.PDF,
    fileUrl: 'thu-tuc-hanh-chinh-linh-vuc-thu-y.pdf',
    category: 'VIETNAM',
    sortOrder: 2,
  },
  {
    countryId: 'japan',
    titleVi: 'Thông báo nhập khẩu CHÓ',
    titleEn: 'Dog import notification',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.PDF,
    fileUrl: 'thong-bao-nhap-khau-cho.pdf',
    category: 'DOG',
    sortOrder: 1,
  },
  {
    countryId: 'japan',
    titleVi: 'Đăng ký kiểm dịch nhập khẩu CHÓ',
    titleEn: 'Dog import quarantine registration',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.PDF,
    fileUrl: 'dang-ky-kiem-dich-nhap-khau-cho-cho.pdf',
    category: 'DOG',
    sortOrder: 2,
  },
  {
    countryId: 'japan',
    titleVi: 'Giấy chứng nhận sức khỏe (Form AC)',
    titleEn: 'Health certificate (Form AC)',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.DOCX,
    fileUrl: 'giay-chung-nhan-suc-khoe.docx',
    category: 'DOG',
    sortOrder: 3,
  },
  {
    countryId: 'japan',
    titleVi: 'Giấy chứng nhận đính kèm (nếu cần)',
    titleEn: 'Attached certificate (if needed)',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.DOCX,
    fileUrl: 'giay-chung-nhan-dinh-kem.docx',
    category: 'DOG',
    sortOrder: 4,
  },
  {
    countryId: 'japan',
    titleVi: 'Thông báo nhập khẩu MÈO',
    titleEn: 'Cat import notification',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.PDF,
    fileUrl: 'thong-bao-nhap-khau-meo.pdf',
    category: 'CAT',
    sortOrder: 5,
  },
  {
    countryId: 'japan',
    titleVi: 'Đăng ký kiểm dịch nhập khẩu MÈO',
    titleEn: 'Cat import quarantine registration',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.PDF,
    fileUrl: 'dang-ky-kiem-dich-nhap-khau-cho-meo.pdf',
    category: 'CAT',
    sortOrder: 6,
  },
  {
    countryId: 'japan',
    titleVi: 'Giấy chứng nhận sức khỏe (Form AC)',
    titleEn: 'Health certificate (Form AC)',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.DOCX,
    fileUrl: 'giay-chung-nhan-suc-khoe.docx',
    category: 'CAT',
    sortOrder: 7,
  },
  {
    countryId: 'japan',
    titleVi: 'Giấy chứng nhận đính kèm (nếu cần)',
    titleEn: 'Attached certificate (if needed)',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.DOCX,
    fileUrl: 'giay-chung-nhan-dinh-kem.docx',
    category: 'CAT',
    sortOrder: 8,
  },
  {
    countryId: 'switzerland',
    titleVi: 'Đơn xin giấy phép nhập khẩu thú cưng từ quốc gia có nguy cơ bệnh dại',
    titleEn: 'Pet import permit application from rabies-risk country',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.DOCX,
    fileUrl: 'don-xin-giay-phep-nhap-khau-thu-cung-tu-quoc-gia-co-nguy-co-benh-dai.docx',
    category: 'GENERAL',
    sortOrder: 1,
  },
  {
    countryId: 'switzerland',
    titleVi: 'Quy định EU 2026/705',
    titleEn: 'EU Regulation 2026/705',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.PDF,
    fileUrl: 'quy-dinh-eu-2026-705.pdf',
    category: 'GENERAL',
    sortOrder: 2,
  },
  ...['france', 'italy', 'germany', 'greece'].flatMap((countryId) => [
    {
      countryId,
      titleVi: 'Tờ khai di chuyển động vật không vì mục đích thương mại',
      titleEn: 'Non-commercial pet movement declaration',
      meta: '3 trang • 2.5MB',
      type: ProcedureDocType.PDF,
      fileUrl: 'to-khai-di-chuyen-dong-vat-khong-vi-muc-dich-thuong-mai.pdf',
      category: 'EU',
      sortOrder: 1,
    },
    {
      countryId,
      titleVi: 'Quy định EU 2026/705',
      titleEn: 'EU Regulation 2026/705',
      meta: '3 trang • 2.5MB',
      type: ProcedureDocType.PDF,
      fileUrl: 'quy-dinh-eu-2026-705.pdf',
      category: 'EU',
      sortOrder: 2,
    },
  ]),
  {
    countryId: 'korea',
    titleVi: 'Đơn đăng ký kiểm dịch động vật',
    titleEn: 'Animal quarantine registration application',
    meta: '3 trang • 2.5MB',
    type: ProcedureDocType.PDF,
    fileUrl: 'don-dang-ky-kiem-dich-dong-vat.pdf',
    category: 'GENERAL',
    sortOrder: 1,
  },
];

// =========================================================================
// 6. DANH SÁCH ĐỊA ĐIỂM PET PARADISE THEO ĐẤT NƯỚC (PET PARADISES)
// =========================================================================
const ALL_PET_PARADISES: PetParadiseSeedItem[] = [
  // --- NHẬT BẢN ---
  {
    id: 'jp_tashirojima',
    countryId: 'japan',
    name: 'Đảo Tashirojima (Đảo Mèo)',
    categoryVi: 'Đảo nhỏ ngoài khơi',
    categoryEn: 'Small offshore island',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Opening',
    introText: 'Hòn đảo nhỏ hòa mình với biển xanh, làng chài yên bình và cả một "vương quốc mèo" thân thiện.',
    areaVi: 'Hòn đảo có chu vi khoảng 11 km',
    areaEn: 'The island has a circumference of about 11 km',
    howToGetVi: 'Di chuyển bằng tàu hoặc phà ra đảo từ cảng tại thành phố Ishinomaki mất khoảng 40 phút.',
    howToGetEn: 'Travel time by boat or ferry from Ishinomaki city takes about 40 minutes.',
    addressVi: 'Thành phố Ishinomaki, Tỉnh Miyagi, Nhật Bản',
    addressEn: 'Ishinomaki City, Miyagi Prefecture, Japan',
    latitude: 38.2974,
    longitude: 141.4172,
    googlePlaceKeyword: 'Tashirojima Island Ishinomaki Miyagi Japan',
    googlePlaceId: 'ChIJVXk4F3bZgzURaU1x9Xw5o-g',
    rating: 4.8,
    reviewsCount: 145,
    heroImage: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Vương quốc của loài mèo',
        titleEn: 'Cat Kingdom',
        descVi: 'Số lượng mèo ở đây lớn hơn rất nhiều so với người dân, được xem là biểu tượng may mắn.',
        descEn: 'The cat population far outnumbers local residents and is regarded as a symbol of good luck.',
      },
    ],
  },

  // --- TRUNG QUỐC ---
  {
    id: 'cn_moon_cat_city',
    countryId: 'china',
    name: 'Moon Cat City',
    categoryVi: 'Tổ hợp công viên mèo & cà phê thú cưng',
    categoryEn: 'Cat Theme Park & Pet Cafe Complex',
    statusTextVi: 'Đang mở đến 10:00 PM',
    statusTextEn: 'Open until 10:00 PM',
    introText: 'Khu tổ hợp giải trí và cà phê mèo nổi tiếng tại Quảng Châu với hàng trăm bé mèo được chăm sóc chu đáo.',
    areaVi: 'Diện tích trong nhà hơn 1.200 m²',
    areaEn: 'Indoor area over 1,200 m²',
    howToGetVi: 'Đi tàu điện ngầm Quảng Châu Line 1 hoặc Line 3, đi bộ 5 phút từ nhà ga.',
    howToGetEn: 'Take Guangzhou Metro Line 1 or Line 3, walk 5 minutes from the station.',
    addressVi: 'Quận Thiên Hà, Thành phố Quảng Châu, Tỉnh Quảng Đông, Trung Quốc',
    addressEn: 'Tianhe District, Guangzhou, Guangdong, China',
    latitude: 23.1291,
    longitude: 113.2644,
    googlePlaceKeyword: 'Moon Cat City Guangzhou China',
    rating: 4.7,
    reviewsCount: 89,
    heroImage: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1574158622682-e40e69881006?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Tương tác cùng đàn mèo quý',
        titleEn: 'Play with friendly pedigreed cats',
        descVi: 'Không gian ấm cúng, trang bị đầy đủ dụng cụ vệ sinh và đồ chơi tương tác cao cấp.',
        descEn: 'Cozy environment equipped with hygiene amenities and high-end interactive cat toys.',
      },
    ],
  },
  {
    id: 'cn_bailian_xijiao',
    countryId: 'china',
    name: 'Trung tâm thương mại Bailian Xijiao',
    categoryVi: 'Trung tâm mua sắm thân thiện thú cưng',
    categoryEn: 'Pet-friendly Shopping Mall',
    statusTextVi: 'Đang mở đến 10:00 PM',
    statusTextEn: 'Open until 10:00 PM',
    introText: 'Một trong những TTTM tiên phong tại Thượng Hải chào đón thú cưng với làn đường đi dạo và xe đẩy riêng cho chó mèo.',
    areaVi: 'Khu mua sắm phức hợp ngoài trời & trong nhà',
    areaEn: 'Indoor & outdoor open-air commercial complex',
    howToGetVi: 'Gần ga tàu điện ngầm Beixinjing (Metro Line 2), thuận tiện đỗ xe ô tô.',
    howToGetEn: 'Near Beixinjing Station (Metro Line 2) with ample pet-accessible parking.',
    addressVi: 'Quận Trường Ninh, Thành phố Thượng Hải, Trung Quốc',
    addressEn: 'Changning District, Shanghai, China',
    latitude: 31.2186,
    longitude: 121.3664,
    googlePlaceKeyword: 'Bailian Xijiao Shopping Mall Changning Shanghai',
    rating: 4.6,
    reviewsCount: 112,
    heroImage: 'https://images.unsplash.com/photo-1567449303078-57ad995bd301?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1567449303078-57ad995bd301?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Mua sắm cùng thú cưng',
        titleEn: 'Shop with your pets',
        descVi: 'Cho phép thú cưng vào sảnh, cung cấp trạm nước uống và túi dọn vệ sinh miễn phí.',
        descEn: 'Allows pets inside concourses with water stations and complimentary waste bags.',
      },
    ],
  },
  {
    id: 'cn_shiquan_street',
    countryId: 'china',
    name: 'Phố cổ Shiquan',
    categoryVi: 'Phố đi bộ văn hóa thân thiện thú cưng',
    categoryEn: 'Historic Pet-friendly Walking Street',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Con phố cổ duyên dáng bên dòng kênh Tô Châu với hàng chục quán cà phê thú cưng và không gian dạo mát thoáng đãng.',
    areaVi: 'Chiều dài tuyến phố khoảng 2 km',
    areaEn: 'Street promenade length approx 2 km',
    howToGetVi: 'Đi tuyến tàu điện ngầm Metro Line 4 hoặc 5 tới ga Sanyuanfang.',
    howToGetEn: 'Take Suzhou Metro Line 4 or 5 to Sanyuanfang Station.',
    addressVi: 'Thành phố Tô Châu, Tỉnh Giang Tô, Trung Quốc',
    addressEn: 'Suzhou, Jiangsu Province, China',
    latitude: 31.2989,
    longitude: 120.6277,
    googlePlaceKeyword: 'Shiquan Street Suzhou Jiangsu China',
    rating: 4.8,
    reviewsCount: 198,
    heroImage: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Dạo bộ bên bờ kênh thơ mộng',
        titleEn: 'Stroll along scenic canals',
        descVi: 'Trải nghiệm không gian giao thoa giữa truyền thống và phong cách sống hiện đại cùng thú cưng.',
        descEn: 'Experience the harmonious blend of historic charm and modern pet-friendly outdoor cafes.',
      },
    ],
  },

  // --- PHÁP ---
  {
    id: 'fr_aquarium_amneville',
    countryId: 'france',
    name: 'Thủy cung Amnéville',
    categoryVi: 'Khu bảo tồn sinh vật biển & công viên',
    categoryEn: 'Marine Aquarium & Animal Park',
    statusTextVi: 'Đang mở đến 06:00 PM',
    statusTextEn: 'Open until 06:00 PM',
    introText: 'Điểm đến độc đáo ở Đông Bắc nước Pháp với không gian xanh và quy định tiếp đón chó dẫn đường thân thiện.',
    areaVi: 'Khuôn viên sinh thái rộng lớn',
    areaEn: 'Large nature park setting',
    howToGetVi: 'Di chuyển bằng xe hơi từ Metz hoặc xe bus trung chuyển Amnéville.',
    howToGetEn: 'Easily accessible by car from Metz or Amnéville regional shuttle.',
    addressVi: 'Trung tâm giải trí Thermapolis, Amnéville, Moselle, Pháp',
    addressEn: 'Centre de Loisirs, Amnéville, Moselle, France',
    latitude: 49.2612,
    longitude: 6.1384,
    googlePlaceKeyword: 'Aquarium Amneville Moselle France',
    rating: 4.5,
    reviewsCount: 76,
    heroImage: 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544568100-847a948585b9?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Khám phá thế giới đại dương',
        titleEn: 'Ocean Discovery',
        descVi: 'Hệ thống bể kính sinh thái sống động cùng lối đi rộng rãi dễ chịu.',
        descEn: 'Vibrant ecological exhibits and spacious outdoor walkways.',
      },
    ],
  },
  {
    id: 'fr_nice_beach',
    countryId: 'france',
    name: 'Thành phố biển Nice',
    categoryVi: 'Thành phố biển & bãi biển cho thú cưng',
    categoryEn: 'Coastal City & Dog Beaches',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Thành phố biển Địa Trung Hải với các bãi biển riêng biệt cho phép chó thỏa thích tắm biển cùng chủ nhân.',
    areaVi: 'Trải dài dọc theo đại lộ Promenade des Anglais',
    areaEn: 'Extends along the famous Promenade des Anglais',
    howToGetVi: 'Thuận tiện di chuyển bằng tàu cao tốc TGV hoặc sân bay quốc tế Nice Côte d\'Azur.',
    howToGetEn: 'Accessible via Nice Ville TGV station or Nice Côte d\'Azur Airport.',
    addressVi: 'Thành phố Nice, Vùng Provence-Alpes-Côte d\'Azur, Pháp',
    addressEn: 'Nice, Provence-Alpes-Côte d\'Azur, France',
    latitude: 43.6960,
    longitude: 7.2656,
    googlePlaceKeyword: 'Promenade des Anglais Nice France',
    rating: 4.9,
    reviewsCount: 312,
    heroImage: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Tắm biển tại bãi biển thú cưng',
        titleEn: 'Swim at designated dog beaches',
        descVi: 'Nice có các bãi biển chỉ định (như Bãi biển La Lanterne) nơi chó cưng được bơi tự do.',
        descEn: 'Designated beaches like Site de la Lanterne where dogs are free to splash in clear waters.',
      },
    ],
  },
  {
    id: 'fr_jardin_palais_royal',
    countryId: 'france',
    name: 'Khu vườn hoàng gia Paris',
    categoryVi: 'Vườn hoa di sản & công viên đi dạo',
    categoryEn: 'Royal Gardens & Heritage Park',
    statusTextVi: 'Đang mở đến 08:30 PM',
    statusTextEn: 'Open until 08:30 PM',
    introText: 'Khu vườn tuyệt đẹp tĩnh lặng ngay trung tâm Paris, nơi bạn có thể dắt thú cưng đi dạo dưới bóng râm hàng cây cổ thụ.',
    areaVi: 'Khuôn viên di sản rộng hơn 20.000 m²',
    areaEn: 'Historic royal enclave exceeding 20,000 m²',
    howToGetVi: 'Ga tàu điện ngầm Palais Royal - Musée du Louvre (Metro Line 1, 7).',
    howToGetEn: 'Metro Palais Royal - Musée du Louvre (Lines 1 & 7).',
    addressVi: 'Quận 1, Paris, Île-de-France, Pháp',
    addressEn: '1st Arrondissement, Paris, Île-de-France, France',
    latitude: 48.8648,
    longitude: 2.3376,
    googlePlaceKeyword: 'Jardin du Palais Royal Paris France',
    rating: 4.7,
    reviewsCount: 164,
    heroImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1520939817895-060bdef4df1a?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Dạo mát giữa kiến trúc cổ kính',
        titleEn: 'Walk amidst royal architecture',
        descVi: 'Không gian yên bình tách biệt khỏi phố thị ồn ào với đài phun nước thanh lịch.',
        descEn: 'A tranquil oasis secluded from city noise with classic fountains and tree-lined allées.',
      },
    ],
  },

  // --- HY LẠP ---
  {
    id: 'gr_mykonos_cats',
    countryId: 'greece',
    name: 'Đảo mèo Mykonos',
    categoryVi: 'Đảo du lịch & thiên đường mèo',
    categoryEn: 'Island Sanctuary & Cat Haven',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Hòn đảo màu trắng biểu tượng với hàng ngàn chú mèo thân thiện sưởi nắng trên các bậc thang rực rỡ sắc hoa giấy.',
    areaVi: 'Đảo Mykonos thuộc quần đảo Cyclades',
    areaEn: 'Mykonos Island, Cyclades archipelago',
    howToGetVi: 'Đi phà biển từ cảng Piraeus (Athens) hoặc bay thẳng đến sân bay Mykonos (JMK).',
    howToGetEn: 'Ferry from Piraeus (Athens) or direct flight to Mykonos Airport (JMK).',
    addressVi: 'Quần đảo Cyclades, Biển Aegean, Hy Lạp',
    addressEn: 'Cyclades, Aegean Sea, Greece',
    latitude: 37.4467,
    longitude: 25.3289,
    googlePlaceKeyword: 'Mykonos Town Cyclades Greece cats',
    rating: 4.8,
    reviewsCount: 220,
    heroImage: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Gặp gỡ những bé mèo Mykonos',
        titleEn: 'Encounter the cats of Mykonos',
        descVi: 'Người dân đảo rất yêu quý và chung tay cùng các trạm thú y chăm sóc đàn mèo trên đảo.',
        descEn: 'Islanders and local charity groups take pride in nurturing the healthy island cat population.',
      },
    ],
  },
  {
    id: 'gr_santorini_cats',
    countryId: 'greece',
    name: 'Đảo mèo Santorini',
    categoryVi: 'Đảo núi lửa & bảo tồn thú cưng',
    categoryEn: 'Volcanic Island & Pet Welfare Sanctuary',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Những ngôi nhà mái vòm xanh cùng các chú mèo Santorini xinh đẹp tạo nên khung cảnh hoàng hôn đẹp nhất thế giới.',
    areaVi: 'Làng Oia và Fira trên vách đá Caldera',
    areaEn: 'Oia and Fira villages along Caldera cliffside',
    howToGetVi: 'Phà cao tốc hoặc chuyến bay nội địa từ Athens đến sân bay Thira (JTR).',
    howToGetEn: 'Speed ferry or domestic flight from Athens to Thira Airport (JTR).',
    addressVi: 'Thira, Quần đảo Cyclades, Hy Lạp',
    addressEn: 'Thira, Cyclades Islands, Greece',
    latitude: 36.3932,
    longitude: 25.4615,
    googlePlaceKeyword: 'Santorini Animal Welfare Association Cyclades Greece',
    rating: 4.9,
    reviewsCount: 340,
    heroImage: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Ngắm hoàng hôn cùng mèo đảo',
        titleEn: 'Sunset with island cats',
        descVi: 'Ngắm nhìn cảnh mặt trời lặn trên biển Aegean bên cạnh các chú mèo quấn quýt thân thiện.',
        descEn: 'Watch legendary Aegean sunsets while friendly local cats keep you company.',
      },
    ],
  },
  {
    id: 'gr_chania_beach',
    countryId: 'greece',
    name: 'Bãi biển ven Chania',
    categoryVi: 'Bãi biển vịnh cát & nghỉ dưỡng',
    categoryEn: 'Seaside Promenade & Sandy Pet Beach',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Vùng vịnh cát vàng nguyên sơ tại đảo Crete với bờ biển thoai thoải, rất an toàn và lý tưởng cho cún cưng chạy nhảy.',
    areaVi: 'Đường bờ biển trải dài tại vịnh Chania',
    areaEn: 'Extensive coastline along Chania bay',
    howToGetVi: 'Bay đến sân bay quốc tế Chania (CHQ) hoặc đi phà từ cảng Souda.',
    howToGetEn: 'Fly to Chania Airport (CHQ) or ferry into Souda Bay Port.',
    addressVi: 'Thành phố Chania, Đảo Crete, Hy Lạp',
    addressEn: 'Chania, Crete Island, Greece',
    latitude: 35.5138,
    longitude: 24.0180,
    googlePlaceKeyword: 'Chania Old Venetian Port Beach Crete Greece',
    rating: 4.7,
    reviewsCount: 156,
    heroImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1534361960057-19889db98a1e?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Vui chơi trên làn nước ngọc bích',
        titleEn: 'Play in turquoise waters',
        descVi: 'Bãi biển cạn trong vắt, nước ấm phù hợp cho thú cưng tập bơi và vui đùa.',
        descEn: 'Shallow crystal waters perfect for dogs learning to paddle and enjoy the surf.',
      },
    ],
  },

  // --- HÀN QUỐC ---
  {
    id: 'kr_jeju_pet_resort',
    countryId: 'korea',
    name: 'Khu nghỉ dưỡng cùng thú cưng Jeju',
    categoryVi: 'Khu nghỉ dưỡng & khách sạn thú cưng',
    categoryEn: 'Pet Resort & Glamping',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Resort chuyên biệt tại đảo ngọc Jeju với bãi cỏ xanh bao la, hồ bơi thú cưng và phòng ngủ trang bị riêng nệm cho cún.',
    areaVi: 'Khuôn viên bãi cỏ hơn 5.000 m²',
    areaEn: 'Over 5,000 m² open lawn grounds',
    howToGetVi: 'Chuyến bay nội địa đến sân bay quốc tế Jeju (CJU), di chuyển bằng taxi 20 phút.',
    howToGetEn: 'Domestic flight to Jeju Airport (CJU), followed by a 20-minute drive.',
    addressVi: 'Thành phố Jeju, Tỉnh Tự trị Đặc biệt Jeju, Hàn Quốc',
    addressEn: 'Jeju City, Jeju Special Self-Governing Province, South Korea',
    latitude: 33.4996,
    longitude: 126.5312,
    googlePlaceKeyword: 'Jeju Pet Friendly Resort South Korea',
    rating: 4.8,
    reviewsCount: 187,
    heroImage: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Hồ bơi chuyên dụng cho thú cưng',
        titleEn: 'Dedicated Pet Swimming Pool',
        descVi: 'Trang bị áo phao, máy sấy lông tốc độ cao và phòng xông hơi thảo mộc cho cún cưng.',
        descEn: 'Equipped with life jackets, high-velocity pet dryers, and herbal pet spa amenities.',
      },
    ],
  },
  {
    id: 'kr_meerkat_friends',
    countryId: 'korea',
    name: 'Meerkat Friends',
    categoryVi: 'Quán cà phê tương tác động vật',
    categoryEn: 'Exotic Pet & Animal Interaction Cafe',
    statusTextVi: 'Đang mở đến 09:30 PM',
    statusTextEn: 'Open until 09:30 PM',
    introText: 'Quán cà phê nổi tiếng tại khu phố Hongdae sầm uất ở Seoul, nơi giao lưu cùng meerkat, cầy hương và thú cưng đáng yêu.',
    areaVi: 'Không gian trong nhà hiện đại tại Hongdae',
    areaEn: 'Cozy indoor venue in bustling Hongdae',
    howToGetVi: 'Ga đại học Hongik (Subway Line 2, AREX), Lối ra số 9.',
    howToGetEn: 'Hongik University Station (Subway Line 2, AREX), Exit 9.',
    addressVi: 'Quận Mapo, Seoul, Hàn Quốc',
    addressEn: 'Mapo-gu, Seoul, South Korea',
    latitude: 37.5532,
    longitude: 126.9221,
    googlePlaceKeyword: 'Meerkat Friends Hongdae Seoul South Korea',
    rating: 4.6,
    reviewsCount: 245,
    heroImage: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Tương tác gần gũi với chồn Meerkat',
        titleEn: 'Close interaction with Meerkats',
        descVi: 'Có khu vực ôm ấp và cho thú cưng ăn dưới sự hướng dẫn an toàn của nhân viên chuyên nghiệp.',
        descEn: 'Guided cuddle and treat sessions supervised by dedicated animal caretakers.',
      },
    ],
  },
  {
    id: 'kr_baengnyeon_park',
    countryId: 'korea',
    name: 'Công viên Baengnyeon',
    categoryVi: 'Công viên sinh thái dạo bộ',
    categoryEn: 'Nature Eco-Park & Walking Trails',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Công viên trên núi Baengnyeonsan trong lành với các cung đường mòn phủ gỗ êm ái, rất an toàn để dắt cún cưng leo núi dạo mát.',
    areaVi: 'Khu công viên đồi sinh thái tự nhiên',
    areaEn: 'Mountain parkland and pine forest trails',
    howToGetVi: 'Đi tàu điện ngầm Seoul Line 3 tới ga Hongje hoặc Nokbeon.',
    howToGetEn: 'Seoul Subway Line 3 to Hongje or Nokbeon Station.',
    addressVi: 'Quận Seodaemun, Seoul, Hàn Quốc',
    addressEn: 'Seodaemun-gu, Seoul, South Korea',
    latitude: 37.5855,
    longitude: 126.9360,
    googlePlaceKeyword: 'Baengnyeonsan Mountain Park Seoul South Korea',
    rating: 4.7,
    reviewsCount: 92,
    heroImage: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Hít thở không khí rừng thông',
        titleEn: 'Pine forest trail walking',
        descVi: 'Đường đi dạo rợp bóng cây với các điểm nghỉ chân trang bị bát nước cho thú cưng.',
        descEn: 'Well-shaded wooden decks with rest stops providing clean water bowls for pets.',
      },
    ],
  },

  // --- ĐỨC ---
  {
    id: 'de_tierheim_berlin',
    countryId: 'germany',
    name: 'Trạm cứu hộ Tierheim',
    categoryVi: 'Trạm cứu hộ động vật kiểu mẫu',
    categoryEn: 'Animal Shelter & Welfare Center',
    statusTextVi: 'Đang mở đến 04:00 PM',
    statusTextEn: 'Open until 04:00 PM',
    introText: 'Trung tâm cứu hộ và chăm sóc động vật lớn bậc nhất châu Âu với kiến trúc không gian mở ấn tượng và nhân đạo.',
    areaVi: 'Khuôn viên 16 hecta',
    areaEn: '16 hectares facility',
    howToGetVi: 'Đi xe buýt tuyến 054 hoặc xe buýt 197 từ trung tâm thủ đô Berlin.',
    howToGetEn: 'Bus 054 or 197 from central Berlin districts.',
    addressVi: 'Hausvaterweg 39, 13057 Berlin, Đức',
    addressEn: 'Hausvaterweg 39, 13057 Berlin, Germany',
    latitude: 52.5694,
    longitude: 13.5283,
    googlePlaceKeyword: 'Tierheim Berlin Hausvaterweg Germany',
    rating: 4.8,
    reviewsCount: 380,
    heroImage: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Tham quan cơ sở nhân đạo kiểu mẫu',
        titleEn: 'Tour world-class welfare facilities',
        descVi: 'Tìm hiểu quy trình nhận nuôi văn minh, thăm những ngôi nhà kính tràn ngập ánh sáng của chó mèo.',
        descEn: 'Learn about humane adoption standards and walk through sunlit animal pavilions.',
      },
    ],
  },
  {
    id: 'de_englischer_garten',
    countryId: 'germany',
    name: 'Vườn Anh (Englischer Garten)',
    categoryVi: 'Đại công viên đô thị',
    categoryEn: 'Historic Public Urban Park',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Một trong những công viên đô thị lớn nhất thế giới, thiên đường cho thú cưng thỏa sức chạy trên bãi cỏ rộng thênh thang.',
    areaVi: 'Diện tích 375 hecta',
    areaEn: '375 hectares parkland',
    howToGetVi: 'Tàu điện U-Bahn tuyến U3, U6 tới ga Universität hoặc Giselastraße.',
    howToGetEn: 'Munich U-Bahn U3/U6 to Universität or Giselastraße station.',
    addressVi: 'Munich, Bang Bavaria, Đức',
    addressEn: 'Munich, Bavaria, Germany',
    latitude: 48.1534,
    longitude: 11.5925,
    googlePlaceKeyword: 'Englischer Garten Munich Germany',
    rating: 4.9,
    reviewsCount: 520,
    heroImage: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1534361960057-19889db98a1e?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Chạy nhảy tự do trên đồng cỏ xanh',
        titleEn: 'Off-leash running on green meadows',
        descVi: 'Không gian mở ven dòng suối Schwabinger Bach mát lạnh cho cún cưng nô đùa.',
        descEn: 'Wide expanses alongside refreshing Schwabinger Bach stream where dogs play happily.',
      },
    ],
  },
  {
    id: 'de_sylt_island',
    countryId: 'germany',
    name: 'Đảo Sylt',
    categoryVi: 'Đảo nghỉ dưỡng & bãi biển cồn cát',
    categoryEn: 'North Sea Island & Dog Dunes',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Hòn đảo nghỉ dưỡng nổi tiếng ở Biển Bắc với 15 bãi biển dành riêng cho chó và làn gió biển mát lành sảng khoái.',
    areaVi: 'Đảo dài 38 km với bờ biển cát vàng',
    areaEn: '38 km long island with sandy coastline',
    howToGetVi: 'Đi tàu hỏa vượt biển Sylt Shuttle hoặc phà từ Rømø.',
    howToGetEn: 'Ride the famous Sylt Shuttle train over the causeway or car ferry from Rømø.',
    addressVi: 'Huyện Nordfriesland, Bang Schleswig-Holstein, Đức',
    addressEn: 'Schleswig-Holstein, North Frisian Islands, Germany',
    latitude: 54.9079,
    longitude: 8.3304,
    googlePlaceKeyword: 'Sylt Island Schleswig-Holstein Germany',
    rating: 4.8,
    reviewsCount: 160,
    heroImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544568100-847a948585b9?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Khám phá bãi cát Biển Bắc',
        titleEn: 'North Sea beach adventures',
        descVi: 'Trải nghiệm những chiếc ghế đan Strandkorb ấm cúng cùng cún cưng ngắm sóng vỗ dạt dào.',
        descEn: 'Relax inside traditional hooded beach chairs (Strandkorb) with your four-legged companion.',
      },
    ],
  },

  // --- THỤY SỸ ---
  {
    id: 'ch_sbb_panoramic_train',
    countryId: 'switzerland',
    name: 'Tàu hỏa ngắm cảnh SBB',
    categoryVi: 'Tuyến tàu hỏa ngắm cảnh dãy Alps',
    categoryEn: 'Panoramic Train & Alpine Rail',
    statusTextVi: 'Đang mở đến 08:00 PM',
    statusTextEn: 'Open until 08:00 PM',
    introText: 'Mạng lưới đường sắt Thụy Sỹ (SBB) nổi tiếng toàn cầu cho phép mang thú cưng lên tàu cùng chiêm ngưỡng dãy Alps hùng vĩ.',
    areaVi: 'Tuyến đường sắt trải khắp đất nước Thụy Sỹ',
    areaEn: 'Nationwide scenic Swiss rail network',
    howToGetVi: 'Khởi hành tại bất kỳ nhà ga lớn nào như Zurich HB, Geneva, Lucerne.',
    howToGetEn: 'Board at major Swiss hubs like Zurich HB, Geneva, or Lucerne.',
    addressVi: 'Khắp các cung đường tại Thụy Sỹ',
    addressEn: 'Across Switzerland, Swiss Alps',
    latitude: 46.8182,
    longitude: 8.2275,
    googlePlaceKeyword: 'SBB Panoramic Train Switzerland',
    rating: 4.9,
    reviewsCount: 410,
    heroImage: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Du ngoạn ngắm sông băng cùng thú cưng',
        titleEn: 'Glacier and Alpine Views',
        descVi: 'Chính sách thân thiện cho phép thú cưng ngắm nhìn đèo tuyết và thung lũng qua cửa sổ panorama.',
        descEn: 'Dog-friendly policy welcoming leashed pets to experience snow-capped peaks and valleys.',
      },
    ],
  },
  {
    id: 'ch_zermatt_village',
    countryId: 'switzerland',
    name: 'Làng Zermatt',
    categoryVi: 'Làng cổ tích không khói xe',
    categoryEn: 'Car-free Alpine Village',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Ngôi làng vùng núi không có ô tô dưới chân đỉnh Matterhorn huyền thoại, nơi cún cưng có thể thỏa thích dạo bộ thanh bình.',
    areaVi: 'Khu vực thung lũng Zermatt',
    areaEn: 'Zermatt valley and Matterhorn foothills',
    howToGetVi: 'Đi tàu hỏa Matterhorn Gotthard Bahn từ Täsch đến Zermatt.',
    howToGetEn: 'Take the Matterhorn Gotthard Bahn train from Täsch into Zermatt.',
    addressVi: 'Zermatt, Bang Valais, Thụy Sỹ',
    addressEn: 'Zermatt, Valais, Switzerland',
    latitude: 45.9765,
    longitude: 7.7491,
    googlePlaceKeyword: 'Zermatt Village Valais Switzerland',
    rating: 4.9,
    reviewsCount: 650,
    heroImage: 'https://images.unsplash.com/photo-1502784444187-359ac186c5bb?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1502784444187-359ac186c5bb?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Check-in cùng đỉnh núi Matterhorn',
        titleEn: 'Matterhorn backdrop walks',
        descVi: 'Dạo quanh các con ngõ lát đá cổ kính hoàn toàn không khói xe và ngắm nhìn đỉnh kim tự tháp tuyết.',
        descEn: 'Pure mountain air with no combustion cars, ideal for scenic walks with stunning views.',
      },
    ],
  },
  {
    id: 'ch_sigriswil_bridge',
    countryId: 'switzerland',
    name: 'Cầu treo Panorama Sigriswil',
    categoryVi: 'Cầu treo đi bộ ngắm cảnh',
    categoryEn: 'Panoramic Suspension Bridge',
    statusTextVi: 'Mở cửa cả ngày (24 giờ)',
    statusTextEn: 'Open 24 hours',
    introText: 'Cây cầu treo đi bộ ngoạn mục bắc qua hẻm núi Gummischlucht với tầm nhìn hướng trọn ra hồ Thun thơ mộng.',
    areaVi: 'Chiều dài cầu 340m, độ cao 182m',
    areaEn: 'Length 340m, height 182m above gorge',
    howToGetVi: 'Đi xe buýt tuyến STI số 25 từ ga xe lửa Thun đến trạm Sigriswil Dorf.',
    howToGetEn: 'Take STI Bus 25 from Thun railway station to Sigriswil Dorf.',
    addressVi: 'Sigriswil, Bang Bern, Thụy Sỹ',
    addressEn: 'Sigriswil, Canton of Bern, Switzerland',
    latitude: 46.7169,
    longitude: 7.7126,
    googlePlaceKeyword: 'Panoramabrücke Sigriswil Bern Switzerland',
    rating: 4.8,
    reviewsCount: 230,
    heroImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
    galleryImages: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=800&auto=format&fit=crop',
    ],
    experiences: [
      {
        titleVi: 'Dạo bước trên mây',
        titleEn: 'Walk above the gorge',
        descVi: 'Mặt cầu an toàn vững chắc, cho phép cún cưng có dây dắt đi dạo và chiêm ngưỡng toàn cảnh hồ Thun.',
        descEn: 'Stable pedestrian bridge allowing leashed dogs to accompany owners above Lake Thun.',
      },
    ],
  },
];

// =========================================================================
// 7. MOCK REVIEWS CHO CÁC ĐỊA ĐIỂM (OFFLINE FALLBACK HOẶC DỮ LIỆU CỘNG ĐỒNG)
// =========================================================================
function generateMockReviewsForPlace(paradiseId: string, placeName: string) {
  return [
    {
      id: `rev_${paradiseId}_01`,
      paradiseId,
      authorName: 'Minh Hằng & Cún Mochi',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      rating: 5,
      dateText: '1 tuần trước',
      content: `Chuyến đi đến "${placeName}" trên cả tuyệt vời! Môi trường thân thiện, không khí trong lành và thú cưng của mình rất thích thú.`,
      images: [
        'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=500&auto=format&fit=crop',
      ],
      isFromGoogle: false,
      huuichCount: 14,
      camonCount: 7,
      huhuCount: 0,
    },
    {
      id: `rev_${paradiseId}_02`,
      paradiseId,
      googleReviewId: `mock_google_${paradiseId}_02`,
      authorName: 'David Miller (Khách du lịch Google)',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      rating: 5,
      dateText: '3 tuần trước',
      content: `Outstanding experience visiting ${placeName}! Clean, welcoming staff, and very well maintained for animals and travelers alike.`,
      images: [],
      isFromGoogle: true,
      huuichCount: 9,
      camonCount: 4,
      huhuCount: 0,
    },
  ];
}

// =========================================================================
// 8. GOOGLE PLACES SYNC HELPERS (FORMAT GIỜ, CDN ẢNH, TÌM PLACE ID)
// =========================================================================
function formatTime12h(timeStr: string): string {
  if (!timeStr || timeStr.length < 4) return timeStr;
  const h = parseInt(timeStr.slice(0, 2), 10);
  const m = timeStr.slice(2);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const hFormatted = h12 < 10 ? `0${h12}` : `${h12}`;
  return `${hFormatted}:${m} ${period}`;
}

function calculateOpeningStatus(openingHours: any): { vi: string; en: string } {
  if (!openingHours) {
    return { vi: 'Đang mở đến 10:00 PM', en: 'Open until 10:00 PM' };
  }

  const isOpenNow = openingHours.open_now ?? true;
  const periods = openingHours.periods || [];

  if (periods.length === 1 && periods[0].open?.day === 0 && periods[0].open?.time === '0000' && !periods[0].close) {
    return { vi: 'Mở cửa cả ngày (24 giờ)', en: 'Open 24 hours' };
  }

  const now = new Date();
  const currentDay = now.getDay();

  if (isOpenNow) {
    const todayPeriod = periods.find((p: any) => p.open?.day === currentDay);
    if (todayPeriod?.close?.time) {
      const closeTime = formatTime12h(todayPeriod.close.time);
      return {
        vi: `Đang mở đến ${closeTime}`,
        en: `Open until ${closeTime}`,
      };
    }
    return { vi: 'Đang mở đến 10:00 PM', en: 'Open until 10:00 PM' };
  } else {
    const nextPeriod =
      periods.find((p: any) => p.open?.day === currentDay && parseInt(p.open.time, 10) > now.getHours() * 100) ||
      periods.find((p: any) => p.open?.day === (currentDay + 1) % 7);

    if (nextPeriod?.open?.time) {
      const openTime = formatTime12h(nextPeriod.open.time);
      return {
        vi: `Đang đóng cửa • Mở lúc ${openTime}`,
        en: `Closed • Opens at ${openTime}`,
      };
    }
    return { vi: 'Đang đóng cửa', en: 'Closed' };
  }
}

async function getDirectGooglePhotoUrl(photoReference: string, apiKey: string): Promise<string> {
  const requestUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoReference}&key=${apiKey}`;
  try {
    const res = await axios.get(requestUrl, {
      maxRedirects: 0,
      validateStatus: (status) => status === 302 || status === 200,
    });
    if (res.status === 302 && res.headers.location) {
      return res.headers.location;
    }
  } catch (err: any) {
    if (err.response?.status === 302 && err.response.headers?.location) {
      return err.response.headers.location;
    }
  }
  return requestUrl;
}

async function findFreshPlaceId(query: string, apiKey: string): Promise<string | null> {
  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
    const res = await axios.get(searchUrl);
    if (res.data?.status === 'OK' && res.data?.candidates?.length > 0) {
      return res.data.candidates[0].place_id;
    }
    return null;
  } catch {
    return null;
  }
}

// =========================================================================
// 9. QUY TRÌNH SEED TỔNG HỢP (SEED PROCEDURES, PLACES & REVIEWS)
// =========================================================================
export async function seedAll() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU CHẠY SEED NÂNG CẤP: PROCEDURES + PET PARADISES + REVIEWS');
  console.log('================================================================\n');

  // --- BƯỚC 1: Dọn dẹp dữ liệu cũ tránh trùng lặp ---
  console.log('🧹 Dọn dẹp dữ liệu cũ...');
  await prisma.procedureDocument.deleteMany({});
  await prisma.procedureStep.deleteMany({});
  await prisma.procedureMilestone.deleteMany({});
  await prisma.petParadiseReviewReaction.deleteMany({});
  await prisma.petParadiseReviewReport.deleteMany({});
  await prisma.petParadiseReview.deleteMany({});
  await prisma.petParadise.deleteMany({});

  // --- BƯỚC 2: Seed 10 Quốc Gia ---
  console.log(`🌍 Đang nạp danh sách ${COUNTRIES.length} quốc gia...`);
  for (const c of COUNTRIES) {
    await prisma.countryProcedure.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    });
  }
  console.log(`✅ Đã seed ${COUNTRIES.length} quốc gia thành công.`);

  // --- BƯỚC 3: Seed Milestones & Steps cho từng quốc gia ---
  let totalMilestones = 0;
  let totalSteps = 0;

  for (const [countryId, milestones] of Object.entries(ALL_COUNTRY_MILESTONES)) {
    for (const m of milestones) {
      totalMilestones++;
      await prisma.procedureMilestone.create({
        data: {
          countryId,
          dateLabel: m.dateLabel,
          sortOrder: m.sortOrder,
          steps: {
            create: m.steps.map((s, idx) => {
              totalSteps++;
              return {
                stepCode: s.stepCode,
                title: s.title,
                subtitle: s.subtitle,
                desc: s.desc,
                notes: s.notes ? s.notes : [],
                hasButton: s.hasButton !== undefined ? s.hasButton : true,
                borderColor: s.borderColor || null,
                sortOrder: idx,
              };
            }),
          },
        },
      });
    }
  }
  console.log(`✅ Đã seed ${totalMilestones} mốc thời gian và ${totalSteps} bước kiểm dịch.`);

  // --- BƯỚC 4: Seed Tài liệu kiểm dịch ---
  for (const doc of ALL_PROCEDURE_DOCUMENTS) {
    await prisma.procedureDocument.create({ data: doc });
  }
  console.log(`✅ Đã seed ${ALL_PROCEDURE_DOCUMENTS.length} biểu mẫu & tài liệu hướng dẫn kiểm dịch.`);

  // --- BƯỚC 5: Seed Toàn bộ Địa Điểm Pet Paradise & Mock Reviews ---
  console.log(`\n📍 Đang seed ${ALL_PET_PARADISES.length} địa điểm Pet Paradise theo từng quốc gia...`);

  for (const p of ALL_PET_PARADISES) {
    const createdPlace = await prisma.petParadise.create({
      data: {
        id: p.id,
        countryId: p.countryId,
        name: p.name,
        categoryVi: p.categoryVi,
        categoryEn: p.categoryEn,
        statusTextVi: p.statusTextVi,
        statusTextEn: p.statusTextEn,
        introText: p.introText,
        areaVi: p.areaVi,
        areaEn: p.areaEn,
        howToGetVi: p.howToGetVi,
        howToGetEn: p.howToGetEn,
        addressVi: p.addressVi,
        addressEn: p.addressEn,
        latitude: p.latitude,
        longitude: p.longitude,
        googlePlaceId: p.googlePlaceId || null,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
        heroImage: p.heroImage,
        galleryImages: p.galleryImages,
        experiences: p.experiences,
      },
    });

    // Seed mock reviews ban đầu
    const mockReviews = generateMockReviewsForPlace(createdPlace.id, createdPlace.name);
    for (const r of mockReviews) {
      await prisma.petParadiseReview.create({
        data: r,
      });
    }

    console.log(`  ➕ [${p.countryId.toUpperCase()}] "${p.name}" (Kèm ${mockReviews.length} reviews mẫu)`);
  }

  // --- BƯỚC 6: Tự động đồng bộ Google Reviews & Photos (Nếu có GOOGLE_MAPS_API_KEY) ---
  if (!GOOGLE_API_KEY) {
    console.log('\n💡 THÔNG BÁO: Chưa tìm thấy GOOGLE_MAPS_API_KEY trong file .env.');
    console.log('👉 Đã sử dụng toàn bộ hình ảnh và reviews mẫu offline chất lượng cao.');
  } else {
    console.log('\n================================================================');
    console.log('🌐 PHÁT HIỆN GOOGLE MAPS API KEY: TIẾN HÀNH ĐỒNG BỘ GOOGLE PLACES THỰC TẾ');
    console.log('================================================================\n');

    for (const p of ALL_PET_PARADISES) {
      console.log(`🔍 Tra cứu Google Maps cho: "${p.name}"...`);
      let activePlaceId = p.googlePlaceId;

      if (!activePlaceId) {
        activePlaceId = (await findFreshPlaceId(p.googlePlaceKeyword, GOOGLE_API_KEY)) || undefined;
        if (activePlaceId) {
          await prisma.petParadise.update({
            where: { id: p.id },
            data: { googlePlaceId: activePlaceId },
          });
        }
      }

      if (!activePlaceId) {
        console.warn(`  ⚠️ Không tìm thấy Place ID cho keyword "${p.googlePlaceKeyword}". Giữ nguyên dữ liệu seed.`);
        continue;
      }

      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${activePlaceId}&fields=name,reviews,rating,user_ratings_total,photos,opening_hours,current_opening_hours&language=vi&key=${GOOGLE_API_KEY}`;
        const res = await axios.get(detailsUrl);

        if (res.data?.status === 'OK' && res.data?.result) {
          const result = res.data.result;
          const rawPhotos = result.photos || [];
          const reviews = result.reviews || [];
          const rating = result.rating || p.rating;
          const userRatingsTotal = result.user_ratings_total || p.reviewsCount;
          const openingStatus = calculateOpeningStatus(result.current_opening_hours || result.opening_hours);

          // Lấy tối đa 8 ảnh CDN độ phân giải cao
          const googlePhotoUrls: string[] = [];
          for (let idx = 0; idx < Math.min(rawPhotos.length, 8); idx++) {
            const directUrl = await getDirectGooglePhotoUrl(rawPhotos[idx].photo_reference, GOOGLE_API_KEY);
            googlePhotoUrls.push(directUrl);
          }

          // Cập nhật lại Pet Paradise theo dữ liệu thực từ Google
          await prisma.petParadise.update({
            where: { id: p.id },
            data: {
              rating,
              reviewsCount: userRatingsTotal,
              statusTextVi: openingStatus.vi,
              statusTextEn: openingStatus.en,
              ...(googlePhotoUrls.length > 0 && {
                heroImage: googlePhotoUrls[0],
                galleryImages: googlePhotoUrls,
              }),
            },
          });

          // Lưu các Google Reviews thực tế
          for (let i = 0; i < reviews.length; i++) {
            const gr = reviews[i];
            const reviewUniqueKey = `google_${p.id}_${gr.time}_${Buffer.from(gr.author_name).toString('hex').slice(0, 8)}`;
            const reviewPhotos = googlePhotoUrls.length > i + 1 ? [googlePhotoUrls[i + 1]] : [];

            await prisma.petParadiseReview.upsert({
              where: { googleReviewId: reviewUniqueKey },
              update: {
                content: gr.text || '',
                rating: gr.rating || 5,
                dateText: gr.relative_time_description || 'Gần đây',
                authorAvatar: gr.profile_photo_url || null,
                images: reviewPhotos,
              },
              create: {
                paradiseId: p.id,
                googleReviewId: reviewUniqueKey,
                authorName: gr.author_name || 'Khách du lịch Google',
                authorAvatar: gr.profile_photo_url || null,
                rating: gr.rating || 5,
                dateText: gr.relative_time_description || 'Gần đây',
                content: gr.text || '',
                images: reviewPhotos,
                isFromGoogle: true,
                huuichCount: Math.floor(Math.random() * 8) + 2,
                camonCount: Math.floor(Math.random() * 5) + 1,
                huhuCount: 0,
              },
            });
          }

          console.log(`  ✨ [Đồng bộ thành công] "${p.name}": ${googlePhotoUrls.length} ảnh CDN & ${reviews.length} reviews Google.`);
        }
      } catch (err: any) {
        console.error(`  ❌ Lỗi khi tải dữ liệu Google cho "${p.name}":`, err.message);
      }
    }
  }

  console.log('\n================================================================');
  console.log('🎉 HOÀN THÀNH TẤT CẢ CÁC BƯỚC SEED VÀ ĐỒNG BỘ DỮ LIỆU THÀNH CÔNG!');
  console.log('================================================================');
}

// Thực thi file
seedAll()
  .catch((e) => {
    console.error('❌ Lỗi trong quá trình chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });