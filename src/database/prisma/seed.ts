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
// TỪ ĐIỂN TỰ ĐỘNG (KHÔNG CẦN API KEY)
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

// Hàm chuyển đổi sang JSON song ngữ lưu DB
function bi(viText: string, enText?: string): string {
  if (!viText) return JSON.stringify({ vi: '', en: '' });
  return JSON.stringify({
    vi: viText,
    en: enText || TRAIT_DICT[viText] || viText
  });
}

function getRandomTraits(count: number): string[] {
  const keys = Object.keys(TRAIT_DICT).filter(k => !['Chó', 'Mèo', 'Chưa rõ', 'Đang cập nhật'].includes(k));
  return keys.sort(() => 0.5 - Math.random()).slice(0, count);
}

// ==========================================
// CÁC HÀM XỬ LÝ ẢNH & DATA PET
// ==========================================
async function getLocalImagesAndUpload(petId: any): Promise<{ url: string }[]> {
  const safeId = String(petId || '').trim();
  if (!safeId) return [{ url: 'https://loremflickr.com/400/400/dog' }];

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
  if (results.length === 0) results.push({ url: 'https://loremflickr.com/400/400/dog' });
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
        name: name, address: 'Khu vực Hà Nội', contactInfo: '0999999999',
        description: 'Trạm cứu hộ tự động', policy: 'Liên hệ trực tiếp để nhận nuôi.',
        avatarUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=200',
        latitude: 21.028511, longitude: 105.804817,
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
  await prisma.petImage.deleteMany();
  await prisma.petTrait.deleteMany(); // Xóa traits list
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
      about: bi('Đơn vị tổ chức các sự kiện kết nối cộng đồng yêu thú cưng hàng đầu.', 'Leading pet community event organizer.'),
      avatarUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=200',
      coverUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=800',
      followers: 12500,
    }
  });

  const org2 = await prisma.organizer.create({
    data: {
      name: 'Pawsome Events Co.', handle: '@pawsome_events',
      about: bi('Chuyên tổ chức các khóa huấn luyện và hoạt động thể chất.', 'Specializes in training courses and outdoor activities.'),
      avatarUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=200',
      coverUrl: 'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?q=80&w=800',
      followers: 8430,
    }
  });

  const today = new Date();
  await prisma.event.create({
    data: {
      title: bi('Lớp học vẽ nghệ thuật cùng thú cưng', 'Art therapy & painting class'),
      category: bi('Nghệ thuật', 'Art'),
      description: bi('Tham gia lớp học vẽ nghệ thuật cùng những người bạn bốn chân.', 'Join our art therapy class with four-legged friends.'),
      locationName: bi('Studio Nghệ Thuật Paw', 'Paw Studio'),
      address: 'Quận Tây Hồ, Hà Nội', latitude: 21.058178, longitude: 105.804158,
      startDate: new Date(today.getTime() + 7 * 86400000), endDate: new Date(today.getTime() + 7 * 86400000 + 10800000),
      bannerUrl: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?q=80&w=800',
      interestedCount: 255, organizerId: org1.id,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=300' }] }
    }
  });

  await prisma.event.create({
    data: {
      title: bi('Hội thi Chó chạy Marathon', 'Dog Marathon Competition'),
      category: bi('Thể thao', 'Sports'),
      description: bi('Giải chạy bộ đồng hành cùng thú cưng quy mô lớn.', 'The largest pet marathon event of the year.'),
      locationName: bi('Công viên Yên Sở', 'Yen So Park'),
      address: 'Hoàng Mai, Hà Nội', latitude: 20.955091, longitude: 105.868285,
      startDate: new Date(today.getTime() + 30 * 86400000), endDate: new Date(today.getTime() + 30 * 86400000 + 14400000),
      bannerUrl: 'https://images.unsplash.com/photo-1537204696486-967f1b7198c8?q=80&w=800',
      interestedCount: 840, organizerId: org2.id,
      images: { create: [{ url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=300' }] }
    }
  });
  console.log(`✅ Đã tạo Events & Organizers.`);

  // 3. TẠO PETS TỪ EXCEL (KÈM TRAITS SONG NGỮ)
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
      
      // Random 3 tính cách từ Từ Điển để nạp vào DB
      const randomTraits = getRandomTraits(3); 

      await prisma.pet.create({
        data: {
          name: String(name),
          species: bi(rawSpecies),
          breed: bi(String(row['Giống'] || 'Chưa rõ')),
          color: bi(String(row['Màu lông'] || 'Đang cập nhật')),
          description: bi([row['Lưu ý'], row['Ghi chú'], row['Cột 1']].filter(Boolean).join('. ').trim()),
          gender: String(row['Giới tính']).toLowerCase().includes('cái') ? PetGender.FEMALE : PetGender.MALE,
          size: PetSize.MEDIUM, 
          status: String(row['Tình trạng']).includes('nhận nuôi') ? PetStatus.ADOPTED : PetStatus.AVAILABLE,
          vetVerificationStatus: 'VERIFIED',
          shelterId,
          // Nạp Traits (Tính cách) chuẩn dạng Model Relation
          traitsList: {
            create: randomTraits.map(t => ({
              name: bi(t)
            }))
          },
          // Lưu dự phòng thêm dưới dạng Json Array cho app đọc nhanh
          personalityTags: JSON.stringify(randomTraits),
          images: { create: imagesData }
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
    process.exit(0); // Lệnh chống Deadlock, ép thoát ngay lập tức!
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });