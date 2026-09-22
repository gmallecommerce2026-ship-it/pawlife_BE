import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load biến môi trường từ .env
dotenv.config();

const prisma = new PrismaClient();

// 1. CẤU HÌNH CLOUDFLARE R2 CLIENT (Chuẩn theo dự án của bạn)
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

// 2. HÀM ĐỌC ẢNH LOCAL VÀ ĐẨY LÊN CLOUDFLARE R2
async function uploadLocalFileToR2(fileName: string, contentType: string = 'image/png'): Promise<string | null> {
  // Tìm file ảnh trong thư mục mock-data (ngang hàng file seed hoặc từ root)
  const possiblePaths = [
    path.join(__dirname, 'mock-data', fileName),
    path.join(process.cwd(), 'src', 'database', 'prisma', 'mock-data', fileName),
    path.join(process.cwd(), 'mock-data', fileName),
  ];

  const filePath = possiblePaths.find((p) => fs.existsSync(p));

  if (!filePath) {
    console.warn(`⚠️ [R2] Không tìm thấy file ảnh: ${fileName}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const r2Key = `hotels/${fileName}`; // Đặt vào folder 'hotels/' trên R2 cho gọn gàng

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    console.log(`✅ [R2] Đã upload: ${fileName} -> ${r2Key}`);

    // Trả về full URL để FE hiển thị trực tiếp
    const publicDomain = process.env.R2_PUBLIC_DOMAIN?.replace(/\/+$/, '');
    return `${publicDomain}/${r2Key}`;
  } catch (error) {
    console.error(`❌ [R2] Lỗi upload ${fileName}:`, error);
    return null;
  }
}

// 3. DANH SÁCH DỮ LIỆU KHÁCH SẠN (Gắn liền với tên file ảnh)
interface HotelSeedItem {
  countryId: string;
  name: string;
  cityVi: string;
  cityEn: string;
  rating: number;
  reviewsCount: number;
  imageFileName: string;
  websiteUrl: string;
  sortOrder: number;
}

const HOTELS_DATA: HotelSeedItem[] = [
  // 1. NHẬT BẢN (japan)
  {
    countryId: 'japan',
    name: "Doggy's Island",
    cityVi: 'Chiba, Nhật Bản',
    cityEn: 'Chiba, Japan',
    rating: 4.2,
    reviewsCount: 2619,
    imageFileName: 'doggy-island.png',
    websiteUrl: 'https://doggys-island.jp/en/',
    sortOrder: 1,
  },
  {
    countryId: 'japan',
    name: 'Wan Wan Paradise',
    cityVi: 'Yamanashi, Nhật Bản',
    cityEn: 'Yamanashi, Japan',
    rating: 4.1,
    reviewsCount: 520,
    imageFileName: 'wan-wan-paradise.png',
    websiteUrl: 'https://iconia.co.jp/en-us/hotel-wan-wan-paradise-yatsugatake-yamanashi',
    sortOrder: 2,
  },
  {
    countryId: 'japan',
    name: 'Wan Wan Paradise',
    cityVi: 'Shirahama, Nhật Bản',
    cityEn: 'Shirahama, Japan',
    rating: 4.4,
    reviewsCount: 152,
    imageFileName: 'wan-wan-shirahama.png',
    websiteUrl: 'https://iconia.co.jp/en-us/hotel-wan-wan-paradise-premier-nanki-shirahama-wakayama',
    sortOrder: 3,
  },

  // 2. VIỆT NAM (vietnam)
  {
    countryId: 'vietnam',
    name: 'Four Seasons Resort',
    cityVi: 'Đà Nẵng, Việt Nam',
    cityEn: 'Da Nang, Vietnam',
    rating: 4.1,
    reviewsCount: 53,
    imageFileName: 'four-seasons-resort.png',
    websiteUrl: 'https://www.fourseasons.com/hoian/',
    sortOrder: 1,
  },
  {
    countryId: 'vietnam',
    name: 'Wink Saigon Centre',
    cityVi: 'Hồ Chí Minh, Việt Nam',
    cityEn: 'Ho Chi Minh City, Vietnam',
    rating: 4.3,
    reviewsCount: 1300,
    imageFileName: 'wink-saigon-centre.png',
    websiteUrl: 'https://wink-hotels.com/vi/hotel/wink-saigon-centre/',
    sortOrder: 2,
  },
  {
    countryId: 'vietnam',
    name: 'Hanoi La Palm Premier',
    cityVi: 'Hà Nội, Việt Nam',
    cityEn: 'Hanoi, Vietnam',
    rating: 4.7,
    reviewsCount: 284,
    imageFileName: 'hanoi-la-palm-premier.png',
    websiteUrl: 'https://lapalmhotels.com/tour-services.html',
    sortOrder: 3,
  },

  // 3. TRUNG QUỐC (china)
  {
    countryId: 'china',
    name: 'Kimpton Qiantan Shanghai',
    cityVi: 'Thượng Hải, Trung Quốc',
    cityEn: 'Shanghai, China',
    rating: 4.7,
    reviewsCount: 28,
    imageFileName: 'kimpton-qiantan-shanghai.png',
    websiteUrl: 'https://kimptonshanghai.cn/',
    sortOrder: 1,
  },
  {
    countryId: 'china',
    name: 'Hyatt Regency Beijing Wangjing',
    cityVi: 'Bắc Kinh, Trung Quốc',
    cityEn: 'Beijing, China',
    rating: 4.4,
    reviewsCount: 102,
    imageFileName: 'hyatt-regency-beijing-wangjing.png',
    websiteUrl: 'https://www.hyatt.com/hyatt-regency/en-US/nayrw-hyatt-regency-beijing-wangjing',
    sortOrder: 2,
  },
  {
    countryId: 'china',
    name: 'Canopy by Hilton Hangzhou Jinsha Lake',
    cityVi: 'Chiết Giang, Trung Quốc',
    cityEn: 'Zhejiang, China',
    rating: 4.6,
    reviewsCount: 11,
    imageFileName: 'canopy-by-hilton-hangzhou-jinsha-lake.png',
    websiteUrl: 'https://www.hilton.com/en/hotels/hghpypy-canopy-hangzhou-jinsha-lake/',
    sortOrder: 3,
  },

  // 4. HÀN QUỐC (korea)
  {
    countryId: 'korea',
    name: "L'Escape Hotel",
    cityVi: 'Seoul, Hàn Quốc',
    cityEn: 'Seoul, South Korea',
    rating: 4.4,
    reviewsCount: 1649,
    imageFileName: 'l-escape-hotel.png',
    websiteUrl: 'https://josunhotel.com/intro.do',
    sortOrder: 1,
  },
  {
    countryId: 'korea',
    name: 'The Point Hotel',
    cityVi: 'Busan, Hàn Quốc',
    cityEn: 'Busan, South Korea',
    rating: 4.2,
    reviewsCount: 156,
    imageFileName: 'the-point-hotel.png',
    websiteUrl: 'https://pointhotel.com.au/',
    sortOrder: 2,
  },
  {
    countryId: 'korea',
    name: 'Jeju Western Grace Hotel',
    cityVi: 'Jeju, Hàn Quốc',
    cityEn: 'Jeju, South Korea',
    rating: 4.1,
    reviewsCount: 137,
    imageFileName: 'jeju-western-grace-hotel.png',
    websiteUrl: 'https://www.seanhotelgroup.com/hotels/western_grace/en/',
    sortOrder: 3,
  },

  // 5. PHÁP (france)
  {
    countryId: 'france',
    name: 'Le Negresco',
    cityVi: 'Nice, Pháp',
    cityEn: 'Nice, France',
    rating: 4.6,
    reviewsCount: 6670,
    imageFileName: 'le-negresco.png',
    websiteUrl: 'https://www.lenegresco.com/en',
    sortOrder: 1,
  },
  {
    countryId: 'france',
    name: 'Four Seasons Hotel George V, Paris',
    cityVi: 'Paris, Pháp',
    cityEn: 'Paris, France',
    rating: 4.8,
    reviewsCount: 7360,
    imageFileName: 'four-seasons-hotel-george-v-paris.png',
    websiteUrl: 'https://www.fourseasons.com/paris/',
    sortOrder: 2,
  },
  {
    countryId: 'france',
    name: 'Hôtel Maison Mère',
    cityVi: 'Paris, Pháp',
    cityEn: 'Paris, France',
    rating: 4.7,
    reviewsCount: 766,
    imageFileName: 'hotel-maison-mere.png',
    websiteUrl: 'https://www.maisonmere.co/',
    sortOrder: 3,
  },

  // 6. Ý (italy)
  {
    countryId: 'italy',
    name: 'Hotel de Russie',
    cityVi: 'Rome, Ý',
    cityEn: 'Rome, Italy',
    rating: 4.6,
    reviewsCount: 1906,
    imageFileName: 'hotel-de-russie.png',
    websiteUrl: 'https://www.roccofortehotels.com/hotels-and-resorts/hotel-de-russie/',
    sortOrder: 1,
  },
  {
    countryId: 'italy',
    name: 'Portrait Milano',
    cityVi: 'Milan, Ý',
    cityEn: 'Milan, Italy',
    rating: 4.6,
    reviewsCount: 863,
    imageFileName: 'portrait-milano.png',
    websiteUrl: 'https://www.lungarnocollection.com/milan/portrait-milano/',
    sortOrder: 2,
  },
  {
    countryId: 'italy',
    name: 'Belmond Hotel Cipriani',
    cityVi: 'Venice, Ý',
    cityEn: 'Venice, Italy',
    rating: 4.7,
    reviewsCount: 681,
    imageFileName: 'belmond-hotel-cipriani.png',
    websiteUrl: 'https://www.belmond.com/hotels/europe/italy/venice/belmond-hotel-cipriani/',
    sortOrder: 3,
  },

  // 7. ĐỨC (germany)
  {
    countryId: 'germany',
    name: 'The Ritz-Carlton',
    cityVi: 'Berlin, Đức',
    cityEn: 'Berlin, Germany',
    rating: 4.9,
    reviewsCount: 1239,
    imageFileName: 'the-ritz-carlton.png',
    websiteUrl: 'https://www.ritzcarlton.com/en/hotels/berrz-the-ritz-carlton-berlin/overview/',
    sortOrder: 1,
  },
  {
    countryId: 'germany',
    name: 'Platzl Hotel',
    cityVi: 'Munich, Đức',
    cityEn: 'Munich, Germany',
    rating: 4.5,
    reviewsCount: 1541,
    imageFileName: 'platzl-hotel.png',
    websiteUrl: 'https://www.platzl.de/en/',
    sortOrder: 2,
  },
  {
    countryId: 'germany',
    name: 'Reichshof Hamburg',
    cityVi: 'Hamburg, Đức',
    cityEn: 'Hamburg, Germany',
    rating: 4.5,
    reviewsCount: 3981,
    imageFileName: 'reichshof-hamburg.png',
    websiteUrl: 'https://www.reichshof-hotel-hamburg.de/',
    sortOrder: 3,
  },

  // 8. THỤY SỸ (switzerland)
  {
    countryId: 'switzerland',
    name: 'The Dolder Grand',
    cityVi: 'Zürich, Thụy Sỹ',
    cityEn: 'Zurich, Switzerland',
    rating: 4.7,
    reviewsCount: 4104,
    imageFileName: 'the-dolder-grand.png',
    websiteUrl: 'https://www.thedoldergrand.com/',
    sortOrder: 1,
  },
  {
    countryId: 'switzerland',
    name: 'Hotel Schweizerhof Luzern',
    cityVi: 'Lucerne, Thụy Sỹ',
    cityEn: 'Lucerne, Switzerland',
    rating: 4.6,
    reviewsCount: 2804,
    imageFileName: 'hotel-schweizerhof-luzern.png',
    websiteUrl: 'https://www.schweizerhof-luzern.ch/',
    sortOrder: 2,
  },
  {
    countryId: 'switzerland',
    name: 'Art Deco Hotel Montana',
    cityVi: 'Lucerne, Thụy Sỹ',
    cityEn: 'Lucerne, Switzerland',
    rating: 4.7,
    reviewsCount: 2307,
    imageFileName: 'art-deco-hotel-montana.png',
    websiteUrl: 'https://www.hotel-montana.ch/en',
    sortOrder: 3,
  },

  // 9. HY LẠP (greece)
  {
    countryId: 'greece',
    name: 'The Margi',
    cityVi: 'Athens, Hy Lạp',
    cityEn: 'Athens, Greece',
    rating: 4.6,
    reviewsCount: 2206,
    imageFileName: 'the-margi.png',
    websiteUrl: 'https://themargi.gr/',
    sortOrder: 1,
  },
  {
    countryId: 'greece',
    name: 'Grand Hyatt Athens',
    cityVi: 'Athens, Hy Lạp',
    cityEn: 'Athens, Greece',
    rating: 4.3,
    reviewsCount: 7196,
    imageFileName: 'grand-hyatt-athens.png',
    websiteUrl: 'https://www.hyatt.com/grand-hyatt/en-US/athgh-grand-hyatt-athens',
    sortOrder: 2,
  },
  {
    countryId: 'greece',
    name: 'Hotel Grande Bretagne',
    cityVi: 'Athens, Hy Lạp',
    cityEn: 'Athens, Greece',
    rating: 4.8,
    reviewsCount: 6767,
    imageFileName: 'hotel-grande-bretagne.png',
    websiteUrl: 'https://www.marriott.com/en-us/hotels/athlc-hotel-grande-bretagne-a-luxury-collection-hotel-athens/overview/',
    sortOrder: 3,
  },

  // 10. AI CẬP (egypt)
  {
    countryId: 'egypt',
    name: 'The Nile Ritz-Carlton',
    cityVi: 'Cairo, Ai Cập',
    cityEn: 'Cairo, Egypt',
    rating: 4.7,
    reviewsCount: 19447,
    imageFileName: 'the-nile-ritz-carlton.png',
    websiteUrl: 'https://www.ritzcarlton.com/en/hotels/cairz-the-nile-ritz-carlton-cairo/overview/',
    sortOrder: 1,
  },
  {
    countryId: 'egypt',
    name: 'Fairmont Nile City',
    cityVi: 'Cairo, Ai Cập',
    cityEn: 'Cairo, Egypt',
    rating: 4.7,
    reviewsCount: 25984,
    imageFileName: 'fairmont-nile-city.png',
    websiteUrl: 'https://www.fairmont.com/nile-city-cairo/',
    sortOrder: 2,
  },
  {
    countryId: 'egypt',
    name: 'Hilton Cairo Zamalek Residences',
    cityVi: 'Cairo, Ai Cập',
    cityEn: 'Cairo, Egypt',
    rating: 4.4,
    reviewsCount: 4937,
    imageFileName: 'hilton-cairo-zamalek-residences.png',
    websiteUrl: 'https://www.hilton.com/en/hotels/caizrhi-hilton-cairo-zamalek-residences/',
    sortOrder: 3,
  },
];

// 4. HÀM CHÍNH THỰC THI SEED
export async function seedPetHotels() {
  console.log('🧹 [1/3] Đang xoá dữ liệu PetHotel cũ...');
  await prisma.petHotel.deleteMany({});
  console.log('✅ Đã xoá sạch dữ liệu PetHotel cũ.');

  console.log('🚀 [2/3] Bắt đầu upload ảnh lên R2 và tạo bản ghi...');
  for (const item of HOTELS_DATA) {
    // Upload ảnh lên R2
    const uploadedImageUrl = await uploadLocalFileToR2(item.imageFileName, 'image/png');

    // Lưu vào database với link R2 thật
    await prisma.petHotel.create({
      data: {
        countryId: item.countryId.toLowerCase().trim(),
        name: item.name,
        cityVi: item.cityVi,
        cityEn: item.cityEn,
        rating: item.rating,
        reviewsCount: item.reviewsCount,
        imageUrl: uploadedImageUrl || 'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=600',
        websiteUrl: item.websiteUrl,
        sortOrder: item.sortOrder,
      },
    });
    console.log(`🏨 Đã tạo khách sạn: [${item.countryId}] ${item.name}`);
  }

  console.log('\n🎉 [3/3] Hoàn tất seed PetHotels thành công!');
}

// 5. TỰ ĐỘNG THỰC THI SCRIPT
seedPetHotels()
  .catch((e) => {
    console.error('❌ Lỗi khi seed PetHotels:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });