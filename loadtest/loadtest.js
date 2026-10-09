import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL;
const PASSWORD = __ENV.PASSWORD || 'Test@1234';
const TEST_TYPE = __ENV.TEST_TYPE || 'load'; // load, stress, spike, soak
const USERS = Number(__ENV.USERS || 150); // Số lượng user thực hiện login ở hàm setup

const rnd = (a, b) => a + Math.random() * (b - a);

// Cấu hình các kịch bản test khác nhau
const testScenarios = {
  // 1. Load Test (Mức tải bình thường - như bạn đã chạy)
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 150 }, // Khởi động lên 150 VUs
      { duration: '5m', target: 150 },  // Giữ 150 VUs trong 5 phút
      { duration: '30s', target: 0 },   // Hạ nhiệt
    ],
  },
  // 2. Stress Test (Tìm giới hạn chịu đựng của Server)
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 200 },  // Khởi động từ từ lên mức tải quen thuộc
      { duration: '5m', target: 200 },
      { duration: '2m', target: 500 },  // Đẩy lên 500 VUs
      { duration: '5m', target: 500 },
      { duration: '2m', target: 1000 }, // Đẩy lên 1000 VUs (Đây là mức có thể làm server 1.7GB RAM quá tải)
      { duration: '5m', target: 1000 },
      { duration: '2m', target: 0 },    // Hạ nhiệt
    ],
  },
  // 3. Spike Test (Kiểm tra sốc tải - vd: Gửi Push Notification)
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 600 }, // Dồn lượng user khổng lồ vào trong chớp mắt (10s)
      { duration: '2m', target: 600 },  // Giữ mức này trong 2 phút
      { duration: '10s', target: 0 },   // Lập tức rời đi
    ],
  },
  // 4. Soak Test (Test độ bền, dò rò rỉ bộ nhớ - Memory Leak)
  soak: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 200 }, 
      { duration: '2h', target: 200 }, // Chạy liên tục trong 2-4 tiếng
      { duration: '2m', target: 0 },
    ],
  }
};

export const options = {
  setupTimeout: '10m', // Tăng lên 10 phút vì nếu login 500-1000 users tuần tự sẽ tốn thời gian
  scenarios: {
    default_scenario: testScenarios[TEST_TYPE] || testScenarios['load'],
  },
  thresholds: {
    http_req_failed: ['rate<0.05'], // Stress test cho phép lỗi nhiều hơn một chút (5%)
    'http_req_duration{name:feed}': ['p(95)<1500'], // Khi stress, response time chắc chắn sẽ cao hơn
    'http_req_duration{name:detail}': ['p(95)<1000'],
    'http_req_duration{name:swipe}': ['p(95)<800'],
  },
};

export function setup() {
  const tokens = [];
  for (let i = 1; i <= USERS; i++) {
    const r = http.post(
      `${BASE}/auth/login`,
      JSON.stringify({ email: `loadtest${i}@test.com`, password: PASSWORD }),
      {
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': `k6-device-${i}`,
          'x-device-name': `k6-${i}`,
          'x-device-os': 'k6',
        },
        tags: { name: 'login' },
      },
    );
    let t;
    try { t = r.json('accessToken'); } catch (e) {}
    if (t) tokens.push({ token: t, deviceId: `k6-device-${i}` });
    else if (i <= 3) console.log(`login #${i} -> ${r.status} ${r.body}`);
  }
  console.log(`Login OK: ${tokens.length}/${USERS} (Running ${TEST_TYPE} test)`);
  if (!tokens.length) throw new Error('Login thất bại: xem log status/body ở trên');
  return { tokens };
}

export default function (data) {
  // Kỹ thuật Round-Robin: Dù có 1000 VUs nhưng chỉ dùng 200 token có sẵn để tránh quá tải setup()
  const u = data.tokens[(__VU - 1) % data.tokens.length];
  
  const p = (name) => ({
    headers: {
      Authorization: `Bearer ${u.token}`,
      'Content-Type': 'application/json',
      'x-device-id': u.deviceId,
      'x-device-name': 'k6',
      'x-device-os': 'k6',
    },
    tags: { name },
  });

  const feed = http.get(`${BASE}/pets/feed?limit=10&lat=${rnd(10.7, 10.9)}&lng=${rnd(106.6, 106.8)}`, p('feed'));
  check(feed, { 'feed 200': (r) => r.status === 200 });

  let pets = [];
  try {
    const body = feed.json();
    pets = Array.isArray(body) ? body : (body.data || body.items || body.pets || []);
  } catch (e) {}

  sleep(rnd(1, 3));

  for (const pet of pets.slice(0, 5)) {
    if (Math.random() < 0.3) {
      const d = http.get(`${BASE}/pets/${pet.id}`, p('detail'));
      check(d, { 'detail 200': (r) => r.status === 200 });
      sleep(rnd(1, 3));
    }
    const s = http.post(`${BASE}/pets/${pet.id}/swipe`,
      JSON.stringify({ action: Math.random() < 0.4 ? 'LIKE' : 'PASS' }), p('swipe'));
    check(s, { 'swipe ok': (r) => r.status === 200 || r.status === 201 });
    sleep(rnd(1, 3));
  }
}