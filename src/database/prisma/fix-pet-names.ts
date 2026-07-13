/**
 * prisma/fix-pet-names.ts
 * ------------------------------------------------------------------
 * Script sửa lỗi TÊN (name) của các Pet ĐÃ TỒN TẠI trong DB — không cần
 * xoá và seed lại từ đầu.
 *
 * Lỗi gốc: tên pet từng được suy ra từ TÊN THƯ MỤC ảnh (petFolder) thay vì
 * chỉ lấy phần tên riêng, dẫn tới `name` bị lưu sai dạng cả cụm, ví dụ:
 *   "Tim_Germansherperd"   thay vì đúng ra chỉ là   "Tim"
 *   "Cooper-Poodle-Brown"  thay vì đúng ra chỉ là   "Cooper"
 *
 * Cách sửa: với mỗi Pet, lấy 1 ảnh bất kỳ trong quan hệ `images` (PetImage.url),
 * suy ra tên file gốc (vd "Tim_Germansherperd_1.png"), rồi lấy phần trước dấu
 * "_" đầu tiên -> "Tim". Tên file luôn theo đúng format "Name_XXX_N.ext" nên
 * cách này đáng tin cậy hơn nhiều so với dựa vào tên thư mục.
 *
 * Script CHỈ update cột `name`, không đụng tới bất kỳ dữ liệu nào khác.
 *
 * Chạy thử trước (không ghi DB, chỉ xem trước thay đổi):
 *   npx ts-node prisma/fix-pet-names.ts --dry-run
 *
 * Chạy thật (ghi thay đổi vào DB):
 *   npx ts-node prisma/fix-pet-names.ts
 * ------------------------------------------------------------------
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Lấy phần tên file thuần (không path, không đuôi mở rộng) từ 1 URL ảnh.
 * Vd: "https://cdn.pawlife.vn/pet-images/Breeds/Dog/GermanSheperd/Tim_Germansherperd/Tim_Germansherperd_1.png"
 *  -> "Tim_Germansherperd_1"
 */
function extractFileBaseName(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);
    const lastSegment = decoded.split("/").pop();
    if (!lastSegment) return null;
    return lastSegment.replace(/\.[^.]+$/, "");
  } catch {
    return null;
  }
}

/**
 * Từ tên file ảnh, suy ra tên pet đúng: phần trước dấu "_" đầu tiên, viết hoa
 * chữ cái đầu, các chữ còn lại giữ nguyên.
 */
function deriveCorrectName(fileBaseName: string): string | null {
  const rawName = fileBaseName.split("_")[0]?.trim();
  if (!rawName) return null;
  return rawName.charAt(0).toUpperCase() + rawName.slice(1);
}

async function main() {
  console.log(`🔍 Đang quét toàn bộ Pet trong hệ thống${DRY_RUN ? " (chế độ DRY RUN - không ghi DB)" : ""}...`);

  const pets = await prisma.pet.findMany({
    select: {
      id: true,
      name: true,
      images: { select: { url: true }, take: 1 },
    },
  });

  console.log(`📋 Tổng số pet: ${pets.length}`);

  let fixedCount = 0;
  let skippedNoImage = 0;
  let skippedAlreadyOk = 0;
  let failedParse = 0;

  for (const pet of pets) {
    const firstImage = pet.images[0];
    if (!firstImage) {
      skippedNoImage++;
      console.warn(`  ⚠️  Pet "${pet.name}" (id=${pet.id}) không có ảnh nào, bỏ qua.`);
      continue;
    }

    const baseFileName = extractFileBaseName(firstImage.url);
    if (!baseFileName) {
      failedParse++;
      console.warn(`  ⚠️  Không parse được URL ảnh của pet "${pet.name}" (id=${pet.id}): ${firstImage.url}`);
      continue;
    }

    const correctName = deriveCorrectName(baseFileName);
    if (!correctName) {
      failedParse++;
      console.warn(`  ⚠️  Không suy ra được tên đúng cho pet "${pet.name}" (id=${pet.id}) từ file "${baseFileName}".`);
      continue;
    }

    if (correctName === pet.name) {
      skippedAlreadyOk++;
      continue;
    }

    console.log(`  🔧 [${pet.id}] "${pet.name}"  ->  "${correctName}"`);

    if (!DRY_RUN) {
      await prisma.pet.update({
        where: { id: pet.id },
        data: { name: correctName },
      });
    }
    fixedCount++;
  }

  console.log("\n📊 Kết quả:");
  console.log(`   ✅ Đã sửa: ${fixedCount}`);
  console.log(`   ✔️  Đã đúng sẵn: ${skippedAlreadyOk}`);
  console.log(`   ⚠️  Không có ảnh: ${skippedNoImage}`);
  console.log(`   ⚠️  Không parse được: ${failedParse}`);

  if (DRY_RUN) {
    console.log("\nℹ️  Đây là DRY RUN, chưa có thay đổi nào được ghi vào DB. Chạy lại không kèm --dry-run để áp dụng thật.");
  } else {
    console.log("\n🎉 Hoàn tất cập nhật tên pet!");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });