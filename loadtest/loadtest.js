import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL;
const VUS = Number(__ENV.VUS || 150);
const DURATION = __ENV.DURATION || '5m';
const USERS = Number(__ENV.USERS || 100);
const PASSWORD = __ENV.PASSWORD || 'Test@1234';
const rnd = (a, b) => a + Math.random() * (b - a);

export const options = {
  setupTimeout: '180s',
  stages: [
    { duration: '30s', target: VUS },
    { duration: DURATION, target: VUS },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:feed}': ['p(95)<800'],
    'http_req_duration{name:detail}': ['p(95)<500'],
    'http_req_duration{name:swipe}': ['p(95)<300'],
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
    if (i <= 3) console.log(`login #${i} -> ${r.status} ${r.body}`);
    let t;
    try { t = r.json('data.accessToken'); } catch (e) {}
    if (t) tokens.push(t);
  }
  if (!tokens.length) throw new Error('Login thất bại: xem log status/body ở trên');
  return { tokens };
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const p = (name) => ({
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    tags: { name },
  });

  const feed = http.get(
    `${BASE}/pets/feed?limit=10&lat=${rnd(10.7, 10.9)}&lng=${rnd(106.6, 106.8)}`, p('feed'));
  check(feed, { 'feed 200': (r) => r.status === 200 });
  let pets = [];
  try { pets = feed.json('data') || []; } catch (e) {}
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