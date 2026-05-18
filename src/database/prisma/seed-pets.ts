import { PrismaClient, PetGender, PetSize, PetStatus } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

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

// Hàm quét ảnh cục bộ từ ổ cứng VPS
function getLocalImages(petId: any): { url: string }[] {
  const safeId = String(petId || '').trim();
  if (!safeId) return [{ url: 'https://loremflickr.com/400/400/dog' }];

  const folderPath = path.join(process.cwd(), 'prisma/data/images', safeId);
  let results: { url: string }[] = [];

  try {
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          // Tạm thời dùng link pub r2 dev, bạn đổi thành domain thật sau
          const imageUrl = `https://pub-35c6d59c9e96467b9783df2a4e890a09.r2.dev/pet-images/${safeId}/${file}`;
          results.push({ url: imageUrl });
        }
      }
    }
  } catch (error) {
    console.log(`\n⚠️ Lỗi quét thư mục ảnh của ${safeId}: ${error}`);
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

async function processBatch(batch: any[]) {
  for (const row of batch) {
    const name = row['Tên thú cưng'] || row['Tên'] || row['Name'] || row['ID'] || 'Bé Không Tên';
    const petId = row['ID']; 
    
    const loaiStr = String(row['Loài'] || row['Giống'] || '').toLowerCase();
    const speciesType = loaiStr.includes('mèo') ? 'CAT' : 'DOG';

    try {
      const status = parseStatus(row['Tình trạng']);
      const description = [row['Lưu ý'], row['Ghi chú'], row['Cột 1']].filter(Boolean).join('. ');
      const shelterId = await getOrCreateShelter(row['Khu']);
      
      // Quét thư mục ảnh offline
      const imagesData = getLocalImages(petId);

      await prisma.pet.create({
        data: {
          name: String(name),
          species: speciesType,
          breed: String(row['Giống'] || 'Chưa rõ'),
          dob: parseAgeToDob(row['Độ tuổi']),
          color: String(row['Màu lông'] || 'Đang cập nhật'),
          gender: parseGender(row['Giới tính']),
          size: PetSize.MEDIUM, 
          isSpayedNeutered: String(row['Triệt sản'] || '').toLowerCase().includes('đã triệt sản'),
          isVaccinated: String(row['Tiêm phòng'] || '').toLowerCase().includes('đã tiêm đủ'),
          status,
          vetVerificationStatus: 'VERIFIED', 
          description,
          shelterId,
          images: { create: imagesData }
        }
      });
      process.stdout.write(`✅ ${name} | `);
      
    } catch (error: any) {
      console.log(`\n❌ [LỖI DB - Tên: ${name}]: ${error.message}`);
    }
  }
}

export async function seedPets() {
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
    return;
  }

  console.log(`\n⏳ Đang nạp file Excel...`);
  let workbook: any = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const allRecords = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  workbook = null; 
  if (global.gc) {
    global.gc();
  }

  // TỐI QUAN TRỌNG: Chỉ lấy đúng 15 bé đầu tiên
  const limitRecords = allRecords.slice(0, 15);

  console.log(`✅ Sẽ tiến hành seed đúng ${limitRecords.length} bé đầu tiên!`);

  // Chạy luôn 1 cục 15 bé vì làm offline nên tốc độ cực nhanh, không cần băm nhỏ quá
  await processBatch(limitRecords);
  
  console.log(`\n🎉 HOÀN TẤT! Đã lấy ảnh và seed thành công 15 bé đầu.`);
}

seedPets()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('\n❌ Tiến trình seed thất bại:', e);
    await prisma.$disconnect();
    process.exit(1);
  })