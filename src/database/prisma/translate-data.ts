import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DICT_PATH = path.join(__dirname, 'dictionary.json');

// 🤖 Tự động dịch các từ khóa ngắn phổ biến (Bạn có thể thêm bớt tùy ý)
const AUTO_DICTIONARY: Record<string, string> = {
  "Chó": "Dog",
  "Mèo": "Cat",
  "Chó Corgi": "Corgi",
  "Poodle": "Poodle",
  "Mèo Anh lông ngắn": "British Shorthair",
  "Mèo ta": "Domestic Cat",
  "Chó cỏ": "Domestic Dog",
  "Màu vàng": "Yellow",
  "Màu trắng": "White",
  "Màu đen": "Black",
  "Nhị thể": "Bicolor",
  "Tam thể": "Calico",
  "Mướp": "Tabby",
  "còn đuôi": "has tail",
  "cụt đuôi": "bobtail"
};

// 🔧 Sửa lỗi: Hàm an toàn để mở hộp JSON bị stringified từ Database
const parseJsonSafely = (val: any) => {
  if (!val) return null;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }
  return typeof val === 'object' ? val : null;
};

const addTextToDict = (dict: Record<string, string>, rawVal: any) => {
  const jsonVal = parseJsonSafely(rawVal);
  if (jsonVal && typeof jsonVal.vi === 'string') {
    const text = jsonVal.vi.trim();
    // Bỏ qua nếu là chuỗi rỗng, hoặc đã có trong AUTO_DICTIONARY
    if (text && !AUTO_DICTIONARY[text] && !dict[text]) {
      dict[text] = text; // Thêm vào file để user dịch tay
    }
  }
};

const getTranslatedJson = (dict: Record<string, string>, rawVal: any) => {
  const jsonVal = parseJsonSafely(rawVal);
  if (jsonVal && typeof jsonVal.vi === 'string') {
    const text = jsonVal.vi.trim();
    // Ưu tiên từ điển tự động trước, sau đó mới lấy từ file manual
    const translatedText = AUTO_DICTIONARY[text] || dict[text];
    
    if (translatedText && translatedText !== text) {
      return { ...jsonVal, en: translatedText };
    }
    return jsonVal; // Giữ nguyên nếu chưa dịch
  }
  return rawVal; // Giữ nguyên cấu trúc gốc nếu không phải JSON đa ngôn ngữ
};

async function extract() {
  console.log('⏳ Đang quét toàn bộ các trường JSON ban đầu...');
  const dict: Record<string, string> = {};

  const pets = await prisma.pet.findMany();
  pets.forEach((p) => {
    // Trích xuất CHÍNH XÁC các trường JSON ban đầu
    addTextToDict(dict, p.species);
    addTextToDict(dict, p.breed);
    addTextToDict(dict, p.description);
    addTextToDict(dict, p.color);
    addTextToDict(dict, p.traits);
    addTextToDict(dict, p.idealHome);
    addTextToDict(dict, p.lostDetails);
    addTextToDict(dict, p.goodWith);
    addTextToDict(dict, p.badWith);
  });

  fs.writeFileSync(DICT_PATH, JSON.stringify(dict, null, 2), 'utf-8');
  console.log(`✅ Trích xuất thành công! Đã tìm thấy ${Object.keys(dict).length} cụm từ dài cần dịch.`);
  console.log(`📂 File lưu tại: ${DICT_PATH} (Các từ ngắn đã được AI dịch tự động ngầm)`);
}

async function apply() {
  let dict = {};
  if (fs.existsSync(DICT_PATH)) {
    dict = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));
  }

  console.log('⏳ Đang Seed cập nhật toàn bộ bản dịch (Cả Auto và Manual)...');
  
  const pets = await prisma.pet.findMany();
  let updatedCount = 0;

  for (const p of pets) {
    await prisma.pet.update({
      where: { id: p.id },
      data: {
        species: getTranslatedJson(dict, p.species) as any,
        breed: getTranslatedJson(dict, p.breed) as any,
        description: getTranslatedJson(dict, p.description) as any,
        color: getTranslatedJson(dict, p.color) as any,
        traits: getTranslatedJson(dict, p.traits) as any,
        idealHome: getTranslatedJson(dict, p.idealHome) as any,
        lostDetails: getTranslatedJson(dict, p.lostDetails) as any,
        goodWith: getTranslatedJson(dict, p.goodWith) as any,
        badWith: getTranslatedJson(dict, p.badWith) as any,
      },
    });
    updatedCount++;
  }

  console.log(`✅ Hoàn tất! Đã cập nhật song ngữ thành công cho ${updatedCount} Pet.`);
}

const mode = process.argv[2];
if (mode === 'extract') {
  extract().catch(console.error).finally(() => prisma.$disconnect());
} else if (mode === 'apply') {
  apply().catch(console.error).finally(() => prisma.$disconnect());
} else {
  console.log('⚠️ Sử dụng: npx ts-node src/database/prisma/translate-data.ts [extract | apply]');
}
