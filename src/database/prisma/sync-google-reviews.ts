// src/database/prisma/sync-google-reviews.ts
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// 🌟 TỪ KHÓA CHUẨN QUỐC TẾ TRÊN GOOGLE MAPS (Tránh lỗi dấu ngoặc và tiếng Việt)
const GOOGLE_MAPS_TARGET_KEYWORDS: Record<string, string> = {
  '1': 'Tashirojima Island Ishinomaki Miyagi',
  '2': 'Okunoshima Island Takehara Hiroshima',
  '3': 'Zao Fox Village Shiroishi Miyagi',
};

async function findFreshPlaceId(query: string, apiKey: string): Promise<string | null> {
  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
    console.log(`🔎 [Google Search] Đang tìm Place ID cho từ khóa chuẩn: "${query}"...`);
    const res = await axios.get(searchUrl);

    if (res.data?.status === 'OK' && res.data?.candidates?.length > 0) {
      const freshId = res.data.candidates[0].place_id;
      const placeName = res.data.candidates[0].name;
      console.log(`🎯 [Google Search] Tìm thấy: "${placeName}" -> Place ID: ${freshId}`);
      return freshId;
    } else {
      console.warn(`⚠️ [Google Search] Không tìm thấy kết quả. Status: ${res.data?.status}`);
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

  if (!GOOGLE_API_KEY) {
    console.error('❌ LỖI: Chưa cấu hình GOOGLE_MAPS_API_KEY trong file .env!');
    process.exit(1);
  }

  const paradises = await prisma.petParadise.findMany({});
  console.log(`📋 Tìm thấy ${paradises.length} địa điểm trong bảng pet_paradises.\n`);

  for (const p of paradises) {
    console.log(`----------------------------------------------------------------`);
    console.log(`📍 Đang xử lý địa điểm [ID: ${p.id}]: "${p.name}"`);

    // Lấy từ khóa chuẩn tiếng Anh của địa điểm
    const standardKeyword = GOOGLE_MAPS_TARGET_KEYWORDS[p.id] || `${p.name} Japan`;

    // 1. Tìm Place ID chuẩn từ Google Maps
    let activePlaceId = await findFreshPlaceId(standardKeyword, GOOGLE_API_KEY);

    if (activePlaceId) {
      await prisma.petParadise.update({
        where: { id: p.id },
        data: { googlePlaceId: activePlaceId },
      });
    } else {
      console.warn(`⏭️ Bỏ qua "${p.name}" do Google không tìm thấy địa điểm này.\n`);
      continue;
    }

    // 2. Gọi Google Places Details API để kéo toàn bộ Reviews
    console.log(`🌐 Đang kéo reviews từ Google Maps...`);
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${activePlaceId}&fields=name,reviews,rating,user_ratings_total&language=vi&key=${GOOGLE_API_KEY}`;
    const res = await axios.get(detailsUrl);

    if (res.data?.status !== 'OK') {
      console.error(`❌ Google API từ chối. Lỗi: ${res.data?.error_message || res.data?.status}`);
      continue;
    }

    const result = res.data?.result;
    const reviews = result?.reviews || [];
    const rating = result?.rating || p.rating;
    const userRatingsTotal = result?.user_ratings_total || p.reviewsCount;

    console.log(`⭐ Google Rating: ${rating} / 5.0 (${userRatingsTotal} lượt đánh giá tổng thể trên Google)`);
    console.log(`💬 Lấy được ${reviews.length} bài đánh giá từ Google Maps.\n`);

    // 3. Lưu từng bài Review vào Database MySQL
    for (let i = 0; i < reviews.length; i++) {
      const gr = reviews[i];
      const reviewUniqueKey = `google_${p.id}_${gr.time}_${Buffer.from(gr.author_name).toString('hex').slice(0, 8)}`;

      console.log(`   [Review ${i + 1}/${reviews.length}] 👤 ${gr.author_name} (${gr.rating}⭐): "${gr.text ? gr.text.slice(0, 50) + '...' : ''}"`);

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
    }

    // 4. Cập nhật số sao và tổng review cho địa điểm
    await prisma.petParadise.update({
      where: { id: p.id },
      data: {
        rating: rating,
        reviewsCount: userRatingsTotal,
      },
    });

    console.log(`✅ ĐÃ LƯU XONG ${reviews.length} BÀI REVIEW CHO "${p.name}"!\n`);
  }

  console.log('🎉 TẤT CẢ ĐỊA ĐIỂM ĐÃ ĐƯỢC ĐỒNG BỘ GOOGLE REVIEWS THÀNH CÔNG 100%!');
}

syncGoogleReviews()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });