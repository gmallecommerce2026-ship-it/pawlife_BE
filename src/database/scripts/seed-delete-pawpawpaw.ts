// database/scripts/seed-delete-pawpawpaw.ts
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

const prisma = new PrismaClient();

// ⚠️ Script này chạy độc lập (không phải qua NestJS DI) nên KHÔNG dùng được
// RedisService của app — phải tự kết nối ioredis trực tiếp ở đây.
// Dùng đúng các biến env giống main.ts (REDIS_HOST/REDIS_PORT/REDIS_PASSWORD).
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

const targetName = process.argv[2] || 'Pawpawpaw';

async function main() {
  console.log(`Đang tìm kiếm tài khoản có tên: "${targetName}"...`);

  const users = await prisma.user.findMany({
    where: { name: targetName },
    include: { shelter: true },
  });

  if (users.length === 0) {
    console.log(`❌ Không tìm thấy user nào có tên "${targetName}".`);
    return;
  }

  if (users.length > 1) {
    console.log(`⚠️  Tìm thấy ${users.length} user trùng tên "${targetName}":`);
    users.forEach((u) => console.log(`    - id=${u.id} email=${u.email} role=${u.role}`));
    console.log('    Script sẽ xoá TẤT CẢ các tài khoản này. Nếu chỉ muốn xoá 1 tài khoản cụ thể,');
    console.log('    hãy sửa điều kiện where bên dưới thành { email: "..." } thay vì { name }.');
  }

  for (const user of users) {
    // 1. Lấy trước danh sách deviceSession (để biết sessionId cần xoá khỏi Redis)
    //    — phải lấy TRƯỚC khi transaction xoá deviceSession khỏi Postgres.
    const sessions = await prisma.deviceSession.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    await deleteUserAndShelter(
      user.id,
      user.email,
      user.shelterId,
      user.shelter?.name,
      user.shelter?.isVerified,
    );

    await cleanupRedis({
      userId: user.id,
      shelterId: user.shelterId,
      sessionIds: sessions.map((s) => s.id),
    });
  }

  console.log('\n✅ Hoàn tất.');
}

async function deleteUserAndShelter(
  userId: string,
  email: string,
  shelterId: string | null,
  shelterName?: string,
  shelterVerified?: boolean,
) {
  console.log(`\n--- Đang xử lý user email="${email}" (id=${userId}) ---`);

  await prisma.$transaction(async (tx) => {
    await tx.deviceSession.deleteMany({ where: { userId } });
    await tx.userBlock.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
    await tx.report.deleteMany({ where: { userId } });
    await tx.followedShelter.deleteMany({ where: { userId } });
    await tx.userBlockedShelter.deleteMany({ where: { userId } });

    await tx.user.delete({ where: { id: userId } });
    console.log(`   🗑️  Đã xoá User: ${email}`);

    if (!shelterId) return;

    const petCount = await tx.pet.count({ where: { shelterId } });
    if (petCount > 0) {
      console.log(
        `   ⚠️  Shelter "${shelterName}" (id=${shelterId}) đang có ${petCount} pet(s). ` +
        `Bỏ qua xoá Shelter để tránh mất dữ liệu — vui lòng kiểm tra thủ công nếu vẫn muốn xoá.`,
      );
      return;
    }

    await tx.followedShelter.deleteMany({ where: { shelterId } });
    await tx.userBlockedShelter.deleteMany({ where: { shelterId } });
    await tx.shelter.delete({ where: { id: shelterId } });

    console.log(
      `   🗑️  Đã xoá Shelter: "${shelterName}" (id=${shelterId}, isVerified trước đó=${shelterVerified})`,
    );
  });
}

async function cleanupRedis(params: {
  userId: string;
  shelterId: string | null;
  sessionIds: string[];
}) {
  const { userId, shelterId, sessionIds } = params;
  console.log('   🧹 Đang dọn Redis cache liên quan...');

  // 1. Xoá session cache — nếu không xoá, JWT cũ của tài khoản này vẫn có thể
  //    được coi là "active" bởi JwtAuthGuard cho tới khi Redis TTL tự hết hạn.
  for (const sessionId of sessionIds) {
    await redis.del(`auth:session:${sessionId}`);
  }
  if (sessionIds.length > 0) {
    console.log(`      - Đã xoá ${sessionIds.length} key auth:session:*`);
  }

  // 2. Xoá cache profile (nếu có nơi nào đó cache theo key này)
  await redis.del(`auth:user_profile:${userId}`);

  if (shelterId) {
    // 3. Xoá khỏi Geo Set "shelters:locations" — nếu không xoá, ID rác sẽ tồn tại
    //    vĩnh viễn trong Geo Index (mobile "tìm gần đây" có thể trả về ID không
    //    còn tồn tại trong Postgres, gây lãng phí 1 slot trong kết quả limit).
    const removed = await redis.zrem('shelters:locations', shelterId);
    if (removed > 0) {
      console.log(`      - Đã xoá shelter khỏi Geo Set shelters:locations`);
    }
  }

  // 4. QUAN TRỌNG NHẤT: xoá toàn bộ cache danh sách/tìm-gần-đây, vì các cache này
  //    lưu nguyên JSON đã format sẵn (bao gồm cả data của shelter vừa xoá) với TTL
  //    tới 1 tiếng (findAll) / 10 phút (nearby) — không có version nào được bump
  //    khi xoá thủ công qua script, nên phải xoá thẳng theo pattern.
  const listKeysRemoved = await clearKeysByPattern('shelters:all:*');
  const nearbyKeysRemoved = await clearKeysByPattern('shelters:nearby:*');
  console.log(
    `      - Đã xoá ${listKeysRemoved} key shelters:all:*, ${nearbyKeysRemoved} key shelters:nearby:*`,
  );
}

// Dùng SCAN thay vì KEYS để không block Redis nếu dataset lớn.
async function clearKeysByPattern(pattern: string): Promise<number> {
  let cursor = '0';
  let count = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
      count += keys.length;
    }
  } while (cursor !== '0');
  return count;
}

main()
  .catch((e) => {
    console.error('❌ Lỗi trong quá trình chạy Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });