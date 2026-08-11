// database/scripts/seed-shelter.ts
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

// Hàm hỗ trợ quét và xóa Cache Redis theo Pattern
async function clearKeysByPattern(redisClient: Redis, pattern: string): Promise<number> {
  let cursor = '0';
  let count = 0;
  do {
    const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redisClient.del(...keys);
      count += keys.length;
    }
  } while (cursor !== '0');
  return count;
}

async function main() {
  const email = 'abc@gmail.com';
  const password = 'PawLife@2026';
  const shelterName = 'Sân Nhà Nhiều Chó Shelter';
  const lat = 21.0285;
  const lng = 105.8542;

  console.log(`\n==================================================`);
  console.log(`🔄 BẮT ĐẦU QUÁ TRÌNH DỌN DẸP VÀ SEED DỮ LIỆU TỪ ĐẦU`);
  console.log(`==================================================\n`);

  // =====================================================================
  // BƯỚC 1: TÌM VÀ XÓA TÀI KHOẢN TRÙNG EMAIL (NẾU CÓ)
  // =====================================================================
  console.log(`[1] Đang kiểm tra tài khoản: "${email}"...`);
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    console.log(` -> Phát hiện tài khoản cũ. Tiến hành xóa tận gốc...`);
    await prisma.$transaction(async (tx) => {
      // Xoá các bản ghi phụ thuộc tránh dính khóa ngoại (Restrict/Cascade)
      await tx.deviceSession.deleteMany({ where: { userId: existingUser.id } });
      await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: existingUser.id }, { blockedId: existingUser.id }] } });
      await tx.report.deleteMany({ where: { userId: existingUser.id } });
      await tx.followedShelter.deleteMany({ where: { userId: existingUser.id } });
      await tx.userBlockedShelter.deleteMany({ where: { userId: existingUser.id } });
      await tx.transferRequest.deleteMany({ where: { OR: [{ senderId: existingUser.id }, { receiverId: existingUser.id }] } });
      await tx.adoptionApplication.deleteMany({ where: { userId: existingUser.id } });
      
      // Xoá user
      await tx.user.delete({ where: { id: existingUser.id } });
    });
    console.log(` -> Đã xóa thành công tài khoản cũ.`);
  }

  // =====================================================================
  // BƯỚC 2: XÓA TOÀN BỘ PET CỦA TẤT CẢ CÁC SHELTER KHÁC
  // =====================================================================
  console.log(`\n[2] Đang dọn dẹp toàn bộ Thú cưng thuộc các Trạm cứu hộ cũ...`);
  const shelterPets = await prisma.pet.findMany({
    where: { shelterId: { not: null } },
    select: { id: true }
  });
  const petIds = shelterPets.map(p => p.id);

  if (petIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      // 1. Nhả Tag (Vòng cổ) về trạng thái INACTIVE
      await tx.tag.updateMany({
        where: { petId: { in: petIds } },
        data: { status: 'INACTIVE', petId: null, linkedAt: null }
      });
      // 2. Xóa các yêu cầu chuyển nhượng và nhận nuôi liên quan
      await tx.transferRequest.deleteMany({ where: { petId: { in: petIds } } });
      await tx.adoptionApplication.deleteMany({ where: { petId: { in: petIds } } });
      // 3. Xoá Pet (Medical, Images, Traits... sẽ tự động bị xóa do có Cascade)
      await tx.pet.deleteMany({ where: { id: { in: petIds } } });
    });
    console.log(` -> Đã xóa ${petIds.length} thú cưng và giải phóng các vòng cổ liên quan.`);
  } else {
    console.log(` -> Không có thú cưng nào thuộc Trạm cần xóa.`);
  }

  // =====================================================================
  // BƯỚC 3: XÓA TOÀN BỘ SHELTER TRONG HỆ THỐNG
  // =====================================================================
  console.log(`\n[3] Đang dọn dẹp toàn bộ các Trạm cứu hộ (Shelter)...`);
  
  // Tách Shelter ra khỏi User cũ (để tránh lỗi khóa ngoại)
  await prisma.user.updateMany({
    where: { shelterId: { not: null } },
    data: { shelterId: null, role: 'USER' } // Hạ cấp xuống USER bình thường
  });

  // Xóa các bảng liên kết với Shelter
  await prisma.followedShelter.deleteMany({});
  await prisma.userBlockedShelter.deleteMany({});

  // Tiến hành xóa toàn bộ bảng Shelter
  const deletedShelters = await prisma.shelter.deleteMany({});
  console.log(` -> Đã xóa ${deletedShelters.count} Trạm cứu hộ cũ khỏi Database.`);

  // =====================================================================
  // BƯỚC 4: KHỞI TẠO TÀI KHOẢN MỚI
  // =====================================================================
  console.log(`\n[4] Đang khởi tạo Trạm cứu hộ mới: ${shelterName}...`);
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.$transaction(async (tx) => {
    const shelter = await tx.shelter.create({
      data: {
        name: shelterName,
        address: '198 Phố ABC, Hà Nội',
        contactInfo: '0912345678',
        emailAddress: email,
        isVerified: true,
        latitude: lat,
        longitude: lng,
        shelterType: 'Animal Shelter & Rescue',
        bio: 'Trạm cứu hộ độc quyền được tạo qua Seed Script.',
      },
    });

    return tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Trưởng Trạm Sân Nhà',
        phone: '0912345678',
        role: 'SHELTER',
        shelterId: shelter.id,
      },
    });
  });
  console.log(` -> ✅ Đã tạo thành công User (ID: ${newUser.id}) và Shelter (ID: ${newUser.shelterId}).`);

  // =====================================================================
  // BƯỚC 5: LÀM SẠCH VÀ ĐỒNG BỘ REDIS CACHE
  // =====================================================================
  console.log(`\n[5] Đang dọn dẹp và đồng bộ Redis Cache...`);
  
  // Xóa tọa độ cũ
  await redis.del('shelters:locations');
  // Dọn dẹp toàn bộ rác cache của Shelter và Pet
  const shelterKeys = await clearKeysByPattern(redis, 'shelters:*');
  const petKeys = await clearKeysByPattern(redis, 'pet:detail:*');
  console.log(` -> Đã dọn dẹp ${shelterKeys} khóa Shelter và ${petKeys} khóa Pet Detail.`);

  if (newUser.shelterId) {
    // Đăng ký tọa độ Trạm mới vào bản đồ
    await redis.geoadd('shelters:locations', lng, lat, newUser.shelterId);
    
    // Bump Global Version để reset cache toàn hệ thống
    const currentGlobalVersion = (await redis.get('shelters:cache_version:global')) || 0;
    await redis.set('shelters:cache_version:global', Number(currentGlobalVersion) + 1);
    console.log(` -> Đã đồng bộ tọa độ Trạm mới lên Redis.`);
  }

  console.log('\n🎉 TOÀN BỘ QUÁ TRÌNH SEED ĐÃ HOÀN TẤT THÀNH CÔNG!');
}

main()
  .catch((e) => {
    console.error('Lỗi nghiêm trọng trong quá trình chạy Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });