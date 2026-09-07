// src/database/prisma/seed-procedures.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =========================================================================
// 1. TYPESAFE INTERFACES (KHẮC PHỤC LỖI TS2339)
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

// =========================================================================
// 2. CÁC ĐOẠN VĂN BẢN & BƯỚC MẪU CHUẨN XÁC
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

// =========================================================================
// 4. TOÀN BỘ MILESTONES CỦA 10 NƯỚC
// =========================================================================
const ALL_COUNTRY_MILESTONES: Record<string, MilestoneItem[]> = {
    // 1. NHẬT BẢN
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

    // 2. TRUNG QUỐC
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

    // 3. VIỆT NAM
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

    // 4. PHÁP
    france: [
        { dateLabel: 'Ngày 0', sortOrder: 1, steps: [STEP_MICROCHIP_STANDARD, STEP_RABIES_1_STANDARD, STEP_FLIGHT_BOOKING] },
        { dateLabel: 'Ngày 30', sortOrder: 2, steps: [STEP_RABIES_2_STANDARD, STEP_RABIES_TEST_EU] },
        { dateLabel: 'Ngày 31 - 121', sortOrder: 3, steps: [STEP_EU_LOCK] },
        { dateLabel: 'Ngày 122 - 125', sortOrder: 4, steps: [STEP_HEALTH_CERT_STANDARD, STEP_EXPORT_REG, STEP_FLIGHT_CONFIRM] },
        { dateLabel: 'Ngày 125 - 129', sortOrder: 5, steps: [STEP_EXPORT_CERT_30D] },
        { dateLabel: 'Ngày 130: Nhập cảnh Pháp', sortOrder: 6, steps: [createCustomsStep('Pháp')] },
    ],

    // 5. Ý (ITALY)
    italy: [
        { dateLabel: 'Ngày 0', sortOrder: 1, steps: [STEP_MICROCHIP_STANDARD, STEP_RABIES_1_STANDARD, STEP_FLIGHT_BOOKING] },
        { dateLabel: 'Ngày 30', sortOrder: 2, steps: [STEP_RABIES_2_STANDARD, STEP_RABIES_TEST_EU] },
        { dateLabel: 'Ngày 31 - 121', sortOrder: 3, steps: [STEP_EU_LOCK] },
        { dateLabel: 'Ngày 122 - 125', sortOrder: 4, steps: [STEP_HEALTH_CERT_STANDARD, STEP_EXPORT_REG, STEP_FLIGHT_CONFIRM] },
        { dateLabel: 'Ngày 125 - 129', sortOrder: 5, steps: [STEP_EXPORT_CERT_30D] },
        { dateLabel: 'Ngày 130: Nhập cảnh Ý', sortOrder: 6, steps: [createCustomsStep('Ý')] },
    ],

    // 6. AI CẬP
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

    // 7. HY LẠP
    greece: [
        { dateLabel: 'Ngày 0', sortOrder: 1, steps: [STEP_MICROCHIP_STANDARD, STEP_RABIES_1_STANDARD, STEP_FLIGHT_BOOKING] },
        { dateLabel: 'Ngày 30', sortOrder: 2, steps: [STEP_RABIES_2_STANDARD, STEP_RABIES_TEST_EU] },
        { dateLabel: 'Ngày 31 - 121', sortOrder: 3, steps: [STEP_EU_LOCK] },
        { dateLabel: 'Ngày 122 - 125', sortOrder: 4, steps: [STEP_HEALTH_CERT_STANDARD, STEP_EXPORT_REG, STEP_FLIGHT_CONFIRM] },
        { dateLabel: 'Ngày 125 - 129', sortOrder: 5, steps: [STEP_EXPORT_CERT_30D] },
        { dateLabel: 'Ngày 130: Nhập cảnh Hy Lạp', sortOrder: 6, steps: [createCustomsStep('Hy Lạp')] },
    ],

    // 8. HÀN QUỐC
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

    // 9. ĐỨC
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

    // 10. THỤY SỸ
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
// 5. SEED EXECUTION
// =========================================================================
export async function seedProcedures() {
    console.log('🔄 Bắt đầu dọn dẹp và nạp dữ liệu Entry Procedures & Milestones...');

    // Dọn dẹp dữ liệu cũ để tránh trùng lặp
    await prisma.procedureStep.deleteMany({});
    await prisma.procedureMilestone.deleteMany({});
    await prisma.procedureDocument.deleteMany({});

    // 1. Seed 10 Quốc Gia
    for (const c of COUNTRIES) {
        await prisma.countryProcedure.upsert({
            where: { id: c.id },
            update: c,
            create: c,
        });
    }
    console.log(`✅ Đã seed ${COUNTRIES.length} quốc gia.`);

    // 2. Seed Milestones & Steps cho toàn bộ 10 quốc gia
    let totalMilestones = 0;
    let totalSteps = 0;

    for (const [countryId, milestones] of Object.entries(ALL_COUNTRY_MILESTONES)) {
        for (const m of milestones) {
            totalMilestones++;
            const createdMilestone = await prisma.procedureMilestone.create({
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
                                notes: s.notes ? s.notes : [], // ✨ Fix TS2339 an toàn tuyệt đối
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

    // 3. Seed Pet Paradise mẫu
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
    // Danh sách các thiên đường thú cưng cố định do bạn quản lý
    const FIXED_PET_PARADISES = [
        {
            id: '1',
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
            googlePlaceId: 'ChIJVXk4F3bZgzURaU1x9Xw5o-g', // Place ID thực tế của Tashirojima
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
                    descVi: 'Số lượng mèo ở đây lớn hơn rất nhiều so với người dân, được xem là biểu tượng may mắn.',
                    descEn: 'The cat population far outnumbers local residents and is regarded as a symbol of good luck.',
                },
                {
                    titleVi: 'Đền mèo Tashirojima (Nekojinja)',
                    titleEn: 'Tashirojima Cat Shrine',
                    descVi: 'Ngôi miếu nhỏ linh thiêng nằm giữa đảo được lập ra để tưởng niệm một chú mèo thời xưa.',
                    descEn: 'A sacred small shrine situated in the center of the island dedicated to a cat.',
                }
            ],
        },
        {
            id: '2',
            countryId: 'japan',
            name: 'Đảo Okunoshima (Đảo Thỏ)',
            categoryVi: 'Đảo nhỏ ngoài khơi',
            categoryEn: 'Small offshore island',
            statusTextVi: 'Đang mở',
            statusTextEn: 'Opening',
            introText: 'Hòn đảo nổi tiếng thế giới với hàng trăm chú thỏ hoang dã vô cùng thân thiện với con người.',
            areaVi: 'Chu vi khoảng 4.3 km',
            areaEn: 'Circumference around 4.3 km',
            howToGetVi: 'Đi phà khoảng 15 phút từ Cảng Tadanoumi (Thành phố Takehara).',
            howToGetEn: 'Take a 15-minute ferry from Tadanoumi Port (Takehara City).',
            addressVi: 'Takehara, Hiroshima, Nhật Bản',
            addressEn: 'Takehara, Hiroshima, Japan',
            latitude: 34.3094,
            longitude: 132.9934,
            googlePlaceId: 'ChIJz2Qy7YvAVjURo2iK_0V2kLg', // Place ID của đảo Okunoshima
            rating: 4.7,
            reviewsCount: 245,
            heroImage: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=1000&auto=format&fit=crop',
            galleryImages: [
                'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=800&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?q=80&w=800&auto=format&fit=crop',
            ],
            experiences: [
                {
                    titleVi: 'Tương tác cùng thỏ hoang dã',
                    titleEn: 'Interact with wild rabbits',
                    descVi: 'Hàng trăm chú thỏ tự do chạy nhảy khắp đảo và sẵn sàng nhận thức ăn từ du khách.',
                    descEn: 'Hundreds of rabbits roam freely around the island and happily accept food from visitors.',
                }
            ],
        },
        {
            id: '3',
            countryId: 'japan',
            name: 'Làng cáo Zao (Zao Fox Village)',
            categoryVi: 'Khu bảo tồn động vật',
            categoryEn: 'Wildlife sanctuary',
            statusTextVi: 'Đang mở',
            statusTextEn: 'Opening',
            introText: 'Khu bảo tồn thiên nhiên độc đáo nơi sinh sống của hơn 100 cá thể cáo thuộc nhiều loài quý hiếm.',
            areaVi: 'Khuôn viên rộng lớn giữa rừng thông',
            areaEn: 'Spacious campus amidst the pine forest',
            howToGetVi: 'Đi taxi khoảng 20-30 phút từ ga Shiroishi-Zao.',
            howToGetEn: 'Take a 20-30 minute taxi ride from Shiroishi-Zao Station.',
            addressVi: 'Shiroishi, Miyagi, Nhật Bản',
            addressEn: 'Shiroishi, Miyagi, Japan',
            latitude: 38.0408,
            longitude: 140.5284,
            googlePlaceId: 'ChIJX9P3sD7gg18RqE6i34E3JkY', // Place ID của Làng Cáo Zao
            rating: 4.6,
            reviewsCount: 520,
            heroImage: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?q=80&w=1000&auto=format&fit=crop',
            galleryImages: [
                'https://images.unsplash.com/photo-1516934024742-b461fba47600?q=80&w=800&auto=format&fit=crop',
            ],
            experiences: [
                {
                    titleVi: 'Quan sát tập tính của loài cáo',
                    titleEn: 'Observe fox behaviors',
                    descVi: 'Chiêm ngưỡng 6 loài cáo khác nhau sinh sống trong môi trường bán tự nhiên.',
                    descEn: 'Admire 6 different fox species living in a semi-natural habitat.',
                }
            ],
        },
    ];

    // Vòng lặp seed danh sách này
    for (const p of FIXED_PET_PARADISES) {
        await prisma.petParadise.upsert({
            where: { id: p.id },
            update: p,
            create: p,
        });
    }
    console.log('🎉 Hoàn tất seed toàn bộ dữ liệu Procedures & Pet Paradise!');
}

seedProcedures()
    .catch((e) => {
        console.error('❌ Lỗi trong quá trình seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });