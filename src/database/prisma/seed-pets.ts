import { PrismaClient, PetGender, PetSize, PetStatus } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module'; // Đường dẫn đến AppModule chính của bạn
import { TranslateService } from '../../translate/translate.service'; // Dịch vụ gọi API dịch thuật
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// 1. Nạp biến môi trường từ file .env
dotenv.config();

const prisma = new PrismaClient();

// 2. Khởi tạo S3 Client ngay trong file Seed để có quyền upload
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const bucketName = process.env.R2_BUCKET_NAME || '';
const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://pub-35c6d59c9e96467b9783df2a4e890a09.r2.dev';

// ==========================================
// HELPER: Hàm Dịch Thuật Thành JSON Song Ngữ
// ==========================================
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

function parseAgeToDob(ageStr: any): Date | null {
  if (!ageStr) return null;
  const str = String(ageStr).toLowerCase().trim();
  const now = new Date();
  const matchNum = str.match(/(\d+)/);
  if (!matchNum) return null;
  const num = parseInt(matchNum[1], 10);
  if (str.includes('tuổi') || str.includes('năm')) { now.setFullYear(now.getFullYear() - num); return now; }
  if (str.includes('tháng')) { now.setMonth(now.getMonth() - num); return now; }
  return null;
}

function parseGender(genderStr: any): PetGender {
  const str = String(genderStr || '').toLowerCase().trim();
  if (str === 'đực') return PetGender.MALE;
  if (str === 'cái') return PetGender.FEMALE;
  return PetGender.UNKNOWN;
}

function parseStatus(statusStr: any): PetStatus {
  const str = String(statusStr || '').toLowerCase().trim();
  if (str.includes('đã được nhận nuôi')) return PetStatus.ADOPTED;
  return PetStatus.AVAILABLE;
}

// 3. Hàm xử lý và UPLOAD ảnh lên R2
async function getLocalImagesAndUpload(petId: any): Promise<{ url: string }[]> {
  const safeId = String(petId || '').trim();
  if (!safeId) return [{ url: 'https://loremflickr.com/400/400/dog' }];

  const folderPath = path.join(process.cwd(), 'prisma/data/images', safeId);
  console.log(`\n🔍 Đang xử lý và UPLOAD ảnh cho ID: ${safeId}`);

  let results: { url: string }[] = [];

  try {
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          const filePath = path.join(folderPath, file);
          const fileBuffer = fs.readFileSync(filePath);
          const r2Key = `pet-images/${safeId}/${file}`;

          let contentType = 'image/jpeg';
          if (file.toLowerCase().endsWith('.png')) contentType = 'image/png';
          else if (file.toLowerCase().endsWith('.webp')) contentType = 'image/webp';
          else if (file.toLowerCase().endsWith('.gif')) contentType = 'image/gif';

          await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: r2Key,
            Body: fileBuffer,
            ContentType: contentType
          }));

          const imageUrl = `${publicDomain}/${r2Key}`;
          results.push({ url: imageUrl });
          process.stdout.write(' ⬆️(Đã up) ');
        }
      }
    }
  } catch (error) {
    console.log(`\n⚠️ Lỗi upload ảnh của ${safeId} lên R2: ${error}`);
  }

  if (results.length === 0) {
    results.push({ url: 'https://loremflickr.com/400/400/dog' });
  }

  return results;
}

const shelterCache = new Map<string, string>();

async function getOrCreateShelter(khuName: any): Promise<string | null> {
  if (!khuName) return null;
  const name = String(khuName).trim();
  if (shelterCache.has(name)) return shelterCache.get(name)!;

  let shelter = await prisma.shelter.findFirst({ where: { name } });
  if (!shelter) {
    shelter = await prisma.shelter.create({
      data: {
        name: name,
        address: 'Đang cập nhật',
        contactInfo: '0999999999',
        description: 'Trạm cứu hộ tự động',
        policy: 'Liên hệ trực tiếp để nhận nuôi.',
        avatarUrl: 'https://loremflickr.com/200/200/house',
        latitude: 21.028511,
        longitude: 105.804817,
      }
    });
  }
  shelterCache.set(name, shelter.id);
  return shelter.id;
}

// Nhận thêm translateService vào để dịch tự động
async function processBatch(batch: any[], translateService: TranslateService) {
  for (const row of batch) {
    const rawId = row['ID'] || row['ID '] || row[' ID'];
    const fallbackId = String(row['Ảnh'] || '').split('.')[0].trim();
    const petId = rawId ? String(rawId).trim() : fallbackId;

    const name = row['Tên thú cưng'] || row['Tên'] || row['Name'] || petId || 'Bé Không Tên';

    const loaiStr = String(row['Loài'] || row['Giống'] || '').toLowerCase();
    // Thay vì gửi 'CAT' hoặc 'DOG', ta gửi chữ tiếng Việt để AI dịch
    const rawSpecies = loaiStr.includes('mèo') ? 'Mèo' : 'Chó';

    try {
      const status = parseStatus(row['Tình trạng']);
      const rawDescription = [row['Lưu ý'], row['Ghi chú'], row['Cột 1']].filter(Boolean).join('. ');
      const shelterId = await getOrCreateShelter(row['Khu']);

      // 4. Dịch các trường sang Song Ngữ JSON
      console.log(`\n⏳ Đang dịch thông tin cho bé: ${name}...`);
      const speciesBilingual = await buildBilingualField(rawSpecies, translateService, 'vi');
      const breedBilingual = await buildBilingualField(String(row['Giống'] || 'Chưa rõ'), translateService, 'vi');
      const colorBilingual = await buildBilingualField(String(row['Màu lông'] || 'Đang cập nhật'), translateService, 'vi');
      const descriptionBilingual = await buildBilingualField(rawDescription, translateService, 'vi');

      // 5. Upload ảnh lên R2
      const imagesData = await getLocalImagesAndUpload(petId);

      await prisma.pet.create({
        data: {
          name: String(name),
          species: speciesBilingual,     // Đã chuyển thành chuẩn JSON
          breed: breedBilingual,         // Đã chuyển thành chuẩn JSON
          dob: parseAgeToDob(row['Độ tuổi']),
          color: colorBilingual,         // Đã chuyển thành chuẩn JSON
          gender: parseGender(row['Giới tính']),
          size: PetSize.MEDIUM,
          isSpayedNeutered: String(row['Triệt sản'] || '').toLowerCase().includes('đã triệt sản'),
          isVaccinated: String(row['Tiêm phòng'] || '').toLowerCase().includes('đã tiêm đủ'),
          status,
          vetVerificationStatus: 'VERIFIED',
          description: descriptionBilingual, // Đã chuyển thành chuẩn JSON
          shelterId,
          images: { create: imagesData }
        }
      });
      process.stdout.write(`\n✅ Thành công: ${name}`);

    } catch (error: any) {
      console.log(`\n❌ [LỖI DB - Tên: ${name}]: ${error.message}`);
    }
  }
}

export async function seedPets() {
  console.log('🌱 Đang khởi tạo ứng dụng NestJS để lấy dịch vụ TranslateService...');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const translateService = appContext.get(TranslateService);

  console.log('Bắt đầu dọn dẹp dữ liệu cũ (Xóa Database)...');
  await prisma.eventImage.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.event.deleteMany();
  await prisma.tagReport.deleteMany();
  await prisma.tag.updateMany({ where: { petId: { not: null } }, data: { petId: null } });
  await prisma.tag.deleteMany();
  await prisma.transferRequest.deleteMany();
  await prisma.adoptionApplication.deleteMany();
  await prisma.adoptionRequest.deleteMany();
  await prisma.petInteraction.deleteMany();
  await prisma.favoritePet.deleteMany();
  await prisma.petImage.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.followedShelter.deleteMany();
  await prisma.shelter.deleteMany();
  console.log('Đã xóa xong dữ liệu cũ!');

  const excelPath = path.join(process.cwd(), 'prisma/data/cho_meo.xlsx');

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Không tìm thấy file Excel tại: ${excelPath}`);
    await appContext.close();
    return;
  }

  console.log(`\n⏳ Đang nạp file Excel...`);
  let workbook: any = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const allRecords = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    raw: false,
    defval: ''
  });

  workbook = null;
  if (global.gc) {
    global.gc();
  }

  // Giới hạn 15 bé đầu tiên như code gốc của bạn
  const limitRecords = allRecords.slice(0, 15);
  console.log(`✅ Sẽ tiến hành dịch song ngữ, upload ảnh và seed đúng ${limitRecords.length} bé đầu tiên!`);

  // Truyền translateService vào processBatch
  await processBatch(limitRecords, translateService);

  console.log(`\n🎉 HOÀN TẤT! Đã upload ảnh lên R2, dịch dữ liệu và seed thành công.`);

  // Đóng app context giải phóng RAM VPS
  await appContext.close();
}

seedPets()
  .then(async () => {
    // 1. Đóng kết nối Prisma
    await prisma.$disconnect();

    // 2. Đóng kết nối AWS S3 (Giải phóng socket mạng)
    if (s3Client) {
      s3Client.destroy();
    }

    console.log('🛑 Đã ngắt toàn bộ kết nối rác. Đóng tiến trình thành công!');

    // 3. Ép Node.js thoát tiến trình ngay lập tức (Status 0 = Thành công)
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('\n❌ Tiến trình seed thất bại:', e);
    await prisma.$disconnect();
    process.exit(1); // Status 1 = Có lỗi
  });