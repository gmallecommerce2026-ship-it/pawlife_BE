import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// MASTER DICTIONARY (2-WAY MAPPING)
// ==========================================
const MASTER_DICT: Record<string, string> = {
  // Loài (Species)
  "Chó": "Dog", "Mèo": "Cat", "Chuột": "Hamster", "Thỏ": "Rabbit",

  // Giống Chó (Dog Breeds từ danh mục của bạn)
  "Không rõ giống": "Unknown Breed",
  "Giống lai": "Mixed Breed",
  "Chó ta (Việt Nam)": "VN Local Dog",
  "Poodle": "Poodle",
  "Phốc sóc (Pomeranian)": "Pomeranian",
  "Corgi": "Corgi",
  "Golden Retriever": "Golden Retriever",
  "Labrador Retriever": "Labrador Retriever",
  "Chihuahua": "Chihuahua",
  "Bulldog Pháp": "French Bulldog",
  "Husky": "Husky",
  "Shiba Inu": "Shiba Inu",
  "Samoyed": "Samoyed",
  "Dachshund (Lạp xưởng)": "Dachshund",
  "Beagle": "Beagle",
  "Pug": "Pug",
  "Border Collie": "Border Collie",
  "Maltese": "Maltese",
  "Yorkshire Terrier": "Yorkshire Terrier",
  "Schnauzer": "Schnauzer",
  "Chow Chow": "Chow Chow",
  "Alaskan Malamute": "Alaskan Malamute",
  "Akita": "Akita",
  "Doberman": "Doberman",
  "Rottweiler": "Rottweiler",
  "Chó Bécgiê Đức": "German Shepherd",
  "Chó xoáy Phú Quốc": "Phu Quoc Ridgeback",
  "Chó Bắc Hà": "Bac Ha Dog",
  "Chó cộc H'Mông": "H’Mong Bobtail",

  // Giống Mèo (Cat Breeds từ danh mục của bạn)
  "Mèo nhà": "Domestic Cat",
  "British Shorthair (Lông ngắn Anh)": "British Shorthair",
  "Scottish Fold (Tai cụp Scotland)": "Scottish Fold",
  "Munchkin": "Munchkin",
  "Mèo Ba Tư": "Persian",
  "Ragdoll": "Ragdoll",
  "Maine Coon": "Maine Coon",
  "Bengal": "Bengal",
  "Sphynx (Mèo không lông)": "Sphynx",
  "Mèo Nga xanh": "Russian Blue",
  "Mèo Xiêm (Siamese)": "Siamese",
  "Exotic Shorthair": "Exotic Shorthair",
  "Mèo vân (Tabby)": "Tabby Cat",
  "Mèo cam": "Orange Cat",
  "Mèo đen": "Black Cat",
  "Mèo trắng": "White Cat",
  "Mèo tam thể": "Calico Cat",
  "Mèo tuxedo": "Tuxedo Cat",
  "Mèo lai Xiêm": "Siamese Mix",
  "Mèo lông dài": "Long Hair",
  "Mèo lông ngắn": "Short Hair",

  // Màu lông phổ biến
  "Vàng rơm": "Straw yellow", "Vàng": "Yellow", "Xám Trắng": "Grey & White",
  "Chưa rõ": "Unknown", "Đang cập nhật": "Updating",

  // Tính cách & Hành vi (Good with / Bad with)
  "Trẻ em": "Children", "Chó khác": "Other dogs", "Người cao tuổi": "Seniors",
  "Người lạ": "Strangers", "Gia đình đông người": "Large families",
  "Trẻ em ồn ào": "Noisy children", "Không gian hẹp": "Confined spaces",
  "Chó lớn": "Large dogs", "Động vật nhỏ": "Small animals", "Ở một mình quá lâu": "Being left alone",

  // Các câu Fallback mặc định của hệ thống
  "Chưa có thông tin mô tả chi tiết cho bé.": "No detailed description available for this pet yet.",
  "Trạm cứu hộ chưa thiết lập tiêu chí nhà ở cho bé. Hãy liên hệ trực tiếp để biết thêm chi tiết.": "The shelter hasn't specified the ideal home conditions for this pet yet. Contact them for more details."
};

// Khởi tạo từ điển đảo ngược (English -> Vietnamese) để tra cứu hai chiều linh hoạt
const REVERSE_DICT: Record<string, string> = {};
for (const [viKey, enVal] of Object.entries(MASTER_DICT)) {
  REVERSE_DICT[enVal.toLowerCase().trim()] = viKey;
}

// Hàm dịch phân tách thông minh cho mảng chuỗi hoặc chuỗi dài ngăn cách bởi dấu phẩy/chấm
function translateSegment(text: string, toLang: 'vi' | 'en'): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (toLang === 'en') {
    if (MASTER_DICT[trimmed]) return MASTER_DICT[trimmed];
    // Tìm kiếm tương đối không phân biệt hoa thường đối với các cụm từ trong cụm danh mục
    const match = Object.keys(MASTER_DICT).find(k => k.toLowerCase() === trimmed.toLowerCase());
    return match ? MASTER_DICT[match] : trimmed;
  } else {
    if (REVERSE_DICT[trimmed.toLowerCase()]) return REVERSE_DICT[trimmed.toLowerCase()];
    return trimmed;
  }
}

function processTextOrArray(value: any, targetLang: 'vi' | 'en'): any {
  if (!value) return value;

  // Nếu là mảng chuỗi (Dạng array lưu trong Json)
  if (Array.isArray(value)) {
    return value.map(item => translateSegment(String(item), targetLang));
  }

  // Nếu là chuỗi đơn lẻ ngăn cách bởi dấu phẩy hoặc dấu chấm
  if (typeof value === 'string') {
    const delimiters = [',', '.', ';'];
    let currentData = [value];

    for (const delimiter of delimiters) {
      const nextData: string[] = [];
      for (const segment of currentData) {
        if (segment.includes(delimiter)) {
          const parts = segment.split(delimiter).map(p => translateSegment(p, targetLang));
          nextData.push(parts.join(delimiter + ' '));
        } else {
          nextData.push(segment);
        }
      }
      currentData = nextData;
    }
    
    // Nếu bóc tách chuỗi ra trùng với từ điển đơn lẻ thì trả về kết quả map luôn
    if (currentData.length === 1 && currentData[0] === value) {
      return translateSegment(value, targetLang);
    }
    return currentData[0].replace(/\s+/g, ' ').trim();
  }

  return value;
}

function fixJsonBilingual(fieldData: any): any {
  if (!fieldData) return fieldData;
  let obj = typeof fieldData === 'string' ? JSON.parse(fieldData) : fieldData;
  if (obj.vi === undefined || obj.en === undefined) return fieldData;

  const viStr = JSON.stringify(obj.vi).trim();
  const enStr = JSON.stringify(obj.en).trim();

  // Phát hiện trùng lặp dữ liệu giữa hai trường tiếng Anh và tiếng Việt
  if (viStr === enStr) {
    // Thử kiểm tra xem nội dung đang lưu là tiếng Anh hay tiếng Việt
    const sampleText = Array.isArray(obj.vi) ? String(obj.vi[0]) : String(obj.vi);
    const isEnglishSource = REVERSE_DICT[sampleText.toLowerCase().trim()] !== undefined || 
                            Object.values(MASTER_DICT).some(v => v.toLowerCase() === sampleText.toLowerCase().trim());

    if (isEnglishSource) {
      // Nguồn gốc dữ liệu hiện tại đang là tiếng Anh -> Dịch ngược khóa vi sang tiếng Việt
      return {
        vi: processTextOrArray(obj.vi, 'vi'),
        en: obj.en
      };
    } else {
      // Nguồn gốc dữ liệu hiện tại đang là tiếng Việt -> Dịch xuôi khóa en sang tiếng Anh
      return {
        vi: obj.vi,
        en: processTextOrArray(obj.vi, 'en')
      };
    }
  }

  return obj;
}

async function main() {
  console.log('⏳ Bắt đầu Migration V2: Chuẩn hóa song ngữ Deep-Clean cho Breed, About, Behaviors, IdealHome...');

  const pets = await prisma.pet.findMany();
  let updatedPetsCount = 0;

  for (const pet of pets) {
    const updatedSpecies = fixJsonBilingual(pet.species);
    const updatedBreed = fixJsonBilingual(pet.breed);
    const updatedColor = fixJsonBilingual(pet.color);
    const updatedDescription = fixJsonBilingual(pet.description);
    const updatedIdealHome = fixJsonBilingual(pet.idealHome);
    const updatedGoodWith = fixJsonBilingual(pet.goodWith);
    const updatedBadWith = fixJsonBilingual(pet.badWith);
    const updatedPersonalityTags = fixJsonBilingual(pet.personalityTags);

    const hasChange =
      JSON.stringify(updatedSpecies) !== JSON.stringify(pet.species) ||
      JSON.stringify(updatedBreed) !== JSON.stringify(pet.breed) ||
      JSON.stringify(updatedColor) !== JSON.stringify(pet.color) ||
      JSON.stringify(updatedDescription) !== JSON.stringify(pet.description) ||
      JSON.stringify(updatedIdealHome) !== JSON.stringify(pet.idealHome) ||
      JSON.stringify(updatedGoodWith) !== JSON.stringify(pet.goodWith) ||
      JSON.stringify(updatedBadWith) !== JSON.stringify(pet.badWith) ||
      JSON.stringify(updatedPersonalityTags) !== JSON.stringify(pet.personalityTags);

    if (hasChange) {
      await prisma.pet.update({
        where: { id: pet.id },
        data: {
          species: updatedSpecies,
          breed: updatedBreed,
          color: updatedColor,
          description: updatedDescription,
          idealHome: updatedIdealHome,
          goodWith: updatedGoodWith,
          badWith: updatedBadWith,
          personalityTags: updatedPersonalityTags
        }
      });
      updatedPetsCount++;
      console.log(`✅ Đã làm sạch & sửa cấu trúc song ngữ: ${pet.name}`);
    }
  }

  console.log('\n==================================================');
  console.log(`🎉 HOÀN TẤT MIGRATION BỔ SUNG V2!`);
  console.log(`📝 Tổng số bản ghi Pet cấu trúc lại thành công: ${updatedPetsCount}`);
  console.log('==================================================');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Lỗi khi thực thi script migration:', e);
    await prisma.$disconnect();
    process.exit(1);
  });