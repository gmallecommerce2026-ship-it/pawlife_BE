/**
 * Xoá 3 category: "Quán ăn" (eatery), "Trà và Café" (cafe), "Trà sữa" (milk_tea).
 *
 * Place.categoryId là bắt buộc nên KHÔNG xoá thẳng được. Với mỗi category bị xoá:
 *   1) chuyển toàn bộ Place sang category đích (cập nhật cả categoryText)
 *   2) xoá category (cùng 1 transaction với bước chuyển place)
 *   3) đổi categoryKeys của PlaceSubmission sang key đích
 *
 * Chạy:
 *   npx ts-node src/database/prisma/remove-place-categories.ts --dry-run   # chỉ xem kế hoạch
 *   npx ts-node src/database/prisma/remove-place-categories.ts             # xoá thật
 *
 * Đổi category đích (mặc định bên dưới chỉ là gợi ý, kiểm tra ở bước dry-run):
 *   --map=eatery:restaurant,cafe:drinks,milk_tea:drinks
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

// Category cần xoá (khớp theo key hoặc tên tiếng Việt)
const REMOVE_KEYS = ['eatery', 'cafe', 'milk_tea'];
const REMOVE_NAMES_VI = ['Quán ăn', 'Trà và Café', 'Trà sữa'];

// Category đích mặc định cho từng category bị xoá
const DEFAULT_TARGETS: Record<string, string> = {
  eatery: 'restaurant',
  cafe: 'drinks',
  milk_tea: 'drinks',
};
// Dùng khi category tìm thấy theo tên nhưng key không nằm trong DEFAULT_TARGETS
const FALLBACK_TARGET = 'restaurant';

const CLI_MAP: Record<string, string> = Object.fromEntries(
  (process.argv.find((a) => a.startsWith('--map='))?.split('=')[1] ?? '')
    .split(',')
    .map((p) => p.split(':').map((s) => s.trim()))
    .filter((p) => p.length === 2 && p[0] && p[1]),
);

async function main() {
  console.log(`Xoá category${DRY_RUN ? ' (DRY-RUN: không ghi/xoá gì)' : ''}...`);

  const found = await prisma.placeCategory.findMany({
    where: { OR: [{ key: { in: REMOVE_KEYS } }, { nameVi: { in: REMOVE_NAMES_VI } }] },
    include: { _count: { select: { places: true } } },
  });

  if (found.length === 0) {
    console.log('Không tìm thấy category nào khớp trong DB. Có thể đã xoá rồi.');
    return;
  }

  const removeIds = new Set(found.map((c) => c.id));
  const removeKeySet = new Set(found.map((c) => c.key));

  // Xác định category đích và kiểm tra tồn tại
  const targetKeys = new Set<string>();
  const plan = found.map((c) => {
    const targetKey = CLI_MAP[c.key] ?? DEFAULT_TARGETS[c.key] ?? FALLBACK_TARGET;
    targetKeys.add(targetKey);
    return { cat: c, targetKey };
  });

  const targets = await prisma.placeCategory.findMany({ where: { key: { in: [...targetKeys] } } });
  const targetByKey = new Map(targets.map((t) => [t.key, t]));

  console.log('\n================ KẾ HOẠCH ================');
  let invalid = false;
  for (const p of plan) {
    const target = targetByKey.get(p.targetKey);
    if (!target) {
      console.log(`[${p.cat.key}] "${p.cat.nameVi}" -> "${p.targetKey}" KHÔNG TỒN TẠI trong DB`);
      invalid = true;
    } else if (removeIds.has(target.id)) {
      console.log(`[${p.cat.key}] "${p.cat.nameVi}" -> "${p.targetKey}" cũng nằm trong danh sách bị xoá`);
      invalid = true;
    } else {
      console.log(`[${p.cat.key}] "${p.cat.nameVi}" (${p.cat._count.places} place) -> [${target.key}] "${target.nameVi}"`);
    }
  }
  console.log('==========================================\n');

  if (invalid) {
    console.error('Có category đích không hợp lệ. Dùng --map=old:new để chọn lại rồi chạy lại.');
    process.exit(1);
  }
  if (DRY_RUN) {
    console.log('Dry-run xong, chưa xoá gì.');
    return;
  }

  // 1) Chuyển place + xoá category (mỗi category 1 transaction)
  const keyMap = new Map<string, string>(); // old key -> new key
  let movedPlaces = 0;
  let deletedCats = 0;

  for (const p of plan) {
    const target = targetByKey.get(p.targetKey)!;
    try {
      const [moved] = await prisma.$transaction([
        prisma.place.updateMany({
          where: { categoryId: p.cat.id },
          data: { categoryId: target.id, categoryText: { vi: target.nameVi, en: target.nameEn } },
        }),
        prisma.placeCategory.delete({ where: { id: p.cat.id } }),
      ]);
      keyMap.set(p.cat.key, target.key);
      movedPlaces += moved.count;
      deletedCats++;
      console.log(`${p.cat.key} -> ${target.key}: chuyển ${moved.count} place, đã xoá category.`);
    } catch (e: any) {
      console.error(`Lỗi với category ${p.cat.key}, giữ nguyên (không mất dữ liệu):`, e.message);
    }
  }

  // 2) Đổi categoryKeys của PlaceSubmission (Json) sang key mới
  if (keyMap.size > 0) {
    const subs = await prisma.placeSubmission.findMany({ select: { id: true, categoryKeys: true } });
    let updatedSubs = 0;
    for (const s of subs) {
      if (!Array.isArray(s.categoryKeys)) continue;
      const before = s.categoryKeys as string[];
      if (!before.some((k) => removeKeySet.has(k))) continue;
      const after = [...new Set(before.map((k) => keyMap.get(k) ?? k))];
      await prisma.placeSubmission.update({ where: { id: s.id }, data: { categoryKeys: after } });
      updatedSubs++;
    }
    console.log(`Đã cập nhật categoryKeys của ${updatedSubs} đơn đăng ký địa điểm.`);
  }

  console.log(`\nXong: chuyển ${movedPlaces} place, xoá ${deletedCats}/${plan.length} category.`);
  if (deletedCats < plan.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('Lỗi nghiêm trọng:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());