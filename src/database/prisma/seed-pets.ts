import { PrismaClient, PetGender, PetSize, PetStatus, Role } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();
const prisma = new PrismaClient();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

const bucketName = process.env.R2_BUCKET_NAME || '';
const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://pub-35c6d59c9e96467b9783df2a4e890a09.r2.dev';

// ==========================================
// TỪ ĐIỂN TỰ ĐỘNG & HELPER
// ==========================================
const TRAIT_DICT: Record<string, string> = {
  "Thân thiện": "Friendly", "Hòa đồng": "Sociable", "Quấn người": "Affectionate",
  "Thích được vuốt ve": "Loves petting", "Độc lập": "Independent", "Nhút nhát": "Shy",
  "Cảnh giác": "Alert", "Trung thành": "Loyal", "Hay ghen": "Jealous",
  "Tăng động": "Hyperactive", "Nhiều năng lượng": "High energy", "Bình tĩnh": "Calm",
  "Điềm đạm": "Mellow", "Lười vận động": "Lazy", "Thích ngủ": "Loves sleeping",
  "Linh hoạt": "Flexible", "Năng động ngoài trời": "Outdoorsy", "Hiếu động": "Active",
  "Tò mò": "Curious", "Tinh nghịch": "Playful", "Nghe lời": "Obedient",
  "Cứng đầu": "Stubborn", "Dễ huấn luyện": "Trainable", "Hay sủa": "Vocal",
  "Thích đào bới": "Loves digging", "Thích gặm đồ": "Loves chewing", "Thích khám phá": "Adventurous",
  "Tình cảm": "Loving", "Dịu dàng": "Gentle", "Nhạy cảm": "Sensitive",
  "Vui vẻ": "Cheerful", "Dễ lo lắng": "Anxious", "Dũng cảm": "Brave", "Tự tin": "Confident",
  "Chó": "Dog", "Mèo": "Cat", "Chưa rõ": "Unknown", "Đang cập nhật": "Updating"
};

const GOOD_WITH_OPTS = [
  { vi: "Trẻ em", en: "Kids" }, { vi: "Chó khác", en: "Other dogs" },
  { vi: "Mèo", en: "Cats" }, { vi: "Người lạ", en: "Strangers" }
];

const BAD_WITH_OPTS = [
  { vi: "Trẻ em ồn ào", en: "Noisy kids" }, { vi: "Không gian hẹp", en: "Confined spaces" },
  { vi: "Chó lớn", en: "Large dogs" }, { vi: "Động vật nhỏ", en: "Small animals" }
];

// Hàm trả về Object JSON chuẩn cho Prisma (Sửa lỗi Prisma Invalid Argument)
function biObj(viText: string, enText?: string): any {
  if (!viText) return { vi: '', en: '' };
  return {
    vi: viText,
    en: enText || TRAIT_DICT[viText] || viText
  };
}

// Bốc ngẫu nhiên tính cách
function getRandomTraits(count: number): string[] {
  const keys = Object.keys(TRAIT_DICT).filter(k => !['Chó', 'Mèo', 'Chưa rõ', 'Đang cập nhật'].includes(k));
  return keys.sort(() => 0.5 - Math.random()).slice(0, count);
}

// Bốc ngẫu nhiên Good/Bad With trả về JSON array
function getRandomBehaviors(source: any[], count: number) {
  const selected = source.sort(() => 0.5 - Math.random()).slice(0, count);
  return {
    vi: selected.map(s => s.vi),
    en: selected.map(s => s.en)
  };
}

// ==========================================
// CÁC HÀM XỬ LÝ ẢNH, TUỔI, CÂN NẶNG & TRẠM
// ==========================================

// Parse Tuổi sang Date chính xác để PawHistory render
function parseAgeToDob(ageStr: any): Date {
  const now = new Date();
  if (!ageStr) {
    now.setFullYear(now.getFullYear() - (Math.floor(Math.random() * 3) + 1)); // Random 1-3 tuổi
    return now;
  }
  const str = String(ageStr).toLowerCase().trim();
  const matchNum = str.match(/(\d+)/);
  const num = matchNum ? parseInt(matchNum[1], 10) : (Math.floor(Math.random() * 3) + 1);

  if (str.includes('tháng')) {
    now.setMonth(now.getMonth() - num);
  } else {
    now.setFullYear(now.getFullYear() - num);
  }
  return now;
}

// Lấy cân nặng và size logic
function getWeightAndSize(speciesVi: string) {
  if (speciesVi === 'Chó') {
    const w = Math.floor(Math.random() * 15) + 5; // 5 - 20kg
    return { weight: w, size: w > 12 ? PetSize.LARGE : PetSize.MEDIUM };
  } else {
    const w = Math.floor(Math.random() * 4) + 2; // 2 - 6kg
    return { weight: w, size: PetSize.SMALL };
  }
}

async function getLocalImagesAndUpload(petId: any): Promise<{ url: string }[]> {
  const safeId = String(petId || '').trim();
  if (!safeId) return [{ url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=400' }];

  const folderPath = path.join(process.cwd(), 'prisma/data/images', safeId);
  let results: { url: string }[] = [];

  try {
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          const fileBuffer = fs.readFileSync(path.join(folderPath, file));
          const r2Key = `pet-images/${safeId}/${file}`;
          await s3Client.send(new PutObjectCommand({
            Bucket: bucketName, Key: r2Key, Body: fileBuffer,
            ContentType: file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
          }));
          results.push({ url: `${publicDomain}/${r2Key}` });
          process.stdout.write(' ⬆️ ');
        }
      }
    }
  } catch (error) {}
  if (results.length === 0) results.push({ url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=400' });
  return results;
}

// Khai báo sẵn các Trạm có địa chỉ cụ thể
const PREDEFINED_SHELTERS = [
  { name: 'Hà Nội Pet Rescue', address: 'Quận Cầu Giấy, Hà Nội', lat: 21.028511, lng: 105.804817 },
  { name: 'Sài Gòn Animal Rescue', address: 'Quận 1, TP. Hồ Chí Minh', lat: 10.762622, lng: 106.660172 },
  { name: 'Đà Nẵng Furry Friends', address: 'Quận Hải Châu, Đà Nẵng', lat: 16.054407, lng: 108.202164 }
];

const shelterCache = new Map<string, string>();
async function getOrCreateShelter(khuName: any): Promise<string | null> {
  const name = String(khuName || 'PawLife Rescue').trim();
  if (shelterCache.has(name)) return shelterCache.get(name)!;

  let shelter = await prisma.shelter.findFirst({ where: { name } });
  if (!shelter) {
    // Random chọn 1 location thật
    const loc = PREDEFINED_SHELTERS[Math.floor(Math.random() * PREDEFINED_SHELTERS.length)];
    shelter = await prisma.shelter.create({
      data: {
        name: name, address: loc.address, contactInfo: '0999999999',
        description: 'Trạm cứu hộ động vật tận tâm, luôn mở cửa đón chào các bé.', policy: 'Liên hệ trực tiếp để nhận nuôi.',
        avatarUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=200',
        latitude: loc.lat, longitude: loc.lng,
      }
    });
  }
  shelterCache.set(name, shelter.id);
  return shelter.id;
}

// ==========================================
// CHƯƠNG TRÌNH CHÍNH
// ==========================================
async function main() {
  console.log('🗑 Bắt đầu dọn dẹp toàn bộ dữ liệu cũ...');
  await prisma.eventImage.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.tagReport.deleteMany(); 
  await prisma.tag.updateMany({ where: { petId: { not: null } }, data: { petId: null } });
  await prisma.tag.deleteMany();
  await prisma.transferRequest.deleteMany();
  await prisma.adoptionApplication.deleteMany();
  await prisma.adoptionRequest.deleteMany();
  await prisma.petInteraction.deleteMany();
  await prisma.favoritePet.deleteMany();
  await prisma.medicalRecord.deleteMany(); // Reset bệnh án
  await prisma.petImage.deleteMany();
  await prisma.petTrait.deleteMany(); 
  await prisma.pet.deleteMany(); 
  await prisma.followedShelter.deleteMany();
  await prisma.shelter.deleteMany();
  console.log('✅ Đã xóa xong dữ liệu cũ!');

  // 1. TẠO ADMIN
  console.log('\n👤 Đang tạo tài khoản Admin...');
  const adminEmail = 'hello@pawlife.vn';
  const hashedPassword = await bcrypt.hash('#Motconvit1205', 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashedPassword, role: Role.ADMIN },
    create: { email: adminEmail, password: hashedPassword, name: 'PawLife Admin', phone: '0999999999', role: Role.ADMIN }
  });
  console.log(`✅ Đã tạo Admin: ${adminEmail}`);

  // 2. TẠO ORGANIZERS & EVENTS SONG NGỮ BẰNG TỪ ĐIỂN CỨNG
  console.log('\n🏢 Đang tạo Organizers & Events (Đa ngôn ngữ)...');
  const org1 = await prisma.organizer.create({
    data: {
      name: 'PawLife Official', handle: '@pawlife_vn',
      about: biObj('Đơn vị tổ chức các sự kiện kết nối cộng đồng yêu thú cưng hàng đầu.', 'Leading pet community event organizer.'),
      avatarUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=200',
      coverUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=800',
      followers: 12500,
    }
  });

  const today = new Date();
  await prisma.event.create({
    data: {
      title: biObj('Lớp học vẽ nghệ thuật cùng thú cưng', 'Art therapy & painting class'),
      category: biObj('Nghệ thuật', 'Art'),
      description: biObj('Tham gia lớp học vẽ nghệ thuật cùng những người bạn bốn chân.', 'Join our art therapy class with four-legged friends.'),
      locationName: biObj('Studio Nghệ Thuật Paw', 'Paw Studio'),
      address: 'Quận Tây Hồ, Hà Nội', latitude: 21.058178, longitude: 105.804158,
      startDate: new Date(today.getTime() + 7 * 86400000), endDate: new Date(today.getTime() + 7 * 86400000 + 10800000),
      bannerUrl: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?q=80&w=800',
      interestedCount: 255, organizerId: org1.id,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=300' }] }
    }
  });
  console.log(`✅ Đã tạo Events & Organizers.`);

  // 3. TẠO PETS TỪ EXCEL (FULL LỊCH SỬ, BEHAVIOR, CÂN NẶNG, NGÀY SINH)
  const excelPath = path.join(process.cwd(), 'prisma/data/cho_meo.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Không tìm thấy file Excel.`);
    process.exit(0);
  }

  console.log(`\n⏳ Đang nạp dữ liệu Pet từ Excel...`);
  const workbook: any = xlsx.readFile(excelPath);
  const allRecords = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, defval: '' });
  const limitRecords = allRecords.slice(0, 15);

  for (const row of limitRecords as any[]) {
    const rawId = row['ID'] || row['ID '] || row[' ID'];
    const petId = rawId ? String(rawId).trim() : String(row['Ảnh'] || '').split('.')[0].trim();
    const name = row['Tên thú cưng'] || row['Tên'] || row['Name'] || petId || 'Bé Không Tên';
    const rawSpecies = String(row['Loài'] || row['Giống'] || '').toLowerCase().includes('mèo') ? 'Mèo' : 'Chó'; 

    try {
      const shelterId = await getOrCreateShelter(row['Khu']);
      const imagesData = await getLocalImagesAndUpload(petId);
      
      const randomTraits = getRandomTraits(4); 
      const parsedDob = parseAgeToDob(row['Độ tuổi']);
      const physProps = getWeightAndSize(rawSpecies);

      await prisma.pet.create({
        data: {
          name: String(name),
          species: biObj(rawSpecies),
          breed: biObj(String(row['Giống'] || 'Chưa rõ')),
          color: biObj(String(row['Màu lông'] || 'Đang cập nhật')),
          description: biObj([row['Lưu ý'], row['Ghi chú'], row['Cột 1']].filter(Boolean).join('. ').trim()),
          
          dob: parsedDob, // Khắc phục "Unknown Age"
          weight: physProps.weight, // Khắc phục thiếu Weight
          size: physProps.size, // Động theo giống loài
          
          goodWith: getRandomBehaviors(GOOD_WITH_OPTS, 2), // JSON Song ngữ
          badWith: getRandomBehaviors(BAD_WITH_OPTS, 1),   // JSON Song ngữ
          
          gender: String(row['Giới tính']).toLowerCase().includes('cái') ? PetGender.FEMALE : PetGender.MALE,
          status: String(row['Tình trạng']).includes('nhận nuôi') ? PetStatus.ADOPTED : PetStatus.AVAILABLE,
          vetVerificationStatus: 'VERIFIED',
          shelterId,
          
          traitsList: {
            create: randomTraits.map(t => ({
              name: biObj(t) // Chuẩn object cho model
            }))
          },
          personalityTags: randomTraits, // Array JSON
          images: { create: imagesData },

          // TẠO HỒ SƠ Y TẾ & THẺ QR ĐỂ RENDER PAWHISTORY
          medicalRecords: {
            create: [
              {
                type: 'Vaccine',
                recordName: biObj('Tiêm phòng dại', 'Rabies Vaccine'),
                recordDate: new Date(Date.now() - 45 * 86400000), // 45 ngày trước
                verificationStatus: 'VERIFIED'
              }
            ]
          },
          tags: {
            create: [
              {
                status: 'ACTIVE',
                linkedAt: new Date(Date.now() - 30 * 86400000) // 30 ngày trước
              }
            ]
          }
        }
      });
      process.stdout.write(`\n✅ Xong bé: ${name}`);
    } catch (e: any) {
      console.log(`\n❌ Lỗi bé ${name}: ${e.message}`);
    }
  }

  console.log('\n🎉 HOÀN TẤT TẤT CẢ! Đã ngắt kết nối an toàn.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    if (s3Client) s3Client.destroy();
    process.exit(0); // Chống Deadlock
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });