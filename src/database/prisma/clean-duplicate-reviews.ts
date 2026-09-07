// src/database/prisma/clean-duplicate-reviews.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanAndRename() {
  console.log('================================================================');
  console.log('🧹 BẮT ĐẦU DỌN DẸP REVIEW TRÙNG LẶP & CẬP NHẬT TÊN ĐỊA ĐIỂM');
  console.log('================================================================\n');

  // 1. CẬP NHẬT TÊN CÁC ĐỊA ĐIỂM GỌN GÀNG
  console.log('🏷️ [1/3] Đang cập nhật tên các địa điểm...');

  // Tashirojima
  await prisma.petParadise.updateMany({
    where: {
      OR: [{ id: '1' }, { name: { contains: 'Tashirojima' } }],
    },
    data: { name: 'Đảo Tashirojima' },
  });
  console.log('   ✅ Đã đổi tên -> "Đảo Tashirojima"');

  // Okunoshima
  await prisma.petParadise.updateMany({
    where: {
      OR: [{ id: '2' }, { name: { contains: 'Okunoshima' } }],
    },
    data: { name: 'Đảo Okunoshima' },
  });
  console.log('   ✅ Đã đổi tên -> "Đảo Okunoshima"');

  // Zao Fox Village
  await prisma.petParadise.updateMany({
    where: {
      OR: [{ id: '3' }, { name: { contains: 'Zao' } }],
    },
    data: { name: 'Làng cáo Zao' },
  });
  console.log('   ✅ Đã đổi tên -> "Làng cáo Zao"\n');

  // 2. TÌM VÀ XÓA REVIEW TRÙNG LẶP CỦA TỪNG USER
  console.log('🔍 [2/3] Đang tìm kiếm và xử lý review trùng lặp...');
  const paradises = await prisma.petParadise.findMany();
  let totalDeleted = 0;

  for (const p of paradises) {
    // Lấy tất cả review do user tự đăng (bỏ qua review từ Google Maps)
    const userReviews = await prisma.petParadiseReview.findMany({
      where: {
        paradiseId: p.id,
        isFromGoogle: false,
      },
      orderBy: { createdAt: 'desc' }, // Bài mới nhất được xếp lên đầu
    });

    const seenUsers = new Set<string>();
    const duplicateIdsToDelete: string[] = [];

    for (const rev of userReviews) {
      // Định danh user duy nhất theo userId (hoặc authorName)
      const userKey = rev.userId || rev.authorName;

      if (seenUsers.has(userKey)) {
        // Đã có bài của user này trước đó -> gom ID bài cũ để xóa
        duplicateIdsToDelete.push(rev.id);
      } else {
        seenUsers.add(userKey);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      console.log(`   ⚠️ Tìm thấy ${duplicateIdsToDelete.length} review trùng lặp tại "${p.name}".`);

      // Xóa reactions và reports liên quan trước để tránh lỗi ràng buộc
      await prisma.petParadiseReviewReaction.deleteMany({
        where: { reviewId: { in: duplicateIdsToDelete } },
      });
      await prisma.petParadiseReviewReport.deleteMany({
        where: { reviewId: { in: duplicateIdsToDelete } },
      });

      // Xóa các bài review trùng lặp
      const deleteResult = await prisma.petParadiseReview.deleteMany({
        where: { id: { in: duplicateIdsToDelete } },
      });

      totalDeleted += deleteResult.count;
      console.log(`   🗑️ Đã xóa ${deleteResult.count} review trùng (chỉ giữ lại 1 review mới nhất cho mỗi user).`);
    } else {
      console.log(`   ✨ Địa điểm "${p.name}" không có review trùng lặp.`);
    }

    // 3. Cập nhật lại số lượng review thực tế cho địa điểm
    const totalCount = await prisma.petParadiseReview.count({
      where: { paradiseId: p.id },
    });

    await prisma.petParadise.update({
      where: { id: p.id },
      data: { reviewsCount: totalCount },
    });
  }

  console.log(`\n🎉 [3/3] HOÀN TẤT! Đã xóa tổng cộng ${totalDeleted} review trùng lặp.`);
  console.log('================================================================');
}

cleanAndRename()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });