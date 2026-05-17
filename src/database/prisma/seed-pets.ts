import { PrismaClient, PetGender, PetSize, PetStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { google } from 'googleapis';

const prisma = new PrismaClient();

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

// HÀM MỚI: Đọc toàn bộ CSV lưu vào mảng, sau đó xử lý từng cụm (Batch)
async function seedFromCsv(filePath: string, speciesType: 'DOG' | 'CAT') {
  console.log(`\n⏳ Đang nạp dữ liệu từ file: ${path.basename(filePath)}...`);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Không tìm thấy file: ${filePath}`);
    return;
  }

  // 1. Nạp file CSV vào bộ nhớ (file text tốn rất ít RAM, an toàn tuyệt đối)
  const allRecords: any[] = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => allRecords.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`✅ Đã nạp thành công ${allRecords.length} dòng. Bắt đầu seed từng lô 10 bé...`);

  // 2. Chia lô 10 item một lần
  const BATCH_SIZE = 10;
  let successCount = 0;

  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Đang xử lý lô từ ${i + 1} đến ${Math.min(i + BATCH_SIZE, allRecords.length)} / ${allRecords.length}`);
    
    // Xử lý từng dòng trong cụm (Chạy tuần tự để Google Drive không chặn API do gọi quá nhanh)
    for (const row of batch) {
      const name = row['Tên thú cưng'] || row['Tên'] || row['Name'] || row['ID'] || 'Bé Không Tên';
      try {
        const status = parseStatus(row['Tình trạng']);
        const description = [row['Lưu ý'], row['Ghi chú'], row['Cột 1']].filter(Boolean).join('. ');
        const shelterId = await getOrCreateShelter(row['Khu']);
        const imagesData = await extractImages(row['Ảnh']); // Gọi API Google Drive ở đây

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
        successCount++;
        process.stdout.write(`✅ Đã thêm: ${name} | `); // Báo cáo trực tiếp từng bé một
      } catch (error: any) {
        process.stdout.write(`❌ Lỗi: ${name} | `);
      }
    }

    // 3. Cho server nghỉ ngơi 3 giây để làm trống RAM và mạng
    console.log(`\n💤 Đã xong lô. Nghỉ 3 giây để VPS nhả RAM...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Ép Nodejs dọn rác
    if (global.gc) {
      global.gc();
    }
  }
  
  console.log(`\n🎉 Hoàn tất file. Đã seed thành công ${successCount} bé ${speciesType}.`);
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

  const dogCsvPath = path.join(process.cwd(), 'prisma/data/cho_meo.xlsx - TT chó lụm.csv');
  const catCsvPath = path.join(process.cwd(), 'prisma/data/cho_meo.xlsx - TT mèo.csv');

  await seedFromCsv(dogCsvPath, 'DOG');
  await seedFromCsv(catCsvPath, 'CAT');
}

seedPets()
  .then(async () => {
    console.log('\n🏁 TẤT CẢ TIẾN TRÌNH SEED HOÀN TẤT!');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('\n❌ Tiến trình seed thất bại:', e);
    await prisma.$disconnect();
    process.exit(1);
  });