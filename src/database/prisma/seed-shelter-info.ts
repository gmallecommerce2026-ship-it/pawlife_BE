import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load biến môi trường từ file .env
dotenv.config();

const prisma = new PrismaClient();

// Thiết lập R2 Client giống hệt r2.service.ts của bạn
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

// Hàm hỗ trợ đọc file local và đẩy lên R2
async function uploadLocalFileToR2(fileName: string, contentType: string) {
  const filePath = path.join(process.cwd(), 'prisma', 'data', 'images', fileName); // Trỏ tới prisma/data/images/

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Không tìm thấy file: ${filePath}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(filePath);

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName, // Lưu trên R2 với tên gốc
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    console.log(`✅ Đã upload ${fileName} lên Cloudflare R2`);

    return `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;
  } catch (error) {
    console.error(`❌ Lỗi upload ${fileName} lên R2:`, error);
    return null;
  }
}

// ============================================================
// DỮ LIỆU SEED — SONG NGỮ VI / EN
// ⚠️ NOTE: field name (titleVi/titleEn, ...) là GIẢ ĐỊNH theo
// pattern phổ biến. Hãy đối chiếu với prisma/schema.prisma thật
// của bạn (model Event / Organizer / EventGallery) và đổi tên
// field cho khớp trước khi chạy script này.
// ============================================================

interface EventSeedData {
  titleVi: string;
  titleEn: string;
  tagVi: string;
  tagEn: string;
  locationShortVi: string;
  locationShortEn: string;
  locationFullVi: string;
  locationFullEn: string;
  timeVi: string;
  timeEn: string;
  descriptionVi: string;
  descriptionEn: string;
  organizerName: string;
  heroImageFileName: string;
  organizerAvatarFileName: string;
}

const eventsData: EventSeedData[] = [
  // ---------------- SỰ KIỆN 1 ----------------
  {
    titleVi: 'Triển lãm & lễ hội thú cưng Interpetfest',
    titleEn: 'InterPetFest – Pet Exhibition & Festival',
    tagVi: 'Mùa lễ hội',
    tagEn: 'Festival Season',
    locationShortVi: 'NECC, Phường Từ Liêm, Hà Nội',
    locationShortEn: 'NECC, Tu Liem Ward, Hanoi',
    locationFullVi:
      'National Exhibition Construction Center (NECC) - 1 phố Đỗ Đức Dục, phường Từ Liêm, Hà Nội',
    locationFullEn:
      'National Exhibition Construction Center (NECC) - 1 Do Duc Duc Street, Tu Liem Ward, Hanoi',
    timeVi:
      '17/04/2026 lúc 9:30AM - 5:30PM\n18-19/04/2026 lúc 9:30AM - 6:30PM',
    timeEn:
      'April 17, 2026, 9:30AM - 5:30PM\nApril 18-19, 2026, 9:30AM - 6:30PM',
    descriptionVi: `A. HÀNH TRÌNH TOÀN CẦU
Ban tổ chức InterPetFest thành lập các đoàn khách tham quan thương mại và đơn vị triển lãm Việt Nam để tham dự các sự kiện thú cưng uy tín trên khắp thế giới. Quảng bá gian hàng InterPetFest 2026 tại các triển lãm thú cưng quốc tế lớn trên toàn cầu. Ban tổ chức InterPetFest đến tham quan các sự kiện thú cưng tại những quốc gia phát triển. Chúng tôi luôn mong muốn tiếp thu những ý tưởng mới, công nghệ mới để áp dụng cho kỳ InterPetFest 2026, đồng thời mở rộng mạng lưới quốc tế nhằm mang lại lợi ích thiết thực cho các đơn vị triển lãm và khách tham quan.

B. SỰ KIỆN QUẢNG BÁ TRONG NƯỚC
Hướng tới phát triển ngành thú cưng Việt Nam, ban tổ chức InterPetFest không chỉ tạo điều kiện kết nối kinh doanh trong ngành, cập nhật xu hướng thú cưng toàn cầu, mà còn mang sứ mệnh nâng cao kiến thức cho người tiêu dùng, khuyến khích nuôi thú cưng, và thay đổi nhận thức của công chúng về thú cưng tại Việt Nam. Điều này đạt được thông qua việc tổ chức các sự kiện cộng đồng như MallPetFest (sự kiện thú cưng tại trung tâm thương mại) và Dogathon (Giải Chạy vì Tương lai Chó Mèo Việt Nam).`,
    descriptionEn: `A. A GLOBAL JOURNEY
InterPetFest's organizing committee forms delegations of trade visitors and Vietnamese exhibitors to attend leading pet industry events around the world. The InterPetFest 2026 booth is promoted at major international pet exhibitions worldwide. The organizing committee also visits pet events in developed countries, always seeking new ideas and technologies to apply to InterPetFest 2026, while expanding its international network to bring practical benefits to exhibitors and visitors alike.

B. DOMESTIC PROMOTIONAL EVENTS
With a vision to grow Vietnam's pet industry, InterPetFest's organizers not only foster business connections and keep the industry updated on global pet trends, but also carry a mission to raise consumer awareness, encourage pet ownership, and shift public perception of pets in Vietnam. This is achieved through community events such as MallPetFest (pet events held at shopping malls) and Dogathon (the Run for the Future of Vietnamese Dogs and Cats).`,
    organizerName: 'Eventure JSC',
    heroImageFileName: 'event-1-hero-banner.png',
    organizerAvatarFileName: 'organizer-1-avt.png',
  },

  // ---------------- SỰ KIỆN 2 ----------------
  {
    titleVi: 'A Grand Season Festival - Petfair Vietnam',
    titleEn: 'A Grand Season Festival - Petfair Vietnam',
    tagVi: 'Mùa lễ hội',
    tagEn: 'Festival Season',
    locationShortVi: 'VEC, Phường Đông Anh, Hà Nội',
    locationShortEn: 'VEC, Dong Anh Ward, Hanoi',
    locationFullVi:
      'Vietnam Exposition Center (VEC) - Đường Cầu Tứ Liên, phường Đông Anh, Hà Nội',
    locationFullEn:
      'Vietnam Exposition Center (VEC) - Cau Tu Lien Street, Dong Anh Ward, Hanoi',
    timeVi:
      '18-20/11/2026 lúc 9:00AM - 17:00PM\n21/11/2026 lúc 9:00AM - 16:00PM',
    timeEn:
      'November 18-20, 2026, 9:00AM - 5:00PM\nNovember 21, 2026, 9:00AM - 4:00PM',
    descriptionVi: `Tại Grand Season Festival, chúng mình không chỉ mang đến một triển lãm - chúng mình tạo ra một không gian để bạn cùng "người bạn bốn chân" viết nên những kỷ niệm thật đẹp. Đây là nơi hàng nghìn tâm hồn đồng điệu của cộng đồng yêu thú cưng miền Bắc sẽ hội ngộ, cùng sẻ chia và lan tỏa tình yêu thương vô điều kiện!

Đến đây, bạn sẽ thấy hạnh phúc hiện hữu qua từng trải nghiệm.
• Nơi hàng nghìn "đồng môn" cùng đam mê gặp gỡ, sẻ chia bí kíp chăm Boss và cùng nhau tạo nên một cộng đồng vững mạnh.
• Không cần qua màn hình, bạn sẽ được trực tiếp cùng Boss tham gia các diễn đàn chia sẻ kiến thức, xem các màn trình diễn quốc tế và hòa mình vào không khí lễ hội tưng bừng.
• Khu vực tương tác được thiết kế riêng để bạn và thú cưng cùng lưu lại những tấm hình kỷ niệm ý nghĩa trong không gian lễ hội rực rỡ.
• Dành tặng cho Boss yêu những trải nghiệm chăm sóc sức khỏe và làm đẹp từ các đối tác thú y uy tín.

Tại Grand Season Festival, mọi kết nối đều là thật, mọi trải nghiệm đều đầy ắp sự thấu hiểu.`,
    descriptionEn: `At Grand Season Festival, we don't just bring you an exhibition — we create a space for you and your four-legged best friend to write beautiful memories together. This is where thousands of like-minded souls from the Northern pet-loving community come together to share and spread unconditional love!

Here, happiness comes alive in every experience.
• A place where thousands of fellow enthusiasts meet, exchange tips on caring for their "Boss," and build a strong community together.
• No screens needed — join your Boss in person at knowledge-sharing forums, watch international performances, and soak up the festive atmosphere.
• A dedicated interactive zone designed for you and your pet to capture meaningful memories amid a vibrant festival setting.
• Special health and beauty care experiences for your beloved Boss, provided by trusted veterinary partners.

At Grand Season Festival, every connection is genuine, and every experience is filled with understanding.`,
    organizerName: 'Minh Vi VEAS',
    heroImageFileName: 'event-2-hero-banner.png',
    organizerAvatarFileName: 'organizer-2-avt.png',
  },

  // ---------------- SỰ KIỆN 3 ----------------
  {
    titleVi: 'WCF Jubilee Cat Show 2026',
    titleEn: 'WCF Jubilee Cat Show 2026',
    tagVi: 'Cuộc thi cho mèo',
    tagEn: 'Cat Competition',
    locationShortVi: 'SECC, Phường Tân Mỹ, TP. Hồ Chí Minh',
    locationShortEn: 'SECC, Tan My Ward, Ho Chi Minh City',
    // ⚠️ Địa chỉ chi tiết bạn cung cấp cho sự kiện 3 trùng với địa chỉ
    // của NECC (Hà Nội) ở sự kiện 1, trong khi tên địa điểm là SECC
    // (TP.HCM) — có thể là nhầm lẫn khi copy dữ liệu. Mình tạm dùng
    // địa chỉ SECC thực tế phổ biến (799 Nguyễn Văn Linh, Q.7,
    // TP.HCM), bạn kiểm tra và sửa lại nếu không đúng.
    locationFullVi:
      'Saigon Exhibition and Convention Center (SECC) - 799 Nguyễn Văn Linh, phường Tân Mỹ, TP. Hồ Chí Minh',
    locationFullEn:
      'Saigon Exhibition and Convention Center (SECC) - 799 Nguyen Van Linh, Tan My Ward, Ho Chi Minh City',
    timeVi: '29-30/08/2026',
    timeEn: 'August 29-30, 2026',
    descriptionVi: `Nằm trong khuôn khổ Triển lãm và Lễ hội Thú cưng InterPetFest 2026, WCF Jubilee Cat Show 2026 là đấu trường chuyên nghiệp hàng đầu dành cho giới nuôi mèo chuyên nghiệp và cộng đồng yêu mèo tại Việt Nam và các nước lân cận.

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
    descriptionEn: `Held as part of InterPetFest 2026 — the Pet Exhibition & Festival — WCF Jubilee Cat Show 2026 is the leading professional arena for serious cat breeders and cat-loving communities in Vietnam and neighboring countries.

The event brings together nearly 100 outstanding feline contestants from a wide variety of breeds, judged by a distinguished panel of international judges from the World Cat Federation (WCF).

COMPETITION CLASSES:
• Adult: Adult cats
• Junior: Young adult cats
• Kitten: Kittens
• Neuter: Neutered cats
• Household Pet: Domestic pet cats

INTERNATIONAL JUDGING PANEL:
• Judge Jurgen Gunther Trautmann, Germany
• Judge Olga Kuznetsova, Russian Federation
• Judge Ekaterina Shershavikova, Russian Federation`,
    organizerName: 'Interpetfest',
    heroImageFileName: 'event-3-hero-banner.png',
    organizerAvatarFileName: 'organizer-3-avt.png',
  },
];

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu Event...');

  for (const eventData of eventsData) {
    console.log(`\n--- Đang xử lý: [${eventData.titleVi}] ---`);

    // 1. Upload ảnh hero banner + avatar ban tổ chức lên R2
    const heroImageUrl = await uploadLocalFileToR2(
      eventData.heroImageFileName,
      'image/png',
    );
    const organizerAvatarUrl = await uploadLocalFileToR2(
      eventData.organizerAvatarFileName,
      'image/png',
    );

    if (!heroImageUrl || !organizerAvatarUrl) {
      console.error(
        `❌ Bỏ qua [${eventData.titleVi}] vì thiếu ảnh upload lên R2.`,
      );
      continue;
    }

    // 2. Upsert Organizer (tránh tạo trùng nếu chạy seed nhiều lần)
    const organizer = await prisma.organizer.upsert({
      where: { name: eventData.organizerName },
      update: {
        avatarUrl: organizerAvatarUrl,
      },
      create: {
        name: eventData.organizerName,
        avatarUrl: organizerAvatarUrl,
      },
    });

    // 3. Tạo Event kèm gallery ảnh (random ảnh minh hoạ hợp lý theo hero banner)
    const event = await prisma.event.create({
      data: {
        titleVi: eventData.titleVi,
        titleEn: eventData.titleEn,
        tagVi: eventData.tagVi,
        tagEn: eventData.tagEn,
        locationShortVi: eventData.locationShortVi,
        locationShortEn: eventData.locationShortEn,
        locationFullVi: eventData.locationFullVi,
        locationFullEn: eventData.locationFullEn,
        timeVi: eventData.timeVi,
        timeEn: eventData.timeEn,
        descriptionVi: eventData.descriptionVi,
        descriptionEn: eventData.descriptionEn,
        heroImageUrl: heroImageUrl,
        organizer: {
          connect: { id: organizer.id },
        },
        gallery: {
          create: [
            { imageUrl: heroImageUrl, order: 0 },
            { imageUrl: organizerAvatarUrl, order: 1 },
          ],
        },
      },
    });

    console.log(`✅ Đã tạo Event: [${event.titleVi}] (id: ${event.id})`);
  }

  console.log('\n🎉 Hoàn tất seed Event!');
}

main()
  .catch((e) => {
    console.error('Lỗi trong quá trình chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });