// src/database/prisma/sync-google-reviews.ts
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Hàm tự động tìm Place ID mới nhất từ Google theo tên địa điểm thực tế
async function findFreshPlaceId(query: string, apiKey: string): Promise<string | null> {
  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
    console.log(`🔎 [Google Search] Đang tìm Place ID mới cho: "${query}"...`);
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
    console.log(`   Địa chỉ: ${p.addressVi}`);

    // Từ khóa tìm kiếm tự động động theo từng địa điểm (không bị trùng Tashirojima nữa)
    const dynamicSearchKeyword = `${p.name} ${p.addressEn || p.addressVi}`;
    let activePlaceId = p.googlePlaceId;

    // 1. Nếu chưa có Place ID, tìm tự động theo tên địa điểm đó
    if (!activePlaceId) {
      activePlaceId = await findFreshPlaceId(dynamicSearchKeyword, GOOGLE_API_KEY);
      if (activePlaceId) {
        await prisma.petParadise.update({
          where: { id: p.id },
          data: { googlePlaceId: activePlaceId },
        });
      }
    }

    if (!activePlaceId) {
      console.warn(`⏭️ Bỏ qua "${p.name}" do không có Place ID hợp lệ.\n`);
      continue;
    }

    // 2. Gọi Google Places Details API
    console.log(`🌐 Gọi Google Places Details với Place ID: ${activePlaceId}...`);
    let detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${activePlaceId}&fields=name,reviews,rating,user_ratings_total&language=vi&key=${GOOGLE_API_KEY}`;
    let res = await axios.get(detailsUrl);

    // 3. Nếu Place ID cũ bị NOT_FOUND -> Tự động tìm lại bằng từ khóa của chính địa điểm đó
    if (res.data?.status === 'NOT_FOUND') {
      console.warn(`⚠️ Place ID của "${p.name}" đã hết hạn. Đang tự động tìm mã mới...`);
      const freshPlaceId = await findFreshPlaceId(dynamicSearchKeyword, GOOGLE_API_KEY);

      if (freshPlaceId) {
        activePlaceId = freshPlaceId;
        await prisma.petParadise.update({
          where: { id: p.id },
          data: { googlePlaceId: freshPlaceId },
        });
        detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${freshPlaceId}&fields=name,reviews,rating,user_ratings_total&language=vi&key=${GOOGLE_API_KEY}`;
        res = await axios.get(detailsUrl);
      }
    }

    if (res.data?.status !== 'OK') {
      console.error(`❌ Google API từ chối địa điểm "${p.name}". Lỗi: ${res.data?.error_message || res.data?.status}`);
      continue;
    }

    const result = res.data?.result;
    const reviews = result?.reviews || [];
    const rating = result?.rating || p.rating;
    const userRatingsTotal = result?.user_ratings_total || p.reviewsCount;

    console.log(`⭐ Điểm Google Rating: ${rating} / 5.0 (${userRatingsTotal} lượt đánh giá trên Google Maps)`);
    console.log(`💬 Lấy được ${reviews.length} bài đánh giá từ Google Maps.\n`);

    // 4. Lưu từng bài Review vào Database
    for (let i = 0; i < reviews.length; i++) {
      const gr = reviews[i];
      const reviewUniqueKey = `google_${p.id}_${gr.time}_${Buffer.from(gr.author_name).toString('hex').slice(0, 8)}`;

      console.log(`   [Review ${i + 1}/${reviews.length}] 👤 ${gr.author_name} (${gr.rating}⭐): "${gr.text ? gr.text.slice(0, 60) + '...' : ''}"`);

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

    // 5. Cập nhật lại số sao và tổng review cho địa điểm
    await prisma.petParadise.update({
      where: { id: p.id },
      data: {
        rating: rating,
        reviewsCount: userRatingsTotal,
      },
    });

    console.log(`✅ ĐÃ LƯU XONG ${reviews.length} BÀI REVIEW CỦA "${p.name}"!\n`);
  }

  console.log('🎉 TẤT CẢ CÁC ĐỊA ĐIỂM ĐÃ ĐƯỢC ĐỒNG BỘ GOOGLE REVIEWS THÀNH CÔNG!');
}

syncGoogleReviews()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });