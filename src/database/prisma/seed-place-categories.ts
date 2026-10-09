/**
 * Seed danh mục (PlaceCategory) cho Pawly Place.
 *
 * Luồng:
 *   1) Upsert 11 category chuẩn (theo key). Category đã tồn tại thì cập nhật tên/thứ tự,
 *      GIỮ NGUYÊN icon đang có.
 *   2) Với mỗi category cũ không nằm trong danh sách chuẩn:
 *        - chuyển toàn bộ Place sang category chuẩn phù hợp (cập nhật cả categoryText)
 *        - chuyển categoryKeys của PlaceSubmission sang key mới
 *        - rồi mới xoá category cũ (cùng 1 transaction với bước chuyển place)
 *
 * Chạy:
 *   npx ts-node src/database/prisma/seed-place-categories.ts --dry-run   # chỉ xem kế hoạch
 *   npx ts-node src/database/prisma/seed-place-categories.ts             # chạy thật
 *
 * Cờ tuỳ chọn:
 *   --fallback=eatery   category dùng khi không đoán được category cũ thuộc nhóm nào (mặc định: eatery)
 *   --map=old_key:new_key,old_key2:new_key2   ép ánh xạ thủ công (ưu tiên cao nhất)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const FALLBACK_KEY = process.argv.find((a) => a.startsWith('--fallback='))?.split('=')[1] ?? 'eatery';

// ---------------------------------------------------------------------------
// DANH SÁCH CATEGORY CHUẨN (sửa icon ở đây cho khớp với FE nếu cần)
// ---------------------------------------------------------------------------
type NewCategory = { key: string; nameVi: string; nameEn: string; icon: string; sortOrder: number };

const NEW_CATEGORIES: NewCategory[] = [
  { key: 'drinks',     nameVi: 'Nước uống',     nameEn: 'Drinks',          icon: 'drinks',     sortOrder: 1 },
  { key: 'eatery',     nameVi: 'Quán ăn',       nameEn: 'Eatery',          icon: 'eatery',     sortOrder: 2 },
  { key: 'restaurant', nameVi: 'Nhà hàng',      nameEn: 'Restaurant',      icon: 'restaurant', sortOrder: 3 },
  { key: 'cafe',       nameVi: 'Trà và Café',   nameEn: 'Tea & Cafe',      icon: 'cafe',       sortOrder: 4 },
  { key: 'milk_tea',   nameVi: 'Trà sữa',       nameEn: 'Milk Tea',        icon: 'milk_tea',   sortOrder: 5 },
  { key: 'dessert',    nameVi: 'Tráng miệng',   nameEn: 'Dessert',         icon: 'dessert',    sortOrder: 6 },
  { key: 'pet_spa',    nameVi: 'Spa thú cưng',  nameEn: 'Pet Spa',         icon: 'pet_spa',    sortOrder: 7 },
  { key: 'shelter',    nameVi: 'Trạm cứu trợ',  nameEn: 'Rescue Shelter',  icon: 'shelter',    sortOrder: 8 },
  { key: 'pet_shop',   nameVi: 'Pet Shop',      nameEn: 'Pet Shop',        icon: 'pet_shop',   sortOrder: 9 },
  { key: 'hotel',      nameVi: 'Khách sạn',     nameEn: 'Hotel',           icon: 'hotel',      sortOrder: 10 },
  { key: 'homestay',   nameVi: 'Home stay',     nameEn: 'Homestay',        icon: 'homestay',   sortOrder: 11 },
];

const NEW_KEYS = new Set(NEW_CATEGORIES.map((c) => c.key));

// Ánh xạ cứng cho các key cũ đã biết (bổ sung thêm nếu bạn biết key khác)
const EXPLICIT_MAP: Record<string, string> = {
  viet: 'eatery',
  milk_tea: 'milk_tea',
};

// Ánh xạ thủ công từ dòng lệnh: --map=a:eatery,b:cafe
const CLI_MAP: Record<string, string> = Object.fromEntries(
  (process.argv.find((a) => a.startsWith('--map='))?.split('=')[1] ?? '')
    .split(',')
    .map((p) => p.split(':').map((s) => s.trim()))
    .filter((p) => p.length === 2 && p[0] && p[1]),
);

// ---------------------------------------------------------------------------
// ĐOÁN CATEGORY ĐÍCH cho category cũ (theo key + tên), thứ tự rule quan trọng
// ---------------------------------------------------------------------------
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

const KEYWORD_RULES: Array<{ target: string; words: string[] }> = [
  { target: 'pet_spa',    words: ['spa', 'grooming', 'groom', 'tam cat'] },
  { target: 'shelter',    words: ['shelter', 'rescue', 'tram cuu', 'cuu tro'] },
  { target: 'pet_shop',   words: ['pet shop', 'petshop', 'pet_shop', 'cua hang', 'store'] },
  { target: 'homestay',   words: ['homestay', 'home stay', 'home_stay'] },
  { target: 'hotel',      words: ['hotel', 'khach san', 'resort', 'hostel'] },
  { target: 'milk_tea',   words: ['milk', 'tra sua', 'bubble', 'boba'] },
  { target: 'cafe',       words: ['cafe', 'coffee', 'ca phe', 'tra va'] },
  { target: 'dessert',    words: ['dessert', 'trang mieng', 'banh', 'cake', 'kem', 'ice cream', 'sweet'] },
  { target: 'drinks',     words: ['drink', 'nuoc', 'juice', 'beer', 'cocktail', 'smoothie'] },
  { target: 'restaurant', words: ['restaurant', 'nha hang'] },
  { target: 'eatery',     words: ['quan an', 'viet', 'food', 'eat', 'bbq', 'noodle', 'pho', 'street'] },
];

function pickTarget(cat: { key: string; nameVi: string; nameEn: string }): { target: string; reason: string } {
  if (CLI_MAP[cat.key]) return { target: CLI_MAP[cat.key], reason: '--map' };
  if (EXPLICIT_MAP[cat.key]) return { target: EXPLICIT_MAP[cat.key], reason: 'ánh xạ cứng' };

  const hay = normalize(`${cat.key} ${cat.nameVi} ${cat.nameEn}`).replace(/_/g, ' ');
  for (const rule of KEYWORD_RULES) {
    const hit = rule.words.find((w) => hay.includes(normalize(w).replace(/_/g, ' ')));
    if (hit) return { target: rule.target, reason: `từ khoá "${hit}"` };
  }
  return { target: FALLBACK_KEY, reason: 'không đoán được -> fallback' };
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`🚀 Seed PlaceCategory${DRY_RUN ? ' (DRY-RUN: không ghi/xoá gì)' : ''}...`);

  if (!NEW_KEYS.has(FALLBACK_KEY)) {
    throw new Error(`--fallback=${FALLBACK_KEY} không nằm trong danh sách chuẩn: ${[...NEW_KEYS].join(', ')}`);
  }
  for (const [from, to] of Object.entries(CLI_MAP)) {
    if (!NEW_KEYS.has(to)) throw new Error(`--map ${from}:${to} -> "${to}" không nằm trong danh sách chuẩn`);
  }

  const existing = await prisma.placeCategory.findMany({
    include: { _count: { select: { places: true } } },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`📦 Hiện có ${existing.length} category trong DB.`);

  const oldCats = existing.filter((c) => !NEW_KEYS.has(c.key));
  const plan = oldCats.map((c) => ({ cat: c, ...pickTarget(c) }));

  // Báo cáo kế hoạch
  console.log('\n================ KẾ HOẠCH ================');
  const existingKeys = new Set(existing.map((c) => c.key));
  for (const c of NEW_CATEGORIES) {
    console.log(`${existingKeys.has(c.key) ? '✏️ cập nhật' : '➕ thêm mới '} ${c.key.padEnd(11)} ${c.nameVi}`);
  }
  console.log('------------------------------------------');
  if (plan.length === 0) console.log('Không có category cũ cần xoá.');
  for (const p of plan) {
    console.log(
      `🔁 [${p.cat.key}] "${p.cat.nameVi}" (${p.cat._count.places} place) -> ${p.target}  (${p.reason})`,
    );
  }
  console.log('==========================================\n');

  if (DRY_RUN) {
    console.log('🧪 Dry-run xong. Kiểm tra bảng ánh xạ; sai chỗ nào thì thêm --map=old:new rồi chạy lại.');
    return;
  }

  // 1) Upsert category chuẩn (không đụng icon của category đã có)
  for (const c of NEW_CATEGORIES) {
    await prisma.placeCategory.upsert({
      where: { key: c.key },
      create: { ...c, isActive: true },
      update: { nameVi: c.nameVi, nameEn: c.nameEn, sortOrder: c.sortOrder, isActive: true },
    });
  }
  const fresh = await prisma.placeCategory.findMany({ where: { key: { in: [...NEW_KEYS] } } });
  const byKey = new Map(fresh.map((c) => [c.key, c]));
  console.log(`✅ Đã đồng bộ ${fresh.length} category chuẩn.`);

  // 2) Chuyển place + xoá category cũ (mỗi category 1 transaction)
  const keyMap = new Map<string, string>(); // old key -> new key
  let movedPlaces = 0;
  let deletedCats = 0;

  for (const p of plan) {
    const target = byKey.get(p.target)!;
    keyMap.set(p.cat.key, target.key);
    try {
      const [moved] = await prisma.$transaction([
        prisma.place.updateMany({
          where: { categoryId: p.cat.id },
          data: {
            categoryId: target.id,
            categoryText: { vi: target.nameVi, en: target.nameEn },
          },
        }),
        prisma.placeCategory.delete({ where: { id: p.cat.id } }),
      ]);
      movedPlaces += moved.count;
      deletedCats++;
      console.log(`🔁 ${p.cat.key} -> ${target.key}: chuyển ${moved.count} place, đã xoá category cũ.`);
    } catch (e: any) {
      console.error(`⚠️ Lỗi với category ${p.cat.key}, giữ nguyên (không mất dữ liệu):`, e.message);
    }
  }

  // 3) Chuyển categoryKeys của PlaceSubmission (Json) sang key mới
  if (keyMap.size > 0) {
    const subs = await prisma.placeSubmission.findMany({ select: { id: true, categoryKeys: true } });
    let updatedSubs = 0;
    for (const s of subs) {
      if (!Array.isArray(s.categoryKeys)) continue;
      const before = s.categoryKeys as string[];
      const after = [...new Set(before.map((k) => keyMap.get(k) ?? k))];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      await prisma.placeSubmission.update({ where: { id: s.id }, data: { categoryKeys: after } });
      updatedSubs++;
    }
    console.log(`📝 Đã cập nhật categoryKeys của ${updatedSubs} đơn đăng ký địa điểm.`);
  }

  const finalCats = await prisma.placeCategory.findMany({
    include: { _count: { select: { places: true } } },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('\n📊 Kết quả:');
  finalCats.forEach((c) => console.log(`   ${String(c.sortOrder).padStart(2)}. ${c.nameVi.padEnd(14)} (${c.key}) - ${c._count.places} place`));
  console.log(`\n🎉 Xong: chuyển ${movedPlaces} place, xoá ${deletedCats}/${plan.length} category cũ.`);
  if (deletedCats < plan.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });