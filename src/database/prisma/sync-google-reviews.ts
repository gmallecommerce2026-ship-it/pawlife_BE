// src/database/prisma/sync-google-reviews.ts
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Hàm tự động tìm Place ID mới nhất từ Google nếu Place ID cũ bị hết hạn
async function findFreshPlaceId(query: string, apiKey: string): Promise<string | null> {
  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
    console.log(`🔎 [Google Search] Đang tự động tìm kiếm Place ID mới cho từ khóa: "${query}"...`);
    const res = await axios.get(searchUrl);

    if (res.data?.status === 'OK' && res.data?.candidates?.length > 0) {
      const freshId = res.data.candidates[0].place_id;
      const placeName = res.data.candidates[0].name;
      console.log(`🎯 [Google Search] Tìm thấy địa điểm: "${placeName}" -> Place ID mới: ${freshId}`);
      return freshId;
    } else {
      console.warn(`⚠️ [Google Search] Không tìm thấy Place ID mới. Status: ${res.data?.status}`);
      return null;
    }
  } catch (err: any) {
    console.error('❌ [Google Search Error]:', err.message);
    return null;
  }
}

async function syncGoogleReviews() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU ĐỒNG BỘ ĐÁNH GIÁ THỰC TẾ TỪ GOOGLE MAPS VÀO DATABASE');
  console.log('================================================================\n');

  // 1. Kiểm tra API Key
  if (!GOOGLE_API_KEY) {
    console.error('❌ LỖI: Chưa cấu hình GOOGLE_MAPS_API_KEY trong file .env!');
    process.exit(1);
  }
  console.log(`🔑 Google API Key: ${GOOGLE_API_KEY.slice(0, 10)}...${GOOGLE_API_KEY.slice(-6)} (Đã nạp)`);

  // 2. Lấy danh sách địa điểm trong Database
  const paradises = await prisma.petParadise.findMany({});
  console.log(`📋 Tìm thấy ${paradises.length} địa điểm trong bảng pet_paradises.\n`);

  for (const p of paradises) {
    console.log(`----------------------------------------------------------------`);
    console.log(`📍 Đang xử lý địa điểm [ID: ${p.id}]: "${p.name}"`);
    console.log(`   Địa chỉ: ${p.addressVi}`);
    console.log(`   Place ID hiện tại trong DB: ${p.googlePlaceId || 'Chưa có'}`);

    let activePlaceId = p.googlePlaceId;

    // 3. Nếu chưa có Place ID hoặc cần kiểm tra
    if (!activePlaceId) {
      activePlaceId = await findFreshPlaceId('Tashirojima Ishinomaki Miyagi', GOOGLE_API_KEY);
      if (activePlaceId) {
        await prisma.petParadise.update({
          where: { id: p.id },
          data: { googlePlaceId: activePlaceId },
        });
        console.log(`💾 Đã lưu Place ID mới vào Database cho "${p.name}".`);
      }
    }

    if (!activePlaceId) {
      console.warn(`⏭️ Bỏ qua địa điểm "${p.name}" do không có Place ID hợp lệ.\n`);
      continue;
    }

    // 4. Gọi Google Places Details API để lấy Reviews
    console.log(`🌐 Đang gọi Google Places Details API với Place ID: ${activePlaceId}...`);
    let detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${activePlaceId}&fields=name,reviews,rating,user_ratings_total&language=vi&key=${GOOGLE_API_KEY}`;
    let res = await axios.get(detailsUrl);

    console.log(`📡 [Google API Response Status]: ${res.data?.status}`);

    // Nếu Place ID cũ bị hết hạn (NOT_FOUND), tự động tìm mã mới và gọi lại
    if (res.data?.status === 'NOT_FOUND') {
      console.warn('⚠️ Place ID hiện tại đã hết hạn (NOT_FOUND). Đang tự động tìm mã mới...');
      const freshPlaceId = await findFreshPlaceId('Tashirojima Ishinomaki Miyagi', GOOGLE_API_KEY);

      if (freshPlaceId) {
        activePlaceId = freshPlaceId;
        await prisma.petParadise.update({
          where: { id: p.id },
          data: { googlePlaceId: freshPlaceId },
        });
        console.log(`🔄 Thử lại với Place ID mới: ${freshPlaceId}...`);
        detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${freshPlaceId}&fields=name,reviews,rating,user_ratings_total&language=vi&key=${GOOGLE_API_KEY}`;
        res = await axios.get(detailsUrl);
        console.log(`📡 [Google API Response Status Lần 2]: ${res.data?.status}`);
      }
    }

    if (res.data?.status !== 'OK') {
      console.error(`❌ Google API từ chối. Lỗi: ${res.data?.error_message || res.data?.status}`);
      continue;
    }

    const result = res.data?.result;
    const reviews = result?.reviews || [];
    const rating = result?.rating || p.rating;
    const userRatingsTotal = result?.user_ratings_total || p.reviewsCount;

    console.log(`⭐ Điểm Google Rating thực tế: ${rating} / 5.0 (${userRatingsTotal} lượt đánh giá tổng thể trên Google Maps)`);
    console.log(`💬 Lấy được ${reviews.length} bài đánh giá chi tiết từ Google Maps.\n`);

    if (reviews.length === 0) {
      console.warn('⚠️ Google Maps không trả về nội dung review dạng text nào cho địa điểm này.');
      continue;
    }

    // 5. Lưu và in chi tiết từng bài Review
    let savedCount = 0;
    for (let i = 0; i < reviews.length; i++) {
      const gr = reviews[i];
      const reviewUniqueKey = `google_${p.id}_${gr.time}_${Buffer.from(gr.author_name).toString('hex').slice(0, 8)}`;

      console.log(`   [Review ${i + 1}/${reviews.length}]`);
      console.log(`   👤 Tác giả: ${gr.author_name}`);
      console.log(`   ⭐ Số sao: ${gr.rating} sao`);
      console.log(`   🕒 Thời gian: ${gr.relative_time_description}`);
      console.log(`   📝 Nội dung: "${gr.text ? gr.text.slice(0, 80) + '...' : '(Không có văn bản)'}"`);

      await prisma.petParadiseReview.upsert({
        where: { googleReviewId: reviewUniqueKey },
        update: {
          content: gr.text || '',
          rating: gr.rating || 5,
          dateText: gr.relative_time_description || 'Gần đây',
          authorAvatar: gr.profile_photo_url || null,
        },
        create: {
          paradiseId: p.id,
          googleReviewId: reviewUniqueKey,
          authorName: gr.author_name || 'Khách du lịch Google',
          authorAvatar: gr.profile_photo_url || null,
          rating: gr.rating || 5,
          dateText: gr.relative_time_description || 'Gần đây',
          content: gr.text || '',
          images: [],
          isFromGoogle: true,
          huuichCount: Math.floor(Math.random() * 8) + 2,
          camonCount: Math.floor(Math.random() * 5) + 1,
          huhuCount: 0,
        },
      });
      savedCount++;
    }

    // 6. Cập nhật lại số sao và tổng số review của Google vào bảng pet_paradises
    await prisma.petParadise.update({
      where: { id: p.id },
      data: {
        rating: rating,
        reviewsCount: userRatingsTotal,
      },
    });

    console.log(`\n✅ ĐÃ LƯU THÀNH CÔNG ${savedCount} BÀI REVIEW THỰC TẾ TỪ GOOGLE VÀO BẢNG pet_paradise_reviews!`);
  }

  console.log('\n================================================================');
  console.log('🎉 QUÁ TRÌNH ĐỒNG BỘ HOÀN TẤT 100%!');
  console.log('================================================================');
}

syncGoogleReviews()
  .catch((e) => {
    console.error('❌ Lỗi thực thi syncGoogleReviews:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });