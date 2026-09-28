import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://localhost:3000/api'; // Thay bằng URL Staging của bạn
const ACCESS_TOKEN = 'YOUR_TEST_JWT_TOKEN';

// ---------------------------------------------------------
// BẬT 1 TRONG 3 OPTIONS DƯỚI ĐÂY ĐỂ CHẠY LOẠI TEST TƯƠNG ỨNG
// ---------------------------------------------------------

// 1. PERFORMANCE TEST (Tải bình thường, giữ đều)
export const options_performance = {
  vus: 50, // 50 users truy cập cùng lúc
  duration: '1m', // Chạy trong 1 phút để đo đạc cơ bản
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% requests phải phản hồi dưới 200ms
  },
};

// 2. LOAD TEST (Tăng dần lên tải đỉnh điểm dự kiến rồi giữ nguyên)
export const options_load = {
  stages: [
    { duration: '2m', target: 500 }, // Ramp-up: Tăng dần từ 0 lên 500 users trong 2 phút
    { duration: '5m', target: 500 }, // Steady: Giữ ở mức 500 users trong 5 phút
    { duration: '2m', target: 0 },   // Ramp-down: Hạ nhiệt dần về 0
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'], // 99% requests phải dưới 500ms
  },
};

// 3. STRESS TEST (Tăng tải liên tục vượt giới hạn cho đến khi timeout/lỗi)
export const options_stress = {
  stages: [
    { duration: '2m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 2000 }, // Ép server dính quá tải
    { duration: '2m', target: 3000 }, // Đẩy đến điểm giới hạn (Breaking point)
    { duration: '2m', target: 0 },
  ],
};

// CHỌN OPTION ĐỂ CHẠY
export const options = options_load; 

// ==========================================
// KỊCH BẢN TEST CỤ THỂ CHO APP CỦA BẠN
// ==========================================
export default function () {
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // KỊCH BẢN 1: API Đọc (Read-heavy) - Test Redis & Prisma Query
  // Gọi hàm getFeed() trong PetsService
  const feedRes = http.get(`${BASE_URL}/pets/feed?limit=20&lat=16.05&lng=108.2`, { headers });
  
  check(feedRes, {
    'Feed load success (200)': (r) => r.status === 200,
  });

  // KỊCH BẢN 2: API Ghi (Write-heavy) - Test BullMQ & DB Transaction
  // Gọi hàm swipePet() trong PetsService
  const petId = 'some-mock-pet-id-or-dynamic';
  const swipePayload = JSON.stringify({ action: 'LIKE' });
  const swipeRes = http.post(`${BASE_URL}/pets/${petId}/swipe`, swipePayload, { headers });
  
  check(swipeRes, {
    'Swipe queued success (200/201)': (r) => r.status === 200 || r.status === 201,
  });

  // Giả lập user đọc xong rồi mới thao tác (think time)
  sleep(1); 
}