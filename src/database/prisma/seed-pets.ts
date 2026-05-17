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

// Helper 4: XỬ LÝ LINK ẢNH - TỰ ĐỘNG MAP LINK DRIVE THÀNH LINK ẢNH TRỰC TIẾP (ĐÃ NÂNG CẤP)
function extractImages(imageStr: any): { url: string }[] {
  if (!imageStr) return [{ url: 'https://loremflickr.com/400/400/dog' }];
  
  // Tách các link ảnh nếu trong 1 ô Excel cách nhau bằng dấu phẩy
  const parts = String(imageStr).split(',').map(s => s.trim()).filter(s => s);
  if (parts.length === 0) return [{ url: 'https://loremflickr.com/400/400/dog' }];

  return parts.map(part => {
    // Trường hợp 1: Nếu là link file đơn lẻ của Google Drive (chứa /file/d/ hoặc id=)
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
        // Chuyển sang link stream ảnh trực tiếp cho Frontend hiển thị được ngay
        return { url: `https://docs.google.com/uc?export=view&id=${fileId}` };
      }
    }

    // Trường hợp 2: Nếu ô đó chứa link cả Thư mục lớn (Folder), bọc fallback ảnh mặc định kèm log để bạn theo dõi
    if (part.includes('drive.google.com') && part.includes('/folders/')) {
      console.warn(`⚠️ Phát hiện link dạng Thư mục (Folder) Drive thay vì link ảnh cụ thể: ${part}`);
      return { url: 'https://loremflickr.com/400/400/dog' };
    }

    // Trường hợp 3: Ô chứa tên file thuần túy như "900263000671193.png" (bị thiếu domain)
    if (!part.startsWith('http')) {
      // Nếu sau này bạn đưa ảnh lên R2/S3 Cloud Storage, hãy thay domain của bạn vào đây
      return { url: `https://pub-your-r2-domain.com/pet-images/${part}` };
    }

    // Trường hợp 4: Link ảnh dạng http/https thông thường khác
    return { url: part };
  });
}

export async function seedPets() {
  console.log('Bắt đầu quá trình seed dữ liệu từ file Excel...');
  console.log('Đang dọn dẹp dữ liệu cũ (Xóa các bản ghi liên quan để tránh lỗi khóa ngoại)...');
  
  // 1. Dọn dẹp an toàn tuyệt đối theo thứ tự (Tránh lỗi Foreign Key)
  await prisma.eventImage.deleteMany();
  await prisma.eventInterest.deleteMany();
  await prisma.event.deleteMany();
  await prisma.tagReport.deleteMany(); 
  
  // Gỡ liên kết Tag trước khi xóa Pet
  await prisma.tag.updateMany({
    where: { petId: { not: null } },
    data: { petId: null },
  });
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

  // 2. Tạo Shelter với TỌA ĐỘ MẶC ĐỊNH (Rất quan trọng cho App)
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
          policy: '1. Liên hệ trực tiếp trạm để nhận nuôi.\n2. Cần chuẩn bị đủ điều kiện kinh tế.',
          avatarUrl: 'https://loremflickr.com/200/200/house',
          latitude: 21.028511, 
          longitude: 105.804817,
        }
      });
    }
    shelterCache.set(name, shelter.id);
    return shelter.id;
  }

  // Đọc file Excel trực tiếp
  const excelPath = path.join(process.cwd(), 'prisma/data/cho_meo.xlsx');
  const workbook = xlsx.readFile(excelPath);
  
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  
  const records = xlsx.utils.sheet_to_json(sheet);
  let count = 0;

  for (const row of records as any[]) {
    // Đã sửa lại việc gán tên: Ưu tiên tìm cột 'Tên thú cưng', 'Tên', 'Name', rồi mới tới 'ID'
    const name = row['Tên thú cưng'] || row['Tên'] || row['Name'] || row['ID'] || 'Bé Chó Không Tên';
    const species = 'DOG'; 
    const breed = row['Giống'] || 'Chưa rõ';
    const color = row['Màu lông'] || 'Đang cập nhật';
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
          size: PetSize.MEDIUM, 
          isSpayedNeutered,
          isVaccinated,
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
  }
  
  console.log(`✅ Đã seed thành công ${count} bé chó từ file Excel.`);
}

seedPets()
  .then(async () => {
    console.log('🏁 Tiến trình seed hoàn tất không có lỗi.');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Tiến trình seed thất bại dữ dội:', e);
    await prisma.$disconnect();
    process.exit(1);
  });