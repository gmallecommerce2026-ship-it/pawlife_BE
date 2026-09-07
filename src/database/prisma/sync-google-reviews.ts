// src/database/prisma/sync-google-reviews.ts
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const GOOGLE_MAPS_TARGET_KEYWORDS: Record<string, string> = {
  '1': 'Tashirojima Island Ishinomaki Miyagi',
  '2': 'Okunoshima Island Takehara Hiroshima',
  '3': 'Zao Fox Village Shiroishi Miyagi',
};

// Hàm tính toán trạng thái đóng/mở cửa từ dữ liệu Google
function calculateOpeningStatus(openingHours: any): { vi: string; en: string; isOpen: boolean } {
  if (!openingHours) {
    return { vi: 'Đang mở cả ngày', en: 'Open 24 hours', isOpen: true };
  }

  const isOpenNow = openingHours.open_now ?? true;
  const periods = openingHours.periods || [];

  // Mở cửa 24/7
  if (periods.length === 1 && periods[0].open?.day === 0 && periods[0].open?.time === '0000' && !periods[0].close) {
    return { vi: 'Mở cửa cả ngày (24/7)', en: 'Open 24 hours', isOpen: true };
  }

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeNum = currentHour * 100 + currentMinute;

  if (isOpenNow) {
    const todayPeriod = periods.find((p: any) => p.open?.day === currentDay);
    if (todayPeriod?.close?.time) {
      const closeH = todayPeriod.close.time.slice(0, 2);
      const closeM = todayPeriod.close.time.slice(2);
      return {
        vi: `Đang mở • Đóng cửa lúc ${closeH}:${closeM}`,
        en: `Open • Closes at ${closeH}:${closeM}`,
        isOpen: true,
      };
    }
    return { vi: 'Đang mở cửa', en: 'Open now', isOpen: true };
  } else {
    let nextOpen: { day: number; time: string; daysDiff: number } | null = null;
    for (let offset = 0; offset < 7; offset++) {
      const checkDay = (currentDay + offset) % 7;
      const period = periods.find((p: any) => p.open?.day === checkDay);
      if (period?.open?.time) {
        const openTimeNum = parseInt(period.open.time, 10);
        if (offset > 0 || openTimeNum > currentTimeNum) {
          nextOpen = { day: checkDay, time: period.open.time, daysDiff: offset };
          break;
        }
      }
    }

    if (nextOpen) {
      const openH = parseInt(nextOpen.time.slice(0, 2), 10);
      const openM = parseInt(nextOpen.time.slice(2), 10);
      const timeFormatted = `${nextOpen.time.slice(0, 2)}:${nextOpen.time.slice(2)}`;

      if (nextOpen.daysDiff === 0) {
        const diffMinutes = (openH * 60 + openM) - (currentHour * 60 + currentMinute);
        if (diffMinutes < 60) {
          return {
            vi: `Đang đóng • Mở sau ${diffMinutes} phút nữa (${timeFormatted})`,
            en: `Closed • Opens in ${diffMinutes} mins (${timeFormatted})`,
            isOpen: false,
          };
        }
        const diffHours = Math.floor(diffMinutes / 60);
        const remM = diffMinutes % 60;
        const timeStr = remM > 0 ? `${diffHours} giờ ${remM} phút` : `${diffHours} giờ`;
        return {
          vi: `Đang đóng • Mở sau ${timeStr} nữa (${timeFormatted})`,
          en: `Closed • Opens in ${diffHours}h ${remM > 0 ? remM + 'm' : ''} (${timeFormatted})`,
          isOpen: false,
        };
      } else if (nextOpen.daysDiff === 1) {
        return {
          vi: `Đang đóng • Mở lúc ${timeFormatted} ngày mai`,
          en: `Closed • Opens tomorrow at ${timeFormatted}`,
          isOpen: false,
        };
      } else {
        const dayNamesVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return {
          vi: `Đang đóng • Mở lúc ${timeFormatted} (${dayNamesVi[nextOpen.day]})`,
          en: `Closed • Opens ${dayNamesEn[nextOpen.day]} at ${timeFormatted}`,
          isOpen: false,
        };
      }
    }

    return { vi: 'Đang đóng cửa', en: 'Closed', isOpen: false };
  }
}

async function findFreshPlaceId(query: string, apiKey: string): Promise<string | null> {
  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`;
    const res = await axios.get(searchUrl);
    if (res.data?.status === 'OK' && res.data?.candidates?.length > 0) {
      return res.data.candidates[0].place_id;
    }
    return null;
  } catch {
    return null;
  }
}

async function syncGoogleReviews() {
  console.log('================================================================');
  console.log('🚀 ĐỒNG BỘ GOOGLE REVIEWS, HÌNH ẢNH & GIỜ HOẠT ĐỘNG THỰC TẾ');
  console.log('================================================================\n');

  if (!GOOGLE_API_KEY) {
    console.error('❌ LỖI: Chưa cấu hình GOOGLE_MAPS_API_KEY trong file .env!');
    process.exit(1);
  }

  const paradises = await prisma.petParadise.findMany({});

  for (const p of paradises) {
    console.log(`----------------------------------------------------------------`);
    console.log(`📍 Xử lý: "${p.name}"`);

    const standardKeyword = GOOGLE_MAPS_TARGET_KEYWORDS[p.id] || `${p.name} Japan`;
    let activePlaceId = p.googlePlaceId;

    if (!activePlaceId) {
      activePlaceId = await findFreshPlaceId(standardKeyword, GOOGLE_API_KEY);
      if (activePlaceId) {
        await prisma.petParadise.update({
          where: { id: p.id },
          data: { googlePlaceId: activePlaceId },
        });
      }
    }

    // Yêu cầu thêm fields: photos, opening_hours, current_opening_hours
    console.log(`🌐 Gọi Google Places Details API...`);
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${activePlaceId}&fields=name,reviews,rating,user_ratings_total,photos,opening_hours,current_opening_hours&language=vi&key=${GOOGLE_API_KEY}`;
    let res = await axios.get(detailsUrl);

    if (res.data?.status === 'NOT_FOUND') {
      const freshPlaceId = await findFreshPlaceId(standardKeyword, GOOGLE_API_KEY);
      if (freshPlaceId) {
        activePlaceId = freshPlaceId;
        await prisma.petParadise.update({ where: { id: p.id }, data: { googlePlaceId: freshPlaceId } });
        res = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${freshPlaceId}&fields=name,reviews,rating,user_ratings_total,photos,opening_hours,current_opening_hours&language=vi&key=${GOOGLE_API_KEY}`);
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

    // 1. Trích xuất danh sách ảnh Google Maps thực tế
    const googlePhotos: string[] = (result?.photos || []).slice(0, 10).map((pt: any) =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1000&photo_reference=${pt.photo_reference}&key=${GOOGLE_API_KEY}`
    );
    console.log(`📸 Đã lấy ${googlePhotos.length} ảnh thực tế từ Google Maps.`);

    // 2. Tính toán trạng thái giờ hoạt động
    const openingStatus = calculateOpeningStatus(result?.current_opening_hours || result?.opening_hours);
    console.log(`⏰ Trạng thái hoạt động: ${openingStatus.vi}`);

    // 3. Cập nhật thông tin địa điểm (Rating, ReviewsCount, Bộ ảnh, Giờ hoạt động)
    await prisma.petParadise.update({
      where: { id: p.id },
      data: {
        rating,
        reviewsCount: userRatingsTotal,
        statusTextVi: openingStatus.vi,
        statusTextEn: openingStatus.en,
        ...(googlePhotos.length > 0 && {
          heroImage: googlePhotos[0],
          galleryImages: googlePhotos,
        }),
      },
    });

    // 4. Lưu từng bài Review vào Database
    for (let i = 0; i < reviews.length; i++) {
      const gr = reviews[i];
      const reviewUniqueKey = `google_${p.id}_${gr.time}_${Buffer.from(gr.author_name).toString('hex').slice(0, 8)}`;

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

    console.log(`✅ Hoàn tất địa điểm "${p.name}"!\n`);
  }

  console.log('🎉 TOÀN BỘ ĐỊA ĐIỂM ĐÃ ĐƯỢC CẬP NHẬT ẢNH & REVIEWS GOOGLE THÀNH CÔNG!');
}

syncGoogleReviews()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });