// src/database/prisma/clean-duplicate-reviews.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanAndRename() {
  console.log('================================================================');
  console.log('🧹 BẮT ĐẦU DỌN DẸP REVIEW TRÙNG LẶP & ĐỔI TÊN ĐỊA ĐIỂM');
  console.log('================================================================\n');

  // 1. CẬP NHẬT TÊN GỌN GÀNG TRONG DATABASE
  console.log('🏷️ [1/2] Đang cập nhật tên các địa điểm trong MySQL...');

  await prisma.petParadise.updateMany({
    where: { OR: [{ id: '1' }, { name: { contains: 'Tashirojima' } }] },
    data: { name: 'Đảo Tashirojima' },
  });
  console.log('   ✅ Đã đổi tên -> "Đảo Tashirojima"');

  await prisma.petParadise.updateMany({
    where: { OR: [{ id: '2' }, { name: { contains: 'Okunoshima' } }] },
    data: { name: 'Đảo Okunoshima' },
  });
  console.log('   ✅ Đã đổi tên -> "Đảo Okunoshima"');

  await prisma.petParadise.updateMany({
    where: { OR: [{ id: '3' }, { name: { contains: 'Zao' } }] },
    data: { name: 'Làng cáo Zao' },
  });
  console.log('   ✅ Đã đổi tên -> "Làng cáo Zao"\n');

  // 2. LỌC VÀ XÓA CÁC BÀI REVIEW TRÙNG LẶP CỦA TỪNG USER
  console.log('🔍 [2/2] Đang quét và xóa review trùng lặp của từng tài khoản...');
  const paradises = await prisma.petParadise.findMany();
  let totalDeleted = 0;

  for (const p of paradises) {
    // Lấy các bài review do người dùng tạo (không phải review từ Google Maps)
    const userReviews = await prisma.petParadiseReview.findMany({
      where: {
        paradiseId: p.id,
        isFromGoogle: false,
      },
      orderBy: { createdAt: 'desc' }, // Bài mới nhất lên đầu
    });

    const seenUsers = new Set<string>();
    const duplicateIdsToDelete: string[] = [];

    for (const rev of userReviews) {
      const userKey = rev.userId || rev.authorName;

      if (seenUsers.has(userKey)) {
        duplicateIdsToDelete.push(rev.id); // Bài cũ hơn bị đưa vào danh sách xóa
      } else {
        seenUsers.add(userKey); // Giữ lại bài đầu tiên (bài mới nhất)
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      console.log(`   ⚠️ Tìm thấy ${duplicateIdsToDelete.length} review trùng tại "${p.name}".`);

      // Xóa các reactions và reports liên kết trước để an toàn
      await prisma.petParadiseReviewReaction.deleteMany({
        where: { reviewId: { in: duplicateIdsToDelete } },
      });
      await prisma.petParadiseReviewReport.deleteMany({
        where: { reviewId: { in: duplicateIdsToDelete } },
      });

      const deleteResult = await prisma.petParadiseReview.deleteMany({
        where: { id: { in: duplicateIdsToDelete } },
      });

      totalDeleted += deleteResult.count;
      console.log(`   🗑️ Đã xóa ${deleteResult.count} review trùng lặp.`);
    } else {
      console.log(`   ✨ Địa điểm "${p.name}" không có review trùng.`);
    }

    // Cập nhật lại số lượng review thực tế cho địa điểm
    const totalCount = await prisma.petParadiseReview.count({
      where: { paradiseId: p.id },
    });
    await prisma.petParadise.update({
      where: { id: p.id },
      data: { reviewsCount: totalCount },
    });
  }

  console.log(`\n🎉 ĐÃ XÓA TỔNG CỘNG ${totalDeleted} REVIEW TRÙNG LẶP & ĐỔI TÊN THÀNH CÔNG!`);
  console.log('================================================================');
}

cleanAndRename()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });