// src/database/prisma/seed-procedures.ts
//
// File seed "tất cả trong một" — gộp từ 2 file cũ:
//   - seed-procedures.ts       (quốc gia, quy trình nhập cảnh, tài liệu)
//   - sync-google-reviews.ts   (đồng bộ ảnh & review thật từ Google Maps)
//
// File này làm 3 việc, theo thứ tự:
//   1. seedProcedures()            → seed quốc gia + milestones/steps + tài liệu kiểm dịch
//   2. seedParadisesAndReviews()   → seed địa điểm "Pet Paradise" theo từng quốc gia + review mẫu
//   3. syncGoogleReviewsAndPhotos()→ (tuỳ chọn) đồng bộ ảnh/giờ mở cửa/review THẬT từ Google Maps
//                                    — chỉ chạy nếu có GOOGLE_MAPS_API_KEY trong .env, nếu không sẽ
//                                    tự bỏ qua (không còn process.exit như bản gốc, vì giờ chỉ là
//                                    một bước tuỳ chọn trong cả pipeline, không phải toàn bộ mục đích
//                                    của file).
//
// => sync-google-reviews.ts không còn cần thiết nữa, có thể xoá khỏi project.

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

export interface ParadiseExperience {
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
}

export interface ParadiseSeedItem {
  id: string;
  countryId: string;
  name: string;
  categoryVi: string;
  categoryEn: string;
  statusTextVi: string;
  statusTextEn: string;
  introText: string;
  areaVi: string;
  areaEn: string;
  howToGetVi: string;
  howToGetEn: string;
  addressVi: string;
  addressEn: string;
  latitude: number;
  longitude: number;
  googlePlaceId?: string;
  /** Chỉ dùng nội bộ để tìm Place ID khi đồng bộ Google — KHÔNG phải field trong DB */
  googleSearchKeyword: string;
  rating: number;
  reviewsCount: number;
  heroImage: string;
  galleryImages: string[];
  experiences: ParadiseExperience[];
}

export interface ParadiseReviewSeedItem {
  id: string;
  paradiseId: string;
  googleReviewId?: string;
  authorName: string;
  authorAvatar: string;
  rating: number;
  dateText: string;
  content: string;
  images: string[];
  isFromGoogle: boolean;
  huuichCount: number;
  camonCount: number;
  huhuCount: number;
}

// =========================================================================
// 2. CÁC BƯỚC MẪU (PROCEDURE STEPS)
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
// 3. DANH SÁCH 10 QUỐC GIA
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
// 4. TOÀN BỘ MILESTONES CỦA 10 NƯỚC
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
          notes: [
            'Cơ quan Kiểm dịch Động vật sẽ cấp Giấy chứng nhận kiểm dịch nhập khẩu (Vietnam Quarantine Certificate) cho chó/mèo đủ điều kiện.',
          ],
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
// 5. TOÀN BỘ TÀI LIỆU KIỂM DỊCH (PROCEDURE DOCUMENTS)
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
// 6. DANH SÁCH ĐỊA ĐIỂM "PET PARADISE" THEO TỪNG QUỐC GIA
// =========================================================================
const PARADISE_LOCATIONS: ParadiseSeedItem[] = [
  // ---------------- NHẬT BẢN (địa điểm mẫu gốc, giữ nguyên) ----------------
  {
    id: 'tashirojima-island',
    countryId: 'japan',
    name: 'Đảo Tashirojima (Đảo Mèo)',
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
    googlePlaceId: 'ChIJVXk4F3bZgzURaU1x9Xw5o-g',
    googleSearchKeyword: 'Tashirojima Island Ishinomaki Miyagi',
    rating: 4.8,
    reviewsCount: 123,
    heroImage: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=1000&auto=format&fit=crop',
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

  // ---------------- TRUNG QUỐC ----------------
  {
    id: 'moon-cat-city-guangzhou',
    countryId: 'china',
    name: 'Moon Cat City',
    categoryVi: 'Tổ hợp giải trí & mua sắm chủ đề mèo',
    categoryEn: 'Cat-themed shopping & entertainment complex',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Không gian mua sắm, ẩm thực và check-in được thiết kế trọn vẹn theo chủ đề mèo giữa lòng Quảng Châu, nơi "con sen" nào cũng muốn ghé qua.',
    areaVi: 'Nằm trong khu phức hợp thương mại tại trung tâm thành phố',
    areaEn: 'Located inside a commercial complex in the city center',
    howToGetVi: 'Di chuyển bằng taxi hoặc tàu điện ngầm đến trung tâm Quảng Châu, sau đó đi bộ thêm khoảng 5-10 phút.',
    howToGetEn: 'Take a taxi or the metro to central Guangzhou, then walk about 5–10 minutes.',
    addressVi: 'Quảng Châu, Quảng Đông, Trung Quốc',
    addressEn: 'Guangzhou, Guangdong, China',
    latitude: 23.1291,
    longitude: 113.2644,
    googleSearchKeyword: 'Moon Cat City Guangzhou',
    rating: 4.5,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/moon-cat-city-guangzhou-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/moon-cat-city-guangzhou-1/800/600',
      'https://picsum.photos/seed/moon-cat-city-guangzhou-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Check-in cùng "hội mèo"',
        titleEn: 'Check in with the resident cats',
        descVi: 'Hàng chục góc trang trí theo phong cách mèo dễ thương, phù hợp cho cả gia đình có thú cưng ghé thăm.',
        descEn: 'Dozens of photo-perfect corners decorated in an adorable cat theme, great for families visiting with pets.',
      },
    ],
  },
  {
    id: 'bailian-xijiao-shanghai',
    countryId: 'china',
    name: 'Trung tâm thương mại Bailian Xijiao',
    categoryVi: 'Trung tâm thương mại thân thiện với thú cưng',
    categoryEn: 'Pet-friendly shopping mall',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Một trong số ít trung tâm thương mại tại Thượng Hải cho phép thú cưng vào mua sắm cùng chủ, có khu vui chơi riêng dành cho các bé.',
    areaVi: 'Nằm ở khu vực phía Tây thành phố Thượng Hải',
    areaEn: 'Located in the western area of Shanghai',
    howToGetVi: 'Di chuyển bằng tàu điện ngầm hoặc taxi đến khu vực Hongqiao/Xijiao, Thượng Hải.',
    howToGetEn: 'Take the metro or a taxi to the Hongqiao/Xijiao area of Shanghai.',
    addressVi: 'Thượng Hải, Trung Quốc',
    addressEn: 'Shanghai, China',
    latitude: 31.2304,
    longitude: 121.4737,
    googleSearchKeyword: 'Bailian Xijiao Shopping Mall Shanghai',
    rating: 4.3,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/bailian-xijiao-shanghai-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/bailian-xijiao-shanghai-1/800/600',
      'https://picsum.photos/seed/bailian-xijiao-shanghai-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Mua sắm cùng thú cưng',
        titleEn: 'Shop together with your pet',
        descVi: 'Được phép dắt chó/mèo vào hầu hết các khu vực trong trung tâm thương mại, kèm khu vệ sinh và nghỉ chân riêng cho thú cưng.',
        descEn: 'Dogs and cats are welcome in most areas of the mall, with dedicated rest and clean-up zones for pets.',
      },
    ],
  },
  {
    id: 'shiquan-street-jiangsu',
    countryId: 'china',
    name: 'Phố cổ Shiquan',
    categoryVi: 'Phố cổ thân thiện với thú cưng',
    categoryEn: 'Pet-friendly old street',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Con phố cổ mang đậm nét kiến trúc Giang Nam, la liệt quán cà phê và cửa hàng nhỏ xinh cho phép ghé thăm cùng thú cưng.',
    areaVi: 'Phố cổ nằm tại thành phố Tô Châu, tỉnh Giang Tô',
    areaEn: 'The old street is located in Suzhou, Jiangsu province',
    howToGetVi: 'Di chuyển bằng tàu cao tốc từ Thượng Hải đến Tô Châu (khoảng 30 phút), sau đó bắt taxi vào phố cổ.',
    howToGetEn: 'Take a high-speed train from Shanghai to Suzhou (about 30 minutes), then a taxi into the old street.',
    addressVi: 'Tô Châu, Giang Tô, Trung Quốc',
    addressEn: 'Suzhou, Jiangsu, China',
    latitude: 31.3040,
    longitude: 120.6295,
    googleSearchKeyword: 'Shiquan Street Suzhou Jiangsu',
    rating: 4.6,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/shiquan-street-jiangsu-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/shiquan-street-jiangsu-1/800/600',
      'https://picsum.photos/seed/shiquan-street-jiangsu-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Dạo phố cổ cùng thú cưng',
        titleEn: 'Stroll the old street with your pet',
        descVi: 'Vừa nhâm nhi trà sữa vừa dạo quanh những con hẻm cổ kính, ngắm kiến trúc Giang Nam truyền thống.',
        descEn: 'Sip milk tea while wandering through charming old alleys and admiring traditional Jiangnan architecture.',
      },
    ],
  },

  // ---------------- PHÁP ----------------
  {
    id: 'amneville-aquarium',
    countryId: 'france',
    name: 'Thuỷ cung Amnéville',
    categoryVi: 'Thuỷ cung & công viên động vật',
    categoryEn: 'Aquarium & animal park',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Một trong những thuỷ cung lớn nhất châu Âu, quy tụ hàng ngàn loài sinh vật biển và có khu vực dành riêng cho khách mang theo thú cưng.',
    areaVi: 'Nằm trong quần thể công viên giải trí Amnéville',
    areaEn: 'Located within the Amnéville leisure park complex',
    howToGetVi: 'Di chuyển bằng ô tô hoặc tàu đến thành phố Amnéville, vùng Grand Est, Pháp.',
    howToGetEn: 'Travel by car or train to the town of Amnéville in the Grand Est region of France.',
    addressVi: 'Amnéville, Grand Est, Pháp',
    addressEn: 'Amnéville, Grand Est, France',
    latitude: 49.2667,
    longitude: 6.1333,
    googleSearchKeyword: 'Aquarium Amnéville France',
    rating: 4.5,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/amneville-aquarium-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/amneville-aquarium-1/800/600',
      'https://picsum.photos/seed/amneville-aquarium-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Khám phá thế giới đại dương',
        titleEn: 'Explore the underwater world',
        descVi: 'Chiêm ngưỡng cá mập, cá đuối và san hô qua đường hầm kính khổng lồ giữa lòng thuỷ cung.',
        descEn: 'Admire sharks, rays and coral through a giant glass tunnel inside the aquarium.',
      },
    ],
  },
  {
    id: 'nice-seaside-city',
    countryId: 'france',
    name: 'Thành phố biển Nice',
    categoryVi: 'Thành phố biển thân thiện với thú cưng',
    categoryEn: 'Pet-friendly seaside city',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Bờ biển Promenade des Anglais thơ mộng cho phép thú cưng dạo chơi cùng chủ, hoà mình vào không khí Địa Trung Hải.',
    areaVi: "Thành phố ven biển thuộc vùng Côte d'Azur",
    areaEn: "A coastal city on the French Riviera (Côte d'Azur)",
    howToGetVi: "Bay đến sân bay Nice Côte d'Azur, trung tâm thành phố cách sân bay khoảng 15-20 phút di chuyển.",
    howToGetEn: "Fly into Nice Côte d'Azur Airport; the city center is about 15–20 minutes away.",
    addressVi: "Nice, Provence-Alpes-Côte d'Azur, Pháp",
    addressEn: "Nice, Provence-Alpes-Côte d'Azur, France",
    latitude: 43.7102,
    longitude: 7.2620,
    googleSearchKeyword: 'Nice France seaside promenade',
    rating: 4.7,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/nice-seaside-city-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/nice-seaside-city-1/800/600',
      'https://picsum.photos/seed/nice-seaside-city-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Dạo biển cùng thú cưng',
        titleEn: 'Beach walks with your pet',
        descVi: 'Nhiều bãi biển và quán cà phê ven bờ tại Nice chào đón thú cưng, lý tưởng để thư giãn buổi chiều.',
        descEn: 'Many beaches and seafront cafés in Nice welcome pets, perfect for a relaxed afternoon.',
      },
    ],
  },
  {
    id: 'royal-garden-paris',
    countryId: 'france',
    name: 'Khu vườn hoàng gia (Jardin des Tuileries)',
    categoryVi: 'Công viên hoàng gia giữa lòng thủ đô',
    categoryEn: 'Royal garden in the heart of the capital',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Khu vườn cổ kính nằm giữa Louvre và quảng trường Concorde, là nơi lý tưởng để dạo bộ cùng thú cưng giữa lòng Paris.',
    areaVi: 'Trung tâm quận 1, Paris',
    areaEn: 'Central 1st arrondissement, Paris',
    howToGetVi: 'Di chuyển bằng tàu điện ngầm đến ga Tuileries hoặc Concorde.',
    howToGetEn: 'Take the metro to Tuileries or Concorde station.',
    addressVi: 'Paris, Île-de-France, Pháp',
    addressEn: 'Paris, Île-de-France, France',
    latitude: 48.8634,
    longitude: 2.3275,
    googleSearchKeyword: 'Jardin des Tuileries Paris',
    rating: 4.7,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/royal-garden-paris-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/royal-garden-paris-1/800/600',
      'https://picsum.photos/seed/royal-garden-paris-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Dạo bộ giữa vườn hoàng gia',
        titleEn: 'Stroll through the royal garden',
        descVi: 'Đi dạo dưới hàng cây cổ thụ, ngắm các bức tượng và đài phun nước mang đậm dấu ấn hoàng gia Pháp.',
        descEn: 'Walk beneath centuries-old trees and admire statues and fountains steeped in French royal history.',
      },
    ],
  },

  // ---------------- HY LẠP ----------------
  {
    id: 'mykonos-cat-island',
    countryId: 'greece',
    name: 'Đảo mèo Mykonos',
    categoryVi: 'Đảo mèo nổi tiếng',
    categoryEn: 'Famous cat island',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Những chú mèo hoang thân thiện lang thang khắp các con hẻm trắng xanh đặc trưng của Mykonos, trở thành một phần không thể thiếu của hòn đảo.',
    areaVi: 'Đảo thuộc quần đảo Cyclades',
    areaEn: 'An island in the Cyclades archipelago',
    howToGetVi: 'Bay hoặc đi phà từ Athens đến đảo Mykonos, thời gian di chuyển bằng phà khoảng 2-5 giờ tuỳ loại tàu.',
    howToGetEn: 'Fly or take a ferry from Athens to Mykonos; ferry travel time is about 2–5 hours depending on the boat.',
    addressVi: 'Mykonos, Cyclades, Hy Lạp',
    addressEn: 'Mykonos, Cyclades, Greece',
    latitude: 37.4467,
    longitude: 25.3289,
    googleSearchKeyword: 'Mykonos island Cyclades Greece',
    rating: 4.8,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/mykonos-cat-island-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/mykonos-cat-island-1/800/600',
      'https://picsum.photos/seed/mykonos-cat-island-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Gặp gỡ "hội mèo" bản địa',
        titleEn: 'Meet the local cats',
        descVi: 'Ghé các quán cà phê ven biển, nơi những chú mèo bản địa thường ghé qua xin vuốt ve từ du khách.',
        descEn: 'Visit seafront cafés where local cats often stop by looking for a friendly pat from visitors.',
      },
    ],
  },
  {
    id: 'santorini-cat-island',
    countryId: 'greece',
    name: 'Đảo mèo Santorini',
    categoryVi: 'Đảo mèo nổi tiếng',
    categoryEn: 'Famous cat island',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Bên cạnh khung cảnh hoàng hôn nổi tiếng thế giới, Santorini còn là nơi trú ngụ của rất nhiều chú mèo hoang dạn dĩ và thân thiện.',
    areaVi: 'Đảo thuộc quần đảo Cyclades',
    areaEn: 'An island in the Cyclades archipelago',
    howToGetVi: 'Bay hoặc đi phà từ Athens đến đảo Santorini.',
    howToGetEn: 'Fly or take a ferry from Athens to Santorini.',
    addressVi: 'Santorini, Cyclades, Hy Lạp',
    addressEn: 'Santorini, Cyclades, Greece',
    latitude: 36.3932,
    longitude: 25.4615,
    googleSearchKeyword: 'Santorini island Cyclades Greece',
    rating: 4.9,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/santorini-cat-island-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/santorini-cat-island-1/800/600',
      'https://picsum.photos/seed/santorini-cat-island-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Ngắm hoàng hôn cùng những người bạn nhỏ',
        titleEn: 'Watch the sunset with furry companions',
        descVi: 'Không hiếm để bắt gặp một chú mèo nằm sưởi nắng ngay cạnh bạn khi ngắm hoàng hôn tại Oia.',
        descEn: 'It is common to spot a cat sunbathing right next to you while watching the sunset in Oia.',
      },
    ],
  },
  {
    id: 'chania-beach-crete',
    countryId: 'greece',
    name: 'Bãi biển ven Chania',
    categoryVi: 'Bãi biển thân thiện với thú cưng',
    categoryEn: 'Pet-friendly beach',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Những bãi biển cát mịn ven thành phố cổ Chania trên đảo Crete cho phép thú cưng tắm biển và nô đùa cùng chủ.',
    areaVi: 'Thành phố Chania, đảo Crete',
    areaEn: 'The city of Chania, Crete island',
    howToGetVi: 'Bay đến sân bay Chania hoặc đi phà từ Athens đến đảo Crete.',
    howToGetEn: 'Fly into Chania Airport or take a ferry from Athens to Crete.',
    addressVi: 'Chania, Crete, Hy Lạp',
    addressEn: 'Chania, Crete, Greece',
    latitude: 35.5138,
    longitude: 24.0180,
    googleSearchKeyword: 'Chania beach Crete Greece',
    rating: 4.6,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/chania-beach-crete-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/chania-beach-crete-1/800/600',
      'https://picsum.photos/seed/chania-beach-crete-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Tắm biển cùng thú cưng',
        titleEn: 'Swim with your pet',
        descVi: 'Một số bãi biển quanh Chania cho phép chó xuống tắm cùng chủ, đặc biệt vào mùa thấp điểm.',
        descEn: 'Several beaches around Chania allow dogs to swim with their owners, especially in the off-season.',
      },
    ],
  },

  // ---------------- HÀN QUỐC ----------------
  {
    id: 'jeju-pet-resort',
    countryId: 'korea',
    name: 'Khu nghỉ dưỡng cùng thú cưng',
    categoryVi: 'Khu nghỉ dưỡng thân thiện với thú cưng',
    categoryEn: 'Pet-friendly resort',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Khu nghỉ dưỡng trên đảo Jeju với phòng nghỉ, hồ bơi và sân vườn riêng cho chó/mèo, phù hợp cho một chuyến đi thư giãn cùng thú cưng.',
    areaVi: 'Đảo Jeju, Hàn Quốc',
    areaEn: 'Jeju island, South Korea',
    howToGetVi: 'Bay từ Seoul đến sân bay quốc tế Jeju, sau đó di chuyển bằng taxi hoặc xe thuê đến khu nghỉ dưỡng.',
    howToGetEn: 'Fly from Seoul to Jeju International Airport, then take a taxi or rental car to the resort.',
    addressVi: 'Jeju, Hàn Quốc',
    addressEn: 'Jeju, South Korea',
    latitude: 33.4996,
    longitude: 126.5312,
    googleSearchKeyword: 'pet friendly resort Jeju Korea',
    rating: 4.7,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/jeju-pet-resort-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/jeju-pet-resort-1/800/600',
      'https://picsum.photos/seed/jeju-pet-resort-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Nghỉ dưỡng trọn gói cùng thú cưng',
        titleEn: 'A full pet-friendly getaway',
        descVi: 'Phòng nghỉ, sân chơi và cả thực đơn ăn uống đều được thiết kế để chó/mèo có thể đi cùng chủ suốt chuyến đi.',
        descEn: 'Rooms, play areas, and even dining menus are all designed so dogs and cats can join their owners for the whole trip.',
      },
    ],
  },
  {
    id: 'meerkat-friends-seoul',
    countryId: 'korea',
    name: 'Meerkat Friends',
    categoryVi: 'Quán cà phê thú cưng độc lạ',
    categoryEn: 'Exotic pet café',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Quán cà phê thú cưng độc đáo giữa lòng Seoul, nơi du khách có thể tương tác cùng chồn Meerkat và nhiều loài thú nhỏ đáng yêu khác.',
    areaVi: 'Trung tâm thành phố Seoul',
    areaEn: 'Central Seoul',
    howToGetVi: 'Di chuyển bằng tàu điện ngầm đến các khu vực trung tâm như Hongdae hoặc Myeongdong, sau đó đi bộ đến quán.',
    howToGetEn: 'Take the subway to central areas like Hongdae or Myeongdong, then walk to the café.',
    addressVi: 'Seoul, Hàn Quốc',
    addressEn: 'Seoul, South Korea',
    latitude: 37.5665,
    longitude: 126.9780,
    googleSearchKeyword: 'Meerkat Friends cafe Seoul',
    rating: 4.4,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/meerkat-friends-seoul-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/meerkat-friends-seoul-1/800/600',
      'https://picsum.photos/seed/meerkat-friends-seoul-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Vuốt ve chồn Meerkat',
        titleEn: 'Pet the meerkats',
        descVi: 'Trải nghiệm gần gũi và cho ăn những chú chồn Meerkat tinh nghịch ngay tại bàn cà phê.',
        descEn: 'Get up close and feed playful meerkats right at your café table.',
      },
    ],
  },
  {
    // ⚠️ Ghi chú: theo yêu cầu, địa điểm này được ghi là ở "Miyagi" — nhưng Miyagi thực chất là
    // một tỉnh của Nhật Bản, không thuộc Hàn Quốc. Toạ độ bên dưới tạm lấy theo đảo Baengnyeong
    // (Hàn Quốc) vì tên gọi gần giống nhất. Vui lòng xác nhận lại tên/địa danh chính xác trước khi
    // dùng dữ liệu này cho môi trường thật.
    id: 'baengnyeon-park',
    countryId: 'korea',
    name: 'Công viên Baengnyeon',
    categoryVi: 'Công viên dạo bộ cùng thú cưng',
    categoryEn: 'Pet-friendly walking park',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Không gian xanh mát lý tưởng để dắt thú cưng dạo bộ, hít thở không khí trong lành.',
    areaVi: 'Khu vực Miyagi',
    areaEn: 'Miyagi area',
    howToGetVi: 'Di chuyển bằng xe buýt hoặc taxi đến khu vực công viên.',
    howToGetEn: 'Take a bus or taxi to the park area.',
    addressVi: 'Miyagi, Hàn Quốc',
    addressEn: 'Miyagi, South Korea',
    latitude: 37.9556,
    longitude: 124.6764,
    googleSearchKeyword: 'Baengnyeong Park Korea',
    rating: 4.3,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/baengnyeon-park-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/baengnyeon-park-1/800/600',
      'https://picsum.photos/seed/baengnyeon-park-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Dạo bộ giữa thiên nhiên',
        titleEn: 'A walk surrounded by nature',
        descVi: 'Nhiều lối đi rợp bóng cây, phù hợp cho những buổi dạo bộ thư giãn cùng thú cưng.',
        descEn: 'Shaded walking paths make it a relaxing spot for a stroll with your pet.',
      },
    ],
  },

  // ---------------- ĐỨC ----------------
  {
    id: 'tierheim-berlin',
    countryId: 'germany',
    name: 'Trạm cứu hộ Tierheim',
    categoryVi: 'Trạm cứu hộ động vật',
    categoryEn: 'Animal rescue shelter',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Một trong những trạm cứu hộ động vật lớn nhất châu Âu, nơi bạn có thể ghé thăm, tình nguyện hoặc tìm hiểu về việc nhận nuôi thú cưng.',
    areaVi: 'Thành phố Berlin',
    areaEn: 'The city of Berlin',
    howToGetVi: 'Di chuyển bằng tàu điện ngầm hoặc xe buýt đến khu vực Falkenberg, phía Đông thành phố Berlin.',
    howToGetEn: 'Take the metro or bus to the Falkenberg area in eastern Berlin.',
    addressVi: 'Berlin, Đức',
    addressEn: 'Berlin, Germany',
    latitude: 52.5200,
    longitude: 13.4050,
    googleSearchKeyword: 'Tierheim Berlin animal shelter',
    rating: 4.6,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/tierheim-berlin-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/tierheim-berlin-1/800/600',
      'https://picsum.photos/seed/tierheim-berlin-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Tham quan & tình nguyện',
        titleEn: 'Visit & volunteer',
        descVi: 'Du khách yêu động vật có thể đăng ký tham quan hoặc tình nguyện chăm sóc thú cưng đang chờ được nhận nuôi.',
        descEn: 'Animal lovers can sign up for a tour or volunteer to care for pets waiting to be adopted.',
      },
    ],
  },
  {
    id: 'englischer-garten-munich',
    countryId: 'germany',
    name: 'Vườn Anh (Englischer Garten)',
    categoryVi: 'Công viên cây xanh giữa lòng thành phố',
    categoryEn: 'Urban green park',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Một trong những công viên đô thị lớn nhất thế giới, không gian lý tưởng để dắt thú cưng dạo bộ, chạy nhảy thoả thích.',
    areaVi: 'Thành phố Munich',
    areaEn: 'The city of Munich',
    howToGetVi: 'Di chuyển bằng tàu điện ngầm hoặc xe buýt đến khu trung tâm Munich, công viên nằm ngay gần khu phố cổ.',
    howToGetEn: 'Take the metro or bus to central Munich; the park sits right next to the old town.',
    addressVi: 'Munich, Bayern, Đức',
    addressEn: 'Munich, Bavaria, Germany',
    latitude: 48.1642,
    longitude: 11.6056,
    googleSearchKeyword: 'Englischer Garten Munich',
    rating: 4.8,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/englischer-garten-munich-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/englischer-garten-munich-1/800/600',
      'https://picsum.photos/seed/englischer-garten-munich-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Chạy nhảy thoả thích trên bãi cỏ rộng',
        titleEn: 'Run freely on wide open lawns',
        descVi: 'Nhiều khu vực trong công viên cho phép thú cưng chạy nhảy tự do mà không cần dây xích.',
        descEn: 'Many areas of the park allow pets to run off-leash freely.',
      },
    ],
  },
  {
    id: 'sylt-island',
    countryId: 'germany',
    name: 'Đảo Sylt',
    categoryVi: 'Đảo biển thân thiện với thú cưng',
    categoryEn: 'Pet-friendly seaside island',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Hòn đảo nổi tiếng ở miền Bắc nước Đức với những bãi biển cát trắng trải dài, nhiều khu vực cho phép chó chạy nhảy tự do.',
    areaVi: 'Bang Schleswig-Holstein',
    areaEn: 'Schleswig-Holstein state',
    howToGetVi: 'Di chuyển bằng tàu hoả (Sylt Shuttle) hoặc phà từ đất liền nước Đức đến đảo Sylt.',
    howToGetEn: 'Travel by train (Sylt Shuttle) or ferry from mainland Germany to Sylt island.',
    addressVi: 'Sylt, Schleswig-Holstein, Đức',
    addressEn: 'Sylt, Schleswig-Holstein, Germany',
    latitude: 54.9084,
    longitude: 8.3287,
    googleSearchKeyword: 'Sylt island Schleswig-Holstein Germany',
    rating: 4.7,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/sylt-island-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/sylt-island-1/800/600',
      'https://picsum.photos/seed/sylt-island-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Dạo biển không dây xích',
        titleEn: 'Off-leash beach walks',
        descVi: 'Một số bãi biển trên đảo Sylt cho phép chó chạy nhảy tự do mà không cần dây xích quanh năm.',
        descEn: 'Some beaches on Sylt allow dogs to run off-leash year-round.',
      },
    ],
  },

  // ---------------- THUỴ SỸ ----------------
  {
    id: 'sbb-scenic-train',
    countryId: 'switzerland',
    name: 'Tàu hoả ngắm cảnh SBB',
    categoryVi: 'Hành trình tàu hoả ngắm cảnh',
    categoryEn: 'Scenic train journey',
    statusTextVi: 'Đang hoạt động',
    statusTextEn: 'Operating',
    introText: 'Mạng lưới tàu hoả SBB nổi tiếng với những cung đường ngắm cảnh núi Alps tuyệt đẹp, cho phép thú cưng đi cùng chủ trên toàn bộ tuyến.',
    areaVi: 'Trải dài khắp Thuỵ Sỹ',
    areaEn: 'Throughout Switzerland',
    howToGetVi: 'Mua vé tàu SBB tại các nhà ga trên khắp Thuỵ Sỹ hoặc qua ứng dụng SBB Mobile.',
    howToGetEn: 'Buy SBB train tickets at stations across Switzerland or via the SBB Mobile app.',
    addressVi: 'Khắp Thuỵ Sỹ',
    addressEn: 'Across Switzerland',
    latitude: 46.8182,
    longitude: 8.2275,
    googleSearchKeyword: 'SBB scenic train Switzerland',
    rating: 4.9,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/sbb-scenic-train-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/sbb-scenic-train-1/800/600',
      'https://picsum.photos/seed/sbb-scenic-train-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Ngắm dãy Alps qua khung cửa sổ',
        titleEn: 'Admire the Alps through the window',
        descVi: 'Thú cưng nhỏ được phép lên toa cùng chủ (có vé riêng), tận hưởng khung cảnh núi non hùng vĩ suốt hành trình.',
        descEn: 'Small pets are allowed on board with their owner (with a separate ticket), enjoying majestic mountain views throughout the journey.',
      },
    ],
  },
  {
    id: 'zermatt-village',
    countryId: 'switzerland',
    name: 'Làng Zermatt',
    categoryVi: 'Làng núi thân thiện với thú cưng',
    categoryEn: 'Pet-friendly mountain village',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Ngôi làng nhỏ dưới chân đỉnh Matterhorn nổi tiếng, không có xe hơi lưu thông, rất phù hợp để dạo bộ cùng thú cưng.',
    areaVi: 'Bang Valais',
    areaEn: 'Valais canton',
    howToGetVi: 'Di chuyển bằng tàu hoả đến Zermatt (khu vực không cho phép xe hơi cá nhân lưu thông).',
    howToGetEn: 'Travel by train to Zermatt (a car-free village).',
    addressVi: 'Zermatt, Valais, Thuỵ Sỹ',
    addressEn: 'Zermatt, Valais, Switzerland',
    latitude: 46.0207,
    longitude: 7.7491,
    googleSearchKeyword: 'Zermatt village Valais Switzerland',
    rating: 4.9,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/zermatt-village-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/zermatt-village-1/800/600',
      'https://picsum.photos/seed/zermatt-village-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Dạo bộ ngắm đỉnh Matterhorn',
        titleEn: 'Walk with views of the Matterhorn',
        descVi: 'Những con phố không xe hơi giúp việc dắt thú cưng dạo bộ an toàn và thư thái hơn hẳn.',
        descEn: 'Car-free streets make walking with your pet safer and far more relaxing.',
      },
    ],
  },
  {
    id: 'sigriswil-panorama-bridge',
    countryId: 'switzerland',
    name: 'Cầu treo Panorama Sigriswil',
    categoryVi: 'Cầu treo ngắm cảnh',
    categoryEn: 'Scenic suspension bridge',
    statusTextVi: 'Đang mở',
    statusTextEn: 'Open',
    introText: 'Cây cầu treo dành cho người đi bộ với tầm nhìn ngoạn mục ra dãy Alps và hồ Thun, có thể dắt thú cưng đi cùng qua cầu.',
    areaVi: 'Vùng Sigriswil, bang Bern',
    areaEn: 'Sigriswil, canton of Bern',
    howToGetVi: 'Di chuyển bằng xe buýt hoặc ô tô từ thành phố Thun đến làng Sigriswil.',
    howToGetEn: 'Take a bus or drive from the town of Thun to Sigriswil village.',
    addressVi: 'Sigriswil, Bern, Thuỵ Sỹ',
    addressEn: 'Sigriswil, Bern, Switzerland',
    latitude: 46.6939,
    longitude: 7.7357,
    googleSearchKeyword: 'Sigriswil Panorama Bridge Bern Switzerland',
    rating: 4.7,
    reviewsCount: 0,
    heroImage: 'https://picsum.photos/seed/sigriswil-panorama-bridge-1/1000/700',
    galleryImages: [
      'https://picsum.photos/seed/sigriswil-panorama-bridge-1/800/600',
      'https://picsum.photos/seed/sigriswil-panorama-bridge-2/800/600',
    ],
    experiences: [
      {
        titleVi: 'Băng qua cầu treo cùng thú cưng',
        titleEn: 'Cross the suspension bridge with your pet',
        descVi: 'Chó có thể đi cùng chủ qua cầu (nên có dây xích), phóng tầm mắt ra toàn cảnh hồ Thun và dãy Alps.',
        descEn: 'Dogs can accompany their owners across the bridge (leash recommended), taking in panoramic views of Lake Thun and the Alps.',
      },
    ],
  },
];

// =========================================================================
// 7. REVIEW MẪU CHO TỪNG ĐỊA ĐIỂM
// =========================================================================
const PARADISE_REVIEWS: ParadiseReviewSeedItem[] = [
  // ---- Tashirojima (giữ nguyên 2 review gốc) ----
  {
    id: 'rev_tashiro_01',
    paradiseId: 'tashirojima-island',
    authorName: 'Julie Nguyễn',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    rating: 5,
    dateText: '12 ngày trước',
    content: 'Trải nghiệm tuyệt vời tại đảo Tashirojima! Mèo ở khắp mọi nơi từ bến cảng đến các con dốc nhỏ.',
    images: ['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=500&auto=format&fit=crop'],
    isFromGoogle: false,
    huuichCount: 5,
    camonCount: 3,
    huhuCount: 0,
  },
  {
    id: 'rev_tashiro_02',
    paradiseId: 'tashirojima-island',
    googleReviewId: 'google_rev_1710002100_kenji',
    authorName: 'Kenji Sato (Google Review)',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
    rating: 5,
    dateText: '3 tuần trước',
    content: 'A peaceful paradise for cat lovers! The ferry ride from Ishinomaki was smooth and took around 40 minutes.',
    images: [],
    isFromGoogle: true,
    huuichCount: 12,
    camonCount: 8,
    huhuCount: 1,
  },

  // ---- Trung Quốc ----
  {
    id: 'rev_mooncat_01',
    paradiseId: 'moon-cat-city-guangzhou',
    authorName: 'Vy Trần',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_mooncat_01',
    rating: 5,
    dateText: '5 ngày trước',
    content: 'Không gian cực kỳ đáng yêu, mọi góc đều có thể chụp ảnh cùng các bé mèo dễ thương. Đi cùng bé mèo nhà mình mà bé cũng thích mê!',
    images: [],
    isFromGoogle: false,
    huuichCount: 4,
    camonCount: 2,
    huhuCount: 0,
  },
  {
    id: 'rev_bailian_01',
    paradiseId: 'bailian-xijiao-shanghai',
    authorName: 'Minh Đức',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_bailian_01',
    rating: 4,
    dateText: '2 tuần trước',
    content: 'Trung tâm thương mại rộng rãi, sạch sẽ, có khu riêng cho thú cưng nghỉ ngơi. Chỉ hơi đông vào cuối tuần.',
    images: [],
    isFromGoogle: false,
    huuichCount: 3,
    camonCount: 1,
    huhuCount: 0,
  },
  {
    id: 'rev_shiquan_01',
    paradiseId: 'shiquan-street-jiangsu',
    authorName: 'Hải Yến',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_shiquan_01',
    rating: 5,
    dateText: '1 tháng trước',
    content: 'Phố cổ rất đẹp, đi dạo cùng cún cưng buổi tối cực kỳ thư giãn, nhiều quán trà sữa xinh xắn.',
    images: [],
    isFromGoogle: false,
    huuichCount: 6,
    camonCount: 2,
    huhuCount: 0,
  },

  // ---- Pháp ----
  {
    id: 'rev_amneville_01',
    paradiseId: 'amneville-aquarium',
    authorName: 'Quang Anh',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_amneville_01',
    rating: 5,
    dateText: '3 tuần trước',
    content: 'Thuỷ cung rất hoành tráng, các bé nhỏ mê tít khu đường hầm cá mập. Nên đặt vé trước vào mùa cao điểm.',
    images: [],
    isFromGoogle: false,
    huuichCount: 5,
    camonCount: 2,
    huhuCount: 0,
  },
  {
    id: 'rev_nice_01',
    paradiseId: 'nice-seaside-city',
    authorName: 'Thảo Ngân',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_nice_01',
    rating: 5,
    dateText: '10 ngày trước',
    content: 'Bờ biển Nice tuyệt đẹp, dắt chó đi dạo buổi sáng cực kỳ thích, nhiều quán cà phê ven biển cũng đón thú cưng.',
    images: [],
    isFromGoogle: false,
    huuichCount: 7,
    camonCount: 3,
    huhuCount: 0,
  },
  {
    id: 'rev_royalgarden_01',
    paradiseId: 'royal-garden-paris',
    authorName: 'Bảo Châu',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_royalgarden_01',
    rating: 4,
    dateText: '1 tuần trước',
    content: 'Khu vườn rất yên bình giữa lòng Paris, chỉ tiếc là phải giữ dây xích xuyên suốt vì đông khách du lịch.',
    images: [],
    isFromGoogle: false,
    huuichCount: 3,
    camonCount: 1,
    huhuCount: 0,
  },

  // ---- Hy Lạp ----
  {
    id: 'rev_mykonos_01',
    paradiseId: 'mykonos-cat-island',
    authorName: 'Lan Phương',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_mykonos_01',
    rating: 5,
    dateText: '2 tuần trước',
    content: 'Mèo ở Mykonos siêu thân thiện, cứ ngồi quán cà phê là có bé mèo tới nằm cạnh xin vuốt ve.',
    images: [],
    isFromGoogle: false,
    huuichCount: 8,
    camonCount: 4,
    huhuCount: 0,
  },
  {
    id: 'rev_santorini_01',
    paradiseId: 'santorini-cat-island',
    authorName: 'Gia Huy',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_santorini_01',
    rating: 5,
    dateText: '4 ngày trước',
    content: 'Ngắm hoàng hôn Oia mà có mèo nằm cạnh sưởi nắng, cảm giác chill không tả nổi.',
    images: [],
    isFromGoogle: false,
    huuichCount: 9,
    camonCount: 5,
    huhuCount: 0,
  },
  {
    id: 'rev_chania_01',
    paradiseId: 'chania-beach-crete',
    authorName: 'Kim Ngân',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_chania_01',
    rating: 4,
    dateText: '3 tuần trước',
    content: 'Bãi biển sạch đẹp, chó nhà mình được tắm biển thoả thích, nước trong xanh cực kỳ.',
    images: [],
    isFromGoogle: false,
    huuichCount: 4,
    camonCount: 2,
    huhuCount: 0,
  },

  // ---- Hàn Quốc ----
  {
    id: 'rev_jejuresort_01',
    paradiseId: 'jeju-pet-resort',
    authorName: 'Đình Phong',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_jejuresort_01',
    rating: 5,
    dateText: '1 tháng trước',
    content: 'Khu nghỉ dưỡng chăm chút từng chi tiết cho thú cưng, từ menu ăn uống đến sân chơi riêng, rất đáng tiền.',
    images: [],
    isFromGoogle: false,
    huuichCount: 6,
    camonCount: 3,
    huhuCount: 0,
  },
  {
    id: 'rev_meerkat_01',
    paradiseId: 'meerkat-friends-seoul',
    authorName: 'Thu Trang',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_meerkat_01',
    rating: 5,
    dateText: '6 ngày trước',
    content: 'Lần đầu được vuốt ve chồn Meerkat, mấy bé siêu tinh nghịch và dễ thương, trải nghiệm cực kỳ mới lạ.',
    images: [],
    isFromGoogle: false,
    huuichCount: 5,
    camonCount: 2,
    huhuCount: 0,
  },
  {
    id: 'rev_baengnyeon_01',
    paradiseId: 'baengnyeon-park',
    authorName: 'Hoàng Nam',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_baengnyeon_01',
    rating: 4,
    dateText: '2 tuần trước',
    content: 'Công viên rộng rãi, nhiều bóng cây, thích hợp dắt thú cưng đi dạo buổi chiều.',
    images: [],
    isFromGoogle: false,
    huuichCount: 2,
    camonCount: 1,
    huhuCount: 0,
  },

  // ---- Đức ----
  {
    id: 'rev_tierheim_01',
    paradiseId: 'tierheim-berlin',
    authorName: 'Ngọc Diễm',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_tierheim_01',
    rating: 5,
    dateText: '3 tuần trước',
    content: 'Rất xúc động khi tham quan trạm cứu hộ, các bạn tình nguyện viên nhiệt tình và yêu động vật thật sự.',
    images: [],
    isFromGoogle: false,
    huuichCount: 7,
    camonCount: 4,
    huhuCount: 0,
  },
  {
    id: 'rev_englischer_01',
    paradiseId: 'englischer-garten-munich',
    authorName: 'Anh Tuấn',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_englischer_01',
    rating: 5,
    dateText: '10 ngày trước',
    content: 'Công viên rộng mênh mông, cún nhà mình được chạy nhảy thả ga không cần xích, quá đã!',
    images: [],
    isFromGoogle: false,
    huuichCount: 6,
    camonCount: 3,
    huhuCount: 0,
  },
  {
    id: 'rev_sylt_01',
    paradiseId: 'sylt-island',
    authorName: 'Phương Anh',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_sylt_01',
    rating: 5,
    dateText: '1 tuần trước',
    content: 'Bãi biển cát trắng mịn, chó được chạy tự do không cần dây xích, không khí trong lành cực kỳ dễ chịu.',
    images: [],
    isFromGoogle: false,
    huuichCount: 5,
    camonCount: 2,
    huhuCount: 0,
  },

  // ---- Thuỵ Sỹ ----
  {
    id: 'rev_sbb_01',
    paradiseId: 'sbb-scenic-train',
    authorName: 'Tùng Lâm',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_sbb_01',
    rating: 5,
    dateText: '5 ngày trước',
    content: 'Ngồi tàu ngắm dãy Alps mà có bé cún bên cạnh thì còn gì bằng, hành trình quá đáng nhớ.',
    images: [],
    isFromGoogle: false,
    huuichCount: 8,
    camonCount: 3,
    huhuCount: 0,
  },
  {
    id: 'rev_zermatt_01',
    paradiseId: 'zermatt-village',
    authorName: 'Mỹ Linh',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_zermatt_01',
    rating: 5,
    dateText: '2 tuần trước',
    content: 'Làng không có xe hơi nên dắt chó đi dạo an toàn tuyệt đối, view đỉnh Matterhorn đẹp không góc nào chê được.',
    images: [],
    isFromGoogle: false,
    huuichCount: 9,
    camonCount: 4,
    huhuCount: 0,
  },
  {
    id: 'rev_sigriswil_01',
    paradiseId: 'sigriswil-panorama-bridge',
    authorName: 'Đăng Khoa',
    authorAvatar: 'https://i.pravatar.cc/150?u=rev_sigriswil_01',
    rating: 4,
    dateText: '3 tuần trước',
    content: 'Cầu hơi rung nhẹ khi đi qua nên cún nhà mình hơi sợ lúc đầu, nhưng view thì miễn chê, đáng thử một lần.',
    images: [],
    isFromGoogle: false,
    huuichCount: 4,
    camonCount: 2,
    huhuCount: 0,
  },
];

// =========================================================================
// 8. HÀM & HẰNG SỐ HỖ TRỢ ĐỒNG BỘ GOOGLE (giữ nguyên logic từ sync-google-reviews.ts)
// =========================================================================

// Chuyển đổi mã giờ của Google (vd: "2200" -> "10:00 PM", "0900" -> "09:00 AM")
function formatTime12h(timeStr: string): string {
  if (!timeStr || timeStr.length < 4) return timeStr;
  const h = parseInt(timeStr.slice(0, 2), 10);
  const m = timeStr.slice(2);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const hFormatted = h12 < 10 ? `0${h12}` : `${h12}`;
  return `${hFormatted}:${m} ${period}`;
}

// Tính toán chuỗi trạng thái hoạt động chuẩn Google Maps
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
    const nextPeriod = periods.find((p: any) => p.open?.day === currentDay && parseInt(p.open.time, 10) > now.getHours() * 100)
      || periods.find((p: any) => p.open?.day === (currentDay + 1) % 7);

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

// Lấy URL ảnh trực tiếp từ Google CDN
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

// Map countryId -> tên tiếng Anh, dùng làm fallback khi tìm kiếm trên Google Maps
const countryNameEnById: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c.nameEn])
);

// Map paradiseId -> từ khoá tìm kiếm Google Maps (lấy trực tiếp từ PARADISE_LOCATIONS)
const GOOGLE_MAPS_TARGET_KEYWORDS: Record<string, string> = Object.fromEntries(
  PARADISE_LOCATIONS.map((p) => [p.id, p.googleSearchKeyword])
);

// =========================================================================
// 9. SEED: QUỐC GIA + QUY TRÌNH NHẬP CẢNH + TÀI LIỆU
// =========================================================================
export async function seedProcedures() {
  console.log('🔄 Bắt đầu dọn dẹp và nạp dữ liệu Entry Procedures & Documents...');

  await prisma.procedureDocument.deleteMany({});
  await prisma.procedureStep.deleteMany({});
  await prisma.procedureMilestone.deleteMany({});

  for (const c of COUNTRIES) {
    await prisma.countryProcedure.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    });
  }
  console.log(`✅ Đã seed ${COUNTRIES.length} quốc gia.`);

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

  for (const doc of ALL_PROCEDURE_DOCUMENTS) {
    await prisma.procedureDocument.create({
      data: doc,
    });
  }
  console.log(`✅ Đã seed ${ALL_PROCEDURE_DOCUMENTS.length} biểu mẫu & tài liệu hướng dẫn kiểm dịch.`);
}

// =========================================================================
// 10. SEED: ĐỊA ĐIỂM PET PARADISE + REVIEW MẪU (liên kết theo countryId)
// =========================================================================
export async function seedParadisesAndReviews() {
  console.log('🔄 Bắt đầu nạp dữ liệu địa điểm Pet Paradise...');

  for (const p of PARADISE_LOCATIONS) {
    // Bỏ googleSearchKeyword ra khỏi payload vì đây không phải field trong DB,
    // chỉ dùng nội bộ cho bước đồng bộ Google bên dưới.
    const { googleSearchKeyword, ...paradiseData } = p;
    await prisma.petParadise.upsert({
      where: { id: p.id },
      update: paradiseData,
      create: paradiseData,
    });
  }
  console.log(`✅ Đã seed ${PARADISE_LOCATIONS.length} địa điểm Pet Paradise trên ${COUNTRIES.length} quốc gia.`);

  console.log('🔄 Bắt đầu nạp dữ liệu review mẫu cho từng địa điểm...');
  for (const r of PARADISE_REVIEWS) {
    await prisma.petParadiseReview.upsert({
      where: { id: r.id },
      update: r,
      create: r,
    });
  }
  console.log(`✅ Đã seed ${PARADISE_REVIEWS.length} review mẫu.`);
}

// =========================================================================
// 11. (TUỲ CHỌN) ĐỒNG BỘ ẢNH & REVIEW THẬT TỪ GOOGLE MAPS
//     — chỉ chạy khi có GOOGLE_MAPS_API_KEY, nếu không sẽ tự bỏ qua (không exit(1)
//       như bản gốc, vì giờ chỉ là 1 bước tuỳ chọn trong pipeline seed tổng).
// =========================================================================
export async function syncGoogleReviewsAndPhotos() {
  console.log('================================================================');
  console.log('🚀 ĐỒNG BỘ GOOGLE REVIEWS, ALBUM ẢNH & GIỜ HOẠT ĐỘNG THỰC TẾ');
  console.log('================================================================\n');

  if (!GOOGLE_API_KEY) {
    console.warn('⚠️ Bỏ qua bước đồng bộ Google: chưa cấu hình GOOGLE_MAPS_API_KEY trong file .env.\n');
    return;
  }

  const paradises = await prisma.petParadise.findMany({});

  for (const p of paradises) {
    console.log(`----------------------------------------------------------------`);
    console.log(`📍 Đang xử lý địa điểm [ID: ${p.id}]: "${p.name}"`);

    const standardKeyword =
      GOOGLE_MAPS_TARGET_KEYWORDS[p.id] || `${p.name} ${countryNameEnById[p.countryId] || ''}`.trim();
    let activePlaceId = p.googlePlaceId;

    if (!activePlaceId) {
      activePlaceId = await findFreshPlaceId(standardKeyword, GOOGLE_API_KEY);
      if (activePlaceId) {
        await prisma.petParadise.update({
          where: { id: p.id },
          data: { googlePlaceId: activePlaceId },
        });
      }
    }

    if (!activePlaceId) {
      console.warn(`⏭️ Bỏ qua "${p.name}" do không tìm thấy Place ID.\n`);
      continue;
    }

    console.log(`🌐 Gọi Google Places Details API (kèm photos & opening_hours)...`);
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${activePlaceId}&fields=name,reviews,rating,user_ratings_total,photos,opening_hours,current_opening_hours&language=vi&key=${GOOGLE_API_KEY}`;
    let res = await axios.get(detailsUrl);

    if (res.data?.status === 'NOT_FOUND') {
      const freshPlaceId = await findFreshPlaceId(standardKeyword, GOOGLE_API_KEY);
      if (freshPlaceId) {
        activePlaceId = freshPlaceId;
        await prisma.petParadise.update({ where: { id: p.id }, data: { googlePlaceId: freshPlaceId } });
        res = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${freshPlaceId}&fields=name,reviews,rating,user_ratings_total,photos,opening_hours,current_opening_hours&language=vi&key=${GOOGLE_API_KEY}`);
      }
    }

    if (res.data?.status !== 'OK') {
      console.error(`❌ Google API từ chối. Lỗi: ${res.data?.error_message || res.data?.status}`);
      continue;
    }

    const result = res.data?.result;
    const rawPhotos = result?.photos || [];
    const reviews = result?.reviews || [];
    const rating = result?.rating || p.rating;
    const userRatingsTotal = result?.user_ratings_total || p.reviewsCount;

    const openingStatus = calculateOpeningStatus(result?.current_opening_hours || result?.opening_hours);
    console.log(`⏰ [Giờ hoạt động]: ${openingStatus.vi}`);

    console.log(`📸 Đang xử lý ${rawPhotos.length} ảnh gốc từ Google Maps...`);
    const googlePhotoUrls: string[] = [];

    for (let idx = 0; idx < Math.min(rawPhotos.length, 10); idx++) {
      const directUrl = await getDirectGooglePhotoUrl(rawPhotos[idx].photo_reference, GOOGLE_API_KEY);
      googlePhotoUrls.push(directUrl);
    }

    console.log(`✅ Đã lấy được ${googlePhotoUrls.length} ảnh chất lượng cao từ Google.`);

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

    if (googlePhotoUrls.length > 0) {
      console.log(`🖼️ [Avatar Mới]: ${googlePhotoUrls[0].slice(0, 60)}...`);
      console.log(`📁 [Album]: Đã nạp ${googlePhotoUrls.length} ảnh vào galleryImages của "${p.name}".`);
    }

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

    console.log(`💬 Đã đồng bộ ${reviews.length} review Google của "${p.name}".\n`);
  }

  console.log('🎉 ĐỒNG BỘ ẢNH, GIỜ MỞ CỬA & REVIEW GOOGLE HOÀN TẤT!');
}

// =========================================================================
// 12. THỰC THI SEED (chạy trực tiếp file này bằng ts-node/tsx)
// =========================================================================
async function main() {
  await seedProcedures();
  await seedParadisesAndReviews();
  await syncGoogleReviewsAndPhotos(); // tự bỏ qua nếu chưa cấu hình GOOGLE_MAPS_API_KEY

  console.log('\n🎉 HOÀN TẤT TOÀN BỘ SEED: quốc gia, quy trình, tài liệu, địa điểm Pet Paradise & review!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi trong quá trình seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });