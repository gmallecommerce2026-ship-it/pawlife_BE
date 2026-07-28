// database/scripts/seed-shelter.ts
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Khởi tạo Redis giống chuẩn của hệ thống hiện tại
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

async function main() {
  // Thay đổi thông tin tài khoản tại đây
  const email = 'demo_shelter@pawlife.vn';
  const password = 'Password123!';
  const shelterName = 'PawLife Hope Shelter';

  console.log(`Đang kiểm tra tài khoản: "${email}"...`);

  // 1. Kiểm tra User đã tồn tại chưa
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log(`Tài khoản ${email} đã tồn tại. Hủy bỏ quá trình seed.`);
    return;
  }

  // 2. Hash mật khẩu (Sử dụng bcrypt với saltRounds = 10 giống AuthService)
  const hashedPassword = await bcrypt.hash(password, 10);

  // Tọa độ giả định của Trạm (Hà Nội)
  const lat = 21.0285;
  const lng = 105.8542;

  console.log('Đang khởi tạo Transaction tạo Trạm và Tài khoản...');

  // 3. Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
  const newUser = await prisma.$transaction(async (tx) => {
    // Tạo bảng Shelter trước
    const shelter = await tx.shelter.create({
      data: {
        name: shelterName,
        address: '198 Phố ABC, Hà Nội',
        contactInfo: '0912345678',
        emailAddress: email,
        isVerified: true, // Tự động verified để tài khoản có thể dùng ngay
        latitude: lat,
        longitude: lng,
        shelterType: 'Animal Shelter & Rescue',
        bio: 'Trạm cứu hộ động vật được tạo tự động thông qua Seed Script.',
      },
    });

    // Tạo bảng User và liên kết với Shelter
    return tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Shelter Admin',
        phone: '0912345678',
        role: 'SHELTER', // Chỉ định Role SHELTER
        shelterId: shelter.id,
      },
    });
  });

  console.log(`✅ Đã tạo thành công User (ID: ${newUser.id}) và Shelter (ID: ${newUser.shelterId}).`);

  // 4. Đồng bộ Redis Cache
  if (newUser.shelterId) {
    console.log('Đang cập nhật vị trí lên Redis Geo Set (shelters:locations)...');
    await redis.geoadd('shelters:locations', lng, lat, newUser.shelterId);

    console.log('Đang Bump Global Cache Version để xóa cache cũ của hệ thống...');
    const currentGlobalVersion = (await redis.get('shelters:cache_version:global')) || 0;
    await redis.set('shelters:cache_version:global', Number(currentGlobalVersion) + 1);
  }

  console.log('\n🎉 Seed dữ liệu Shelter hoàn tất!');
}

main()
  .catch((e) => {
    console.error('Lỗi nghiêm trọng trong quá trình chạy Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Đóng kết nối an toàn
    await prisma.$disconnect();
    redis.disconnect();
  });