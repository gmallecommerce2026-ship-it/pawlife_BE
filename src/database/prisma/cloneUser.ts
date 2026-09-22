import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt'; // Hoặc 'bcryptjs'

const prisma = new PrismaClient();

async function main() {
  const SOURCE_EMAIL = 'hello@pawlife.vn'; 
  const TARGET_EMAIL = 'sannhanhieucho@gmail.com';
  const TARGET_PASSWORD = 'Sannhanhieucho@2026';

  console.log(`🚀 Bắt đầu nhân bản dữ liệu từ [${SOURCE_EMAIL}] sang [${TARGET_EMAIL}]...`);

  // 1. Kiểm tra xem user đích đã tồn tại chưa
  const existingTargetUser = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
  });

  if (existingTargetUser) {
    console.log(`⚠️ User [${TARGET_EMAIL}] đã tồn tại trong DB. Vui lòng xóa trước hoặc chọn email khác!`);
    return;
  }

  // 2. TÌM USER GỐC (Chỉ lấy thông tin user, không dùng include để tránh lỗi type)
  const sourceUser = await prisma.user.findUnique({
    where: { email: SOURCE_EMAIL }
  });

  if (!sourceUser) {
    console.error(`❌ Không tìm thấy user gốc với email: ${SOURCE_EMAIL}`);
    return;
  }

  // Chuẩn bị mật khẩu mới
  const hashedPassword = await bcrypt.hash(TARGET_PASSWORD, 10);
  
  // Tách bỏ id và ngày tháng
  const { id, createdAt, updatedAt, email, password, phone, ...baseUserData } = sourceUser as any;

  // Xử lý chống trùng lặp số điện thoại (nếu schema có @unique)
  const newPhone = phone ? `${phone.slice(0, -2)}99` : null;

  // 3. TẠO USER MỚI
  const newUser = await prisma.user.create({
    data: {
      ...baseUserData,
      email: TARGET_EMAIL,
      password: hashedPassword,
      phone: newPhone,
    }
  });
  console.log(`✨ Đã tạo thành công User mới: ${newUser.id}`);

  // 4. CLONE DANH SÁCH THÚ CƯNG (MY PETS)
  // LƯU Ý: Đổi `ownerId` thành tên field chính xác trong schema Pet của bạn (ví dụ: userId)
  const sourcePets = await prisma.pet.findMany({
    where: { ownerId: sourceUser.id } 
  });

  let petsCount = 0;
  for (const pet of sourcePets) {
    const { id, createdAt, updatedAt, ownerId, ...petData } = pet as any;
    await prisma.pet.create({
      data: {
        ...petData,
        ownerId: newUser.id // Gán ID của user mới
      }
    });
    petsCount++;
  }
  console.log(`   👉 Đã copy ${petsCount} bé thú cưng`);

  // 5. CLONE DANH SÁCH ĐƠN NHẬN NUÔI (APPLICATIONS)
  // LƯU Ý: Nếu model của bạn tên khác, hãy đổi `prisma.application` thành `prisma.tên_model`
  const sourceApps = await prisma.adoptionApplication.findMany({ // <--- SỬA Ở ĐÂY
    where: { userId: sourceUser.id }
  });

  let appsCount = 0;
  for (const app of sourceApps) {
    const { id, createdAt, updatedAt, userId, ...appData } = app as any;
    await prisma.adoptionApplication.create({
      data: {
        ...appData,
        userId: newUser.id // Gán ID của user mới
      }
    });
    appsCount++;
  }
  console.log(`   👉 Đã copy ${appsCount} đơn nhận nuôi`);
  console.log(`✅ HOÀN TẤT QUÁ TRÌNH NHÂN BẢN!`);
}

main()
  .catch((e) => {
    console.error("❌ Có lỗi xảy ra trong quá trình seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });