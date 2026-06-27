/**
 * scripts/seed-verify-half-pending-medical-records.ts
 *
 * MỤC ĐÍCH:
 *   Với MỖI pet, lấy toàn bộ MedicalRecord đang ở trạng thái PENDING,
 *   random chọn ra ~50% trong số đó và chuyển verificationStatus -> VERIFIED.
 *   Phần còn lại giữ nguyên PENDING.
 *
 *   Sau khi update xong, xoá cache Redis `pet:detail:<petId>` cho TẤT CẢ
 *   pet bị ảnh hưởng, để app hiển thị trạng thái mới ngay (không cần đợi
 *   TTL cache tự hết hạn).
 *
 * CÁCH CHẠY:
 *   1) Dry-run trước để xem trước sẽ verify bao nhiêu record / pet nào,
 *      KHÔNG ghi gì vào DB và KHÔNG xoá cache:
 *
 *        npx ts-node scripts/seed-verify-half-pending-medical-records.ts --dry-run
 *
 *   2) Khi đã ưng kết quả dry-run, chạy thật:
 *
 *        npx ts-node scripts/seed-verify-half-pending-medical-records.ts
 *
 *   Tuỳ chọn:
 *     --seed=<number>   Đặt seed cho random để kết quả lựa chọn có thể
 *                        tái lập lại giống lần trước (debug/so sánh).
 *                        Ví dụ: --seed=42
 *
 * AN TOÀN:
 *   - Toàn bộ update nằm trong 1 transaction Prisma. Nếu có lỗi giữa
 *     đường, mọi thay đổi sẽ rollback, không có DB ở trạng thái nửa vời.
 *   - Việc random + update theo từng pet riêng biệt (không phải 1 lệnh
 *     updateMany toàn cục) để đảm bảo đúng yêu cầu "mỗi pet random 50%
 *     trên chính tập PENDING của pet đó", không bị lệch tỉ lệ toàn cục.
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis'; // Nếu project bạn dùng ioredis. Nếu dùng client khác, xem ghi chú ở RedisService bên dưới.

const prisma = new PrismaClient();

// ============================================================
// CẤU HÌNH REDIS — ĐIỀU CHỈNH CHO KHỚP VỚI RedisService THẬT CỦA BẠN
// ============================================================
// Script này tạo 1 kết nối Redis riêng, độc lập với NestJS DI container,
// vì đây là script chạy ngoài app (không qua Nest's RedisService).
// Nếu bạn dùng REDIS_URL trong .env, sửa lại theo đúng tên biến env của bạn.
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// ============================================================
// HELPER: parse CLI args
// ============================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const seedArg = args.find((a) => a.startsWith('--seed='));
  const seed = seedArg ? Number(seedArg.split('=')[1]) : undefined;
  return { isDryRun, seed };
}

// ============================================================
// HELPER: simple seedable PRNG (mulberry32) — chỉ dùng khi --seed được truyền,
// để có thể tái lập kết quả random giống lần trước nếu cần debug/so sánh.
// Khi không truyền --seed, dùng Math.random() bình thường.
// ============================================================
function createRng(seed?: number): () => number {
  if (seed === undefined) {
    return () => Math.random();
  }
  let a = seed >>> 0;
  return function mulberry32() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle dùng rng truyền vào, để random đều và có thể seed được
function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  const { isDryRun, seed } = parseArgs();
  const rng = createRng(seed);

  console.log('='.repeat(70));
  console.log('SEED: Verify random 50% PENDING medical records per pet');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (không ghi DB, không xoá cache)' : 'LIVE (sẽ ghi DB + xoá cache)'}`);
  if (seed !== undefined) console.log(`Random seed: ${seed} (kết quả có thể tái lập)`);
  console.log('='.repeat(70));

  // 1) Lấy toàn bộ record PENDING, group theo petId
  const pendingRecords = await prisma.medicalRecord.findMany({
    where: { verificationStatus: 'PENDING' },
    select: { id: true, petId: true, type: true, recordDate: true },
    orderBy: { petId: 'asc' },
  });

  if (pendingRecords.length === 0) {
    console.log('Không có medical record nào đang PENDING. Không có gì để làm.');
    await prisma.$disconnect();
    return;
  }

  // Group theo petId
  const byPet = new Map<string, typeof pendingRecords>();
  for (const r of pendingRecords) {
    const list = byPet.get(r.petId) ?? [];
    list.push(r);
    byPet.set(r.petId, list);
  }

  console.log(`Tổng số pet có record PENDING: ${byPet.size}`);
  console.log(`Tổng số record PENDING: ${pendingRecords.length}`);
  console.log('-'.repeat(70));

  // 2) Với mỗi pet, random chọn ~50% record để verify
  const idsToVerify: string[] = [];
  const affectedPetIds: string[] = [];
  let totalSelected = 0;

  for (const [petId, records] of byPet.entries()) {
    const shuffled = shuffleInPlace([...records], rng);
    // Math.round để 1 record -> chọn 1 (tránh trường hợp 0.5 record bị bỏ qua hoàn toàn);
    // nếu bạn muốn làm tròn xuống (an toàn hơn, verify ít hơn) đổi Math.round -> Math.floor.
    const countToVerify = Math.round(shuffled.length / 2);
    const selected = shuffled.slice(0, countToVerify);

    if (selected.length > 0) {
      idsToVerify.push(...selected.map((r) => r.id));
      affectedPetIds.push(petId);
      totalSelected += selected.length;
    }

    console.log(
      `Pet ${petId}: ${records.length} pending -> verify ${selected.length} (giữ PENDING ${records.length - selected.length})`
    );
  }

  console.log('-'.repeat(70));
  console.log(`TỔNG: sẽ verify ${totalSelected}/${pendingRecords.length} record, trên ${affectedPetIds.length} pet.`);
  console.log('-'.repeat(70));

  if (isDryRun) {
    console.log('Dry-run hoàn tất. Không có gì được ghi vào DB.');
    console.log('Chạy lại KHÔNG có --dry-run để áp dụng thật.');
    await prisma.$disconnect();
    return;
  }

  // 3) Update thật, trong 1 transaction
  console.log('Đang cập nhật DB...');
  await prisma.$transaction(async (tx) => {
    // updateMany với id IN (...) — nhanh hơn loop update từng record,
    // và vẫn đảm bảo đúng tập id đã chọn ngẫu nhiên ở bước trên.
    await tx.medicalRecord.updateMany({
      where: { id: { in: idsToVerify } },
      data: { verificationStatus: 'VERIFIED' },
    });
  });
  console.log(`Đã cập nhật ${idsToVerify.length} record thành VERIFIED.`);

  // 4) Xoá cache Redis cho từng pet bị ảnh hưởng
  console.log('Đang xoá cache Redis...');
  const redis = new Redis(REDIS_URL);
  try {
    let deletedCount = 0;
    for (const petId of affectedPetIds) {
      const key = `pet:detail:${petId}`;
      const result = await redis.del(key);
      if (result > 0) deletedCount++;
    }
    console.log(`Đã xoá cache cho ${deletedCount}/${affectedPetIds.length} pet (số còn lại có thể chưa có cache sẵn).`);
  } finally {
    redis.disconnect();
  }

  console.log('='.repeat(70));
  console.log('HOÀN TẤT.');
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('LỖI khi chạy script:', err);
  await prisma.$disconnect();
  process.exit(1);
});