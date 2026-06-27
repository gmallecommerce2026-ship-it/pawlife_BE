/**
 * scripts/flush-pet-detail-cache.ts
 *
 * MỤC ĐÍCH:
 *   Xoá toàn bộ cache `pet:detail:*` trên Redis. Dùng trong trường hợp
 *   đã update DB xong (ví dụ qua script verify medical records) nhưng
 *   bước xoá cache bị lỗi (sai auth, sai host...) nên cache cũ còn sót.
 *
 *   Thay vì chạy lại toàn bộ script update DB (không cần thiết, vì DB
 *   đã đúng rồi), chạy script NHỎ này để xoá cache ngay.
 *
 * CÁCH CHẠY:
 *   npx ts-node -r dotenv/config scripts/flush-pet-detail-cache.ts
 *
 * LƯU Ý CẤU HÌNH REDIS:
 *   Xem README.md hoặc comment trong seed-verify-half-pending-medical-records.ts
 *   để biết cách set đúng REDIS_URL hoặc REDIS_HOST/PORT/PASSWORD trong .env.
 */

import 'dotenv/config';
import Redis from 'ioredis';

function createRedisClient(): Redis {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL);
  }
  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
  });
}

async function main() {
  const redis = createRedisClient();
  redis.on('error', (err) => {
    console.error(`[Redis] Lỗi kết nối: ${err.message}`);
  });

  try {
    // SCAN thay vì KEYS để an toàn hơn trên Redis production (KEYS block toàn bộ server
    // nếu có nhiều key; SCAN duyệt theo cursor, không block).
    let cursor = '0';
    const allKeys: string[] = [];
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'pet:detail:*', 'COUNT', 100);
      cursor = nextCursor;
      allKeys.push(...keys);
    } while (cursor !== '0');

    if (allKeys.length === 0) {
      console.log('Không có cache pet:detail:* nào trên Redis.');
    } else {
      // del hỗ trợ nhiều key trong 1 lệnh
      const deleted = await redis.del(...allKeys);
      console.log(`Đã xoá ${deleted}/${allKeys.length} cache key (pet:detail:*).`);
    }
  } catch (err: any) {
    console.error('Lỗi khi xoá cache:', err?.message || err);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

main();