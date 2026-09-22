import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('⏳ Đang xuất dữ liệu Pet ra file JSON...');

  const pets = await prisma.pet.findMany();
  
  // Chỉ lấy ID, Tên (để dễ nhìn) và các trường JSON cần dịch
  const exportData = pets.map(pet => ({
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    color: pet.color,
    description: pet.description,
    idealHome: pet.idealHome,
    goodWith: pet.goodWith,
    badWith: pet.badWith,
    personalityTags: pet.personalityTags,
  }));

  // Lưu ra file ở thư mục gốc của dự án
  const outputPath = path.join(process.cwd(), 'pets-translation-data.json');
  
  // Lưu định dạng JSON có xuống dòng (indent 2 spaces) để bạn dễ dàng sửa bằng tay
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

  console.log(`\n🎉 HOÀN TẤT! Đã xuất thành công ${exportData.length} bé Pet.`);
  console.log(`📁 File được lưu tại: ${outputPath}`);
  console.log(`💡 Mở file này bằng VSCode, chỉnh sửa các value trong khóa "en", lưu lại rồi chạy file Import.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Lỗi xuất file:', e);
    await prisma.$disconnect();
    process.exit(1);
  });