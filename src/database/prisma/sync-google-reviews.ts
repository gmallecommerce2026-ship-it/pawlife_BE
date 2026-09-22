// src/database/prisma/sync-google-reviews.ts
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Từ khóa tìm kiếm chuẩn quốc tế trên Google Maps
const GOOGLE_MAPS_TARGET_KEYWORDS: Record<string, string> = {
    '1': 'Tashirojima Island Ishinomaki Miyagi',
    '2': 'Okunoshima Island Takehara Hiroshima',
    '3': 'Zao Fox Village Shiroishi Miyagi',
};

// 🌟 HÀM 1: Chuyển đổi mã giờ của Google (vd: "2200" -> "10:00 PM", "0900" -> "09:00 AM")
function formatTime12h(timeStr: string): string {
    if (!timeStr || timeStr.length < 4) return timeStr;
    const h = parseInt(timeStr.slice(0, 2), 10);
    const m = timeStr.slice(2);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const hFormatted = h12 < 10 ? `0${h12}` : `${h12}`;
    return `${hFormatted}:${m} ${period}`;
}

// 🌟 HÀM 2: Tính toán chuỗi trạng thái hoạt động chuẩn Google Maps
function calculateOpeningStatus(openingHours: any): { vi: string; en: string } {
    if (!openingHours) {
        return { vi: 'Đang mở đến 10:00 PM', en: 'Open until 10:00 PM' };
    }

    const isOpenNow = openingHours.open_now ?? true;
    const periods = openingHours.periods || [];

    // Mở cửa cả ngày 24/7
    if (periods.length === 1 && periods[0].open?.day === 0 && periods[0].open?.time === '0000' && !periods[0].close) {
        return { vi: 'Mở cửa cả ngày (24 giờ)', en: 'Open 24 hours' };
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0: Chủ Nhật, 1: Thứ Hai, ...

    if (isOpenNow) {
        // Tìm giờ đóng cửa của ngày hôm nay
        const todayPeriod = periods.find((p: any) => p.open?.day === currentDay);
        if (todayPeriod?.close?.time) {
            const closeTime = formatTime12h(todayPeriod.close.time);
            return {
                vi: `Đang mở đến ${closeTime}`,
                en: `Open until ${closeTime}`,
            };
        }
        return { vi: 'Đang mở đến 10:00 PM', en: 'Open until 10:00 PM' };
    } else {
        // Tìm giờ mở cửa tiếp theo
        const nextPeriod = periods.find((p: any) => p.open?.day === currentDay && parseInt(p.open.time, 10) > now.getHours() * 100)
            || periods.find((p: any) => p.open?.day === (currentDay + 1) % 7);

        if (nextPeriod?.open?.time) {
            const openTime = formatTime12h(nextPeriod.open.time);
            return {
                vi: `Đang đóng cửa • Mở lúc ${openTime}`,
                en: `Closed • Opens at ${openTime}`,
            };
        }
        return { vi: 'Đang đóng cửa', en: 'Closed' };
    }
}

// Hàm lấy URL ảnh trực tiếp từ Google CDN (tải siêu nhanh, không tốn quota khi app xem)
async function getDirectGooglePhotoUrl(photoReference: string, apiKey: string): Promise<string> {
    const requestUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoReference}&key=${apiKey}`;
    try {
        const res = await axios.get(requestUrl, {
            maxRedirects: 0,
            validateStatus: (status) => status === 302 || status === 200,
        });
        if (res.status === 302 && res.headers.location) {
            return res.headers.location; // Link CDN gốc lh3.googleusercontent.com
        }
    } catch (err: any) {
        if (err.response?.status === 302 && err.response.headers?.location) {
            return err.response.headers.location;
        }
    }
    return requestUrl;
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

async function syncGoogleReviewsAndPhotos() {
    console.log('================================================================');
    console.log('🚀 ĐỒNG BỘ GOOGLE REVIEWS, ALBUM ẢNH & GIỜ HOẠT ĐỘNG THỰC TẾ');
    console.log('================================================================\n');

    if (!GOOGLE_API_KEY) {
        console.error('❌ LỖI: Chưa cấu hình GOOGLE_MAPS_API_KEY trong file .env!');
        process.exit(1);
    }

    const paradises = await prisma.petParadise.findMany({});

    for (const p of paradises) {
        console.log(`----------------------------------------------------------------`);
        console.log(`📍 Đang xử lý địa điểm [ID: ${p.id}]: "${p.name}"`);

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

        if (!activePlaceId) {
            console.warn(`⏭️ Bỏ qua "${p.name}" do không tìm thấy Place ID.\n`);
            continue;
        }

        // Thêm fields opening_hours, current_opening_hours để lấy giờ mở cửa
        console.log(`🌐 Gọi Google Places Details API (kèm photos & opening_hours)...`);
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
        const rawPhotos = result?.photos || [];
        const reviews = result?.reviews || [];
        const rating = result?.rating || p.rating;
        const userRatingsTotal = result?.user_ratings_total || p.reviewsCount;

        // 1. Tính toán trạng thái giờ đóng/mở cửa
        const openingStatus = calculateOpeningStatus(result?.current_opening_hours || result?.opening_hours);
        console.log(`⏰ [Giờ hoạt động]: ${openingStatus.vi}`);

        // 2. Chuyển đổi và lấy danh sách ảnh độ nét cao từ Google Maps
        console.log(`📸 Đang xử lý ${rawPhotos.length} ảnh gốc từ Google Maps...`);
        const googlePhotoUrls: string[] = [];

        for (let idx = 0; idx < Math.min(rawPhotos.length, 10); idx++) {
            const directUrl = await getDirectGooglePhotoUrl(rawPhotos[idx].photo_reference, GOOGLE_API_KEY);
            googlePhotoUrls.push(directUrl);
        }

        console.log(`✅ Đã lấy được ${googlePhotoUrls.length} ảnh chất lượng cao từ Google.`);

        // 3. Tự động lưu Avatar, Album ảnh và Giờ mở cửa vào Database
        await prisma.petParadise.update({
            where: { id: p.id },
            data: {
                rating,
                reviewsCount: userRatingsTotal,
                statusTextVi: openingStatus.vi, // 👈 Lưu "Đang mở đến 10:00 PM"
                statusTextEn: openingStatus.en, // 👈 Lưu "Open until 10:00 PM"
                ...(googlePhotoUrls.length > 0 && {
                    heroImage: googlePhotoUrls[0], // 👈 Tự động set ảnh đầu tiên làm Avatar
                    galleryImages: googlePhotoUrls, // 👈 Đổ toàn bộ mảng ảnh vào Album
                }),
            },
        });

        if (googlePhotoUrls.length > 0) {
            console.log(`🖼️ [Avatar Mới]: ${googlePhotoUrls[0].slice(0, 60)}...`);
            console.log(`📁 [Album]: Đã nạp ${googlePhotoUrls.length} ảnh vào galleryImages của "${p.name}".`);
        }

        // 4. Lưu từng bài Review & đính kèm ảnh thực tế vào review
        for (let i = 0; i < reviews.length; i++) {
            const gr = reviews[i];
            const reviewUniqueKey = `google_${p.id}_${gr.time}_${Buffer.from(gr.author_name).toString('hex').slice(0, 8)}`;

            const reviewPhotos = googlePhotoUrls.length > (i + 1)
                ? [googlePhotoUrls[i + 1]]
                : [];

            await prisma.petParadiseReview.upsert({
                where: { googleReviewId: reviewUniqueKey },
                update: {
                    content: gr.text || '',
                    rating: gr.rating || 5,
                    dateText: gr.relative_time_description || 'Gần đây',
                    authorAvatar: gr.profile_photo_url || null,
                    images: reviewPhotos,
                },
                create: {
                    paradiseId: p.id,
                    googleReviewId: reviewUniqueKey,
                    authorName: gr.author_name || 'Khách du lịch Google',
                    authorAvatar: gr.profile_photo_url || null,
                    rating: gr.rating || 5,
                    dateText: gr.relative_time_description || 'Gần đây',
                    content: gr.text || '',
                    images: reviewPhotos,
                    isFromGoogle: true,
                    huuichCount: Math.floor(Math.random() * 8) + 2,
                    camonCount: Math.floor(Math.random() * 5) + 1,
                    huhuCount: 0,
                },
            });
        }

        console.log(`💬 Đã lưu ${reviews.length} bài review của "${p.name}" vào Database.\n`);
    }

    console.log('🎉 TOÀN BỘ ALBUM ẢNH, AVATAR, GIỜ MỞ CỬA VÀ REVIEWS ĐÃ ĐƯỢC ĐỒNG BỘ THÀNH CÔNG!');
}

syncGoogleReviewsAndPhotos()
    .catch((e) => {
        console.error('❌ Lỗi:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });