// src/scripts/seed-ingredient-defaults.ts
//
// Seed 1 lần cho TOÀN BỘ ingredient hiện có trong DB: áp default theo badge
// cho các field còn thiếu (actionGuide, details.whyTitle/symptomsTitle,
// benefits.benefitsTitle/feedingTitle) — KHÔNG đụng vào nội dung thật đã có
// (why/symptoms/benefits/feeding do admin tự gõ vẫn được giữ nguyên).
//
// Chạy trên VPS (trong thư mục gốc project BE):
//   npx ts-node src/scripts/seed-ingredient-defaults.ts            # xem trước (dry-run)
//   npx ts-node src/scripts/seed-ingredient-defaults.ts --apply    # ghi thật vào DB
//
// Nếu chưa có ts-node: npm i -D ts-node

import { PrismaClient } from '@prisma/client';
import { applyBadgeDefaults, Badge } from 'src/modules/ingredients/ingredient-defaults';

const prisma = new PrismaClient();

async function main() {
  const isApply = process.argv.includes('--apply');

  const ingredients = await prisma.ingredient.findMany();
  console.log(`Tìm thấy ${ingredients.length} ingredient.\n`);

  for (const ing of ingredients) {
    const badge = ing.badge as Badge;

    const merged = applyBadgeDefaults(badge, {
      actionGuide: ing.actionGuide as any,
      details: ing.details as any,
      benefits: ing.benefits as any,
    });

    console.log(
      `${isApply ? '[APPLY]  ' : '[DRY-RUN]'} ${ing.id}  (badge=${badge}, tên="${
        (ing.title as any)?.vi ?? ''
      }")`,
    );

    if (isApply) {
      await prisma.ingredient.update({
        where: { id: ing.id },
        data: merged,
      });
    }
  }

  console.log(
    `\nXong. ${
      isApply
        ? 'Đã ghi vào DB.'
        : 'Đây mới là xem trước — chạy lại kèm --apply để ghi thật vào DB.'
    }`,
  );
}

main()
  .catch((err) => {
    console.error('Seed lỗi:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });