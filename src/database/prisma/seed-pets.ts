import { PrismaClient, PetGender, PetSize, PetStatus } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { google } from 'googleapis';

const prisma = new PrismaClient();

// CẤU HÌNH DRIVE API Ở ĐÂY
const GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY || 'API_KEY_CUA_BAN_O_DAY';

const drive = google.drive({
  version: 'v3',
  auth: GOOGLE_DRIVE_API_KEY,
});

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

async function getImagesFromFolder(folderId: string): Promise<string[]> {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id)',
      pageSize: 5, 
    });
    return res.data.files?.map((f) => f.id as string).filter(Boolean) || [];
  } catch (error: any) {
    return [];
  }
}

async function extractImages(imageStr: any): Promise<{ url: string }[]> {
  if (!imageStr) return [{ url: 'https://loremflickr.com/400/400/dog' }];
  
  const parts = String(imageStr).split(/[\n,;]+/).map(s => s.trim()).filter(s => s);
  if (parts.length === 0) return [{ url: 'https://loremflickr.com/400/400/dog' }];

  let results: { url: string }[] = [];

  for (const part of parts) {
    if (part.includes('drive.google.com') && (part.includes('/folders/') || part.includes('id='))) {
      let folderId = '';
      const matchFolder = part.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (matchFolder && matchFolder[1]) folderId = matchFolder[1];
      if (!folderId && part.includes('id=')) {
        const matchId = part.match(/id=([a-zA-Z0-9_-]+)/);
        if (matchId && matchId[1]) folderId = matchId[1];
      }
      if (part.includes('/folders/')) {
        const imageIds = await getImagesFromFolder(folderId);
        if (imageIds.length > 0) {
          results.push(...imageIds.map(id => ({ url: `https://drive.google.com/thumbnail?id=${id}&sz=w1000` })));
          continue; 
        }
      }
    }

    if (part.includes('drive.google.com') && (part.includes('/file/d/') || part.includes('id='))) {
      let fileId = '';
      const matchD = part.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (matchD && matchD[1]) {
        fileId = matchD[1];
      } else {
        const matchId = part.match(/id=([a-zA-Z0-9_-]+)/);
        if (matchId && matchId[1]) fileId = matchId[1];
      }
      if (fileId) {
        results.push({ url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` });
        continue;
      }
    }

    if (!part.startsWith('http')) {
      results.push({ url: `https://pub-your-r2-domain.com/pet-images/${part}` });
      continue;
    }
    results.push({ url: part });
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

// Xử lý 10 bản ghi cùng lúc
async function processBatch(batch: any[]) {
  for (const row of batch) {
    const name = row['Tên thú cưng'] || row['Tên'] || row['Name'] || row['ID'] || 'Bé Không Tên';
    
    // Tự động phân loại Mèo/Chó dựa theo từ khóa trong Excel, mặc định là DOG
    const loaiStr = String(row['Loài'] || row['Giống'] || '').toLowerCase();
    const speciesType = loaiStr.includes('mèo') ? 'CAT' : 'DOG';

    try {
      const status = parseStatus(row['Tình trạng']);
      const description = [row['Lưu ý'], row['Ghi chú'], row['Cột 1']].filter(Boolean).join('. ');
      const shelterId = await getOrCreateShelter(row['Khu']);
      const imagesData = await extractImages(row['Ảnh']);

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
      process.stdout.write(`❌ Lỗi ${name} | `);
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

  console.log(`\n⏳ Đang đọc file Excel (có thể mất vài giây)...`);
  let workbook: any = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const allRecords = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  // TỐI QUAN TRỌNG: Giải phóng file Excel khổng lồ khỏi RAM ngay sau khi lấy được data
  workbook = null; 
  if (global.gc) {
    global.gc();
  }

  console.log(`✅ Đã nạp thành công ${allRecords.length} dòng. Bắt đầu seed từng lô 10 bé...`);

  const BATCH_SIZE = 10;
  let successCount = 0;

  // Chạy vòng lặp chia nhỏ lô
  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Đang xử lý lô từ ${i + 1} đến ${Math.min(i + BATCH_SIZE, allRecords.length)} / ${allRecords.length}`);
    
    await processBatch(batch);
    successCount += batch.length;

    console.log(`\n💤 Đã xong lô. Nghỉ 3 giây để VPS nhả RAM...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Ép Nodejs dọn rác thủ công sau mỗi 10 bé
    if (global.gc) {
      global.gc();
    }
  }
  
  console.log(`\n🎉 HOÀN TẤT TOÀN BỘ! Đã seed thành công ${successCount} bé.`);
}

seedPets()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('\n❌ Tiến trình seed thất bại:', e);
    await prisma.$disconnect();
    process.exit(1);
  });