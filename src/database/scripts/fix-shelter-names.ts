// scripts/fix-shelter-names.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.env.DRY_RUN === 'true';

async function main() {
  const shelters = await prisma.shelter.findMany({
    where: { name: { endsWith: 'Shelter' } },
    select: { id: true, name: true },
  });

  console.log(`Tìm thấy ${shelters.length} shelter có tên kết thúc bằng "Shelter".`);
  if (isDryRun) console.log('🔍 Đang chạy DRY RUN — sẽ KHÔNG ghi vào DB.\n');

  let updatedCount = 0;

  for (const shelter of shelters) {
    // Chỉ xoá khi "Shelter" đứng tách riêng như 1 từ ở cuối (có khoảng trắng phía trước)
    // VD: "Happy Tails Shelter" -> "Happy Tails"
    // Không đụng vào các tên viết liền kiểu "PetShelter"
    const newName = shelter.name.replace(/\s+Shelter$/i, '').trim();

    if (!newName) {
      console.warn(`⚠️  Bỏ qua "${shelter.name}" (id: ${shelter.id}) — tên sau khi xoá sẽ rỗng.`);
      continue;
    }
    if (newName === shelter.name) continue; // không match -> giữ nguyên

    console.log(`${isDryRun ? '👉' : '✅'} "${shelter.name}" -> "${newName}"`);

    if (!isDryRun) {
      await prisma.shelter.update({
        where: { id: shelter.id },
        data: { name: newName },
      });
    }
    updatedCount++;
  }

  console.log(`\nHoàn tất. ${isDryRun ? 'Sẽ cập nhật' : 'Đã cập nhật'} ${updatedCount}/${shelters.length} shelter.`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi chạy script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });