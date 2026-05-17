import { PrismaClient, PetGender, PetSize, PetStatus } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';
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
    console.error(`⚠️ Lỗi quét folder Drive ${folderId} (Có thể chưa share public hoặc sai API Key):`, error.message);
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

export async function seedPets() {
  console.log('Bắt đầu quá trình seed dữ liệu từ file Excel...');
  console.log('Đang dọn dẹp dữ liệu cũ...');
  
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
  console.log('Đang xóa dữ liệu Pet và Shelter...');
  await prisma.pet.deleteMany(); 
  await prisma.followedShelter.deleteMany();
  await prisma.shelter.deleteMany();
  console.log('Đã xóa xong dữ liệu cũ!');

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
          address: 'Đang cập nhật từ Excel',
          contactInfo: '0999999999',
          description: 'Trạm cứu hộ được tạo tự động từ hệ thống Excel.',
          policy: '1. Liên hệ trực tiếp trạm để nhận nuôi.',
          avatarUrl: 'https://loremflickr.com/200/200/house',
          latitude: 21.028511, 
          longitude: 105.804817,
        }
      });
    }
    shelterCache.set(name, shelter.id);
    return shelter.id;
  }

  const excelPath = path.join(process.cwd(), 'prisma/data/cho_meo.xlsx');
  const workbook = xlsx.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = xlsx.utils.sheet_to_json(sheet);
  let count = 0;

  console.log(`Tổng số bản ghi cần xử lý: ${records.length}`);

  // ĐÃ SỬA: Chuyển sang vòng lặp for truyền thống để kiểm soát tiến trình và giải phóng bộ nhớ
  for (let i = 0; i < records.length; i++) {
    const row = records[i] as any;
    const name = row['Tên thú cưng'] || row['Tên'] || row['Name'] || row['ID'] || 'Bé Không Tên';
    const status = parseStatus(row['Tình trạng']);
    const description = [row['Lưu ý'], row['Ghi chú'], row['Cột 1']].filter(Boolean).join('. ');
    const shelterId = await getOrCreateShelter(row['Khu']);
    
    const imagesData = await extractImages(row['Ảnh']);

    try {
      await prisma.pet.create({
        data: {
          name: String(name),
          species: 'DOG',
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
          images: {
            create: imagesData
          }
        }
      });
      count++;
    } catch (error: any) {
      console.error(`❌ Lỗi khi seed ID ${row['ID']}:`, error.message);
    }

    // XỬ LÝ OOM: Dọn rác bộ nhớ sau mỗi 20 bản ghi
    if (i > 0 && i % 20 === 0) {
      console.log(`Đã xử lý ${i}/${records.length} bé. Đang dọn dẹp bộ nhớ...`);
      // Nhường Event Loop 100ms cho Garbage Collector chạy
      await new Promise(resolve => setTimeout(resolve, 100));
      // Ép Node.js dọn rác ngay lập tức
      if (global.gc) {
        global.gc();
      }
    }
  }
  
  console.log(`✅ Đã seed thành công ${count} bé từ file Excel.`);
}

seedPets()
  .then(async () => {
    console.log('🏁 Tiến trình seed hoàn tất.');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Tiến trình seed thất bại dữ dội:', e);
    await prisma.$disconnect();
    process.exit(1);
  });