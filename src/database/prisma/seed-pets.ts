import { PrismaClient, PetGender, PetSize, PetStatus } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// Helper 1: Chuyển đổi "3 tuổi", "5 tháng" thành DateTime (dob)
function parseAgeToDob(ageStr: any): Date | null {
  if (!ageStr) return null;
  const str = String(ageStr).toLowerCase().trim();
  const now = new Date();

  const matchNum = str.match(/(\d+)/);
  if (!matchNum) return null;
  const num = parseInt(matchNum[1], 10);

  if (str.includes('tuổi') || str.includes('năm')) {
    now.setFullYear(now.getFullYear() - num);
    return now;
  }
  if (str.includes('tháng')) {
    now.setMonth(now.getMonth() - num);
    return now;
  }
  return null;
}

// Helper 2: Chuyển đổi giới tính sang Enum
function parseGender(genderStr: any): PetGender {
  const str = String(genderStr || '').toLowerCase().trim();
  if (str === 'đực') return PetGender.MALE;
  if (str === 'cái') return PetGender.FEMALE;
  return PetGender.UNKNOWN;
}

// Helper 3: Parse trạng thái nhận nuôi
function parseStatus(statusStr: any): PetStatus {
  const str = String(statusStr || '').toLowerCase().trim();
  if (str.includes('đã được nhận nuôi')) return PetStatus.ADOPTED;
  return PetStatus.AVAILABLE;
}

// Helper 4: Xử lý link ảnh (Drive, Folder, hoặc Filename)
function extractImages(imageStr: any): { url: string }[] {
  if (!imageStr) return [];
  const parts = String(imageStr).split(',').map(s => s.trim()).filter(s => s);
  return parts.map(part => ({ url: part }));
}

export async function seedPets(prisma: PrismaClient) {
  console.log('Bắt đầu quá trình seed dữ liệu từ file Excel...');

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
          contactInfo: 'Đang cập nhật',
        }
      });
    }
    shelterCache.set(name, shelter.id);
    return shelter.id;
  }

  // Đọc file Excel trực tiếp
  const excelPath = path.join(process.cwd(), 'prisma/data/cho_meo.xlsx');
  const workbook = xlsx.readFile(excelPath);
  
  // Chỉ lấy Sheet đầu tiên (vì bạn đề cập file hiện tại toàn chó)
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  
  // Chuyển đổi dữ liệu sheet thành mảng JSON
  const records = xlsx.utils.sheet_to_json(sheet);

  let count = 0;

  for (const row of records as any[]) {
    const name = row['ID'] || 'Bé Chó Không Tên';
    const species = 'Dog'; // Mặc định là chó theo dữ liệu hiện tại của bạn
    const breed = row['Giống'] || 'Chưa rõ';
    const color = row['Màu lông'] || '';
    const dob = parseAgeToDob(row['Độ tuổi']);
    const gender = parseGender(row['Giới tính']);
    
    const isSpayedNeutered = String(row['Triệt sản'] || '').toLowerCase().includes('đã triệt sản');
    const isVaccinated = String(row['Tiêm phòng'] || '').toLowerCase().includes('đã tiêm đủ');
    
    const status = parseStatus(row['Tình trạng']);
    
    const description = [row['Lưu ý'], row['Ghi chú'], row['Cột 1']].filter(Boolean).join('. ');
    
    const imagesData = extractImages(row['Ảnh']);
    const shelterId = await getOrCreateShelter(row['Khu']);

    try {
      await prisma.pet.create({
        data: {
          name: String(name),
          species,
          breed: String(breed),
          dob,
          color: String(color),
          gender,
          isSpayedNeutered,
          isVaccinated,
          status,
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
  }
  
  console.log(`✅ Đã seed thành công ${count} bé chó từ file Excel.`);
}

seedPets(prisma)
  .then(async () => {
    console.log('🏁 Tiến trình seed hoàn tất không có lỗi.');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Tiến trình seed thất bại dữ dội:', e);
    await prisma.$disconnect();
    process.exit(1);
  });