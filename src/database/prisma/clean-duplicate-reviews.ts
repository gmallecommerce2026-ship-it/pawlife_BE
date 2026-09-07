// src/database/prisma/clean-duplicate-reviews.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanAllDuplicates() {
  console.log('🧹 BẮT ĐẦU QUÉT VÀ XÓA TẤT CẢ REVIEW TRÙNG LẶP TRONG DATABASE...');

  const paradises = await prisma.petParadise.findMany();
  let totalDeleted = 0;

  for (const p of paradises) {
    // Lấy tất cả review của địa điểm
    const allReviews = await prisma.petParadiseReview.findMany({
      where: { paradiseId: p.id },
      orderBy: { createdAt: 'desc' },
    });

    const seen = new Set<string>();
    const duplicateIdsToDelete: string[] = [];

    for (const rev of allReviews) {
      // Khóa định danh: tên tác giả + 30 ký tự đầu của bài viết
      const uniqueKey = `${rev.authorName}_${rev.content.trim().slice(0, 40)}`;

      if (seen.has(uniqueKey)) {
        duplicateIdsToDelete.push(rev.id); // Bài trùng phía sau bị xóa
      } else {
        seen.add(uniqueKey); // Giữ lại bài duy nhất
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      await prisma.petParadiseReviewReaction.deleteMany({
        where: { reviewId: { in: duplicateIdsToDelete } },
      });
      await prisma.petParadiseReviewReport.deleteMany({
        where: { reviewId: { in: duplicateIdsToDelete } },
      });

      const del = await prisma.petParadiseReview.deleteMany({
        where: { id: { in: duplicateIdsToDelete } },
      });

      totalDeleted += del.count;
      console.log(`   🗑️ Đã xóa ${del.count} bài review trùng tại "${p.name}".`);
    }

    // Cập nhật lại số lượng reviewsCount chuẩn
    const realCount = await prisma.petParadiseReview.count({ where: { paradiseId: p.id } });
    await prisma.petParadise.update({
      where: { id: p.id },
      data: { reviewsCount: realCount },
    });
  }

  console.log(`\n🎉 HOÀN TẤT! Đã xóa sạch ${totalDeleted} bản ghi trùng lặp trong MySQL.`);
}

cleanAllDuplicates()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());