import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(process.cwd(), 'pets-translation-data.json');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Không tìm thấy file: ${filePath}`);
    console.log('Hãy chạy file export trước hoặc kiểm tra lại tên file!');
    process.exit(1);
  }

  console.log('⏳ Đang đọc file và nạp dữ liệu lên Database...');
  
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const petsData = JSON.parse(rawData);
  let updatedCount = 0;

  // Lặp qua từng object trong mảng và update lại vào CSDL dựa theo ID
  for (const pet of petsData) {
    if (!pet.id) continue;

    await prisma.pet.update({
      where: { id: pet.id },
      data: {
        species: pet.species,
        breed: pet.breed,
        color: pet.color,
        description: pet.description,
        idealHome: pet.idealHome,
        goodWith: pet.goodWith,
        badWith: pet.badWith,
        personalityTags: pet.personalityTags,
      }
    });

    updatedCount++;
    process.stdout.write(`\r✅ Đã cập nhật thành công bé: ${pet.name} (${updatedCount}/${petsData.length})`);
  }

  console.log(`\n\n🎉 HOÀN TẤT! Đã đồng bộ thành công ${updatedCount} bản ghi lên Database.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('\n❌ Lỗi khi import:', e);
    await prisma.$disconnect();
    process.exit(1);
  });