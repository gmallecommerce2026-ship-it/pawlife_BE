import { PrismaClient, PetSize } from '@prisma/client';

const prisma = new PrismaClient();

// Hàm định nghĩa luật tính size
const calculateSize = (species: string | null, weight: number | null): PetSize => {
  if (!weight) return PetSize.MEDIUM; // Mặc định nếu không có cân nặng
  
  const s = species?.toUpperCase() || 'DOG';
  
  if (s === 'DOG') {
    if (weight < 3) return PetSize.SMALL;
    if (weight < 7) return PetSize.MEDIUM;
    return PetSize.LARGE;
  }
  
  if (s === 'CAT') {
    if (weight < 3) return PetSize.SMALL;
    if (weight < 5) return PetSize.MEDIUM;
    return PetSize.LARGE;
  }

  return PetSize.MEDIUM;
};

async function main() {
  console.log("🔄 Bắt đầu cập nhật Size cho TOÀN BỘ thú cưng trong hệ thống...");

  // Lấy toàn bộ pet không phân biệt chủ sở hữu
  const pets = await prisma.pet.findMany({
    select: { id: true, name: true, weight: true, species: true }
  });

  let count = 0;
  for (const pet of pets) {
    const newSize = calculateSize(pet.species, pet.weight);
    
    await prisma.pet.update({
      where: { id: pet.id },
      data: { size: newSize },
    });
    
    count++;
    if (count % 10 === 0) console.log(`...đã cập nhật ${count}/${pets.length} bé`);
  }

  console.log(`✨ Hoàn tất! Đã cập nhật xong ${count} thú cưng.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });