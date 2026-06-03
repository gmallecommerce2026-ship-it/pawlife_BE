import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt'; // Hoặc 'bcryptjs' tùy thư viện bạn đang dùng

const prisma = new PrismaClient();

async function main() {
  const SOURCE_EMAIL = 'pawlife@hello.vn'; 
  const TARGET_EMAIL = 'sannhanhieucho@gmail.com';
  const TARGET_PASSWORD = 'Sannhanhieucho@2026';

  console.log(`🚀 Bắt đầu nhân bản dữ liệu từ [${SOURCE_EMAIL}] sang [${TARGET_EMAIL}]...`);

  // 1. Kiểm tra xem user đích đã tồn tại chưa để tránh lỗi
  const existingTargetUser = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
  });

  if (existingTargetUser) {
    console.log(`⚠️ User [${TARGET_EMAIL}] đã tồn tại trong DB. Vui lòng xóa trước hoặc chọn email khác!`);
    return;
  }

  // 2. Tìm user gốc KÈM THEO dữ liệu liên quan (Pets, Applications)
  const sourceUser = await prisma.user.findUnique({
    where: { email: SOURCE_EMAIL },
    include: {
      pets: true,         // Lấy toàn bộ thú cưng của user này
      applications: true, // Lấy toàn bộ đơn đăng ký nhận nuôi
    }
  });

  if (!sourceUser) {
    console.error(`❌ Không tìm thấy user gốc với email: ${SOURCE_EMAIL}`);
    return;
  }

  // 3. Chuẩn bị dữ liệu cho User mới
  const hashedPassword = await bcrypt.hash(TARGET_PASSWORD, 10);
  
  // Tách bỏ các trường không được copy (id, ngày tháng, các mảng relation)
  const { 
    id, createdAt, updatedAt, email, password, phone, 
    pets, applications, ...baseUserData 
  } = sourceUser;

  // Xử lý chống trùng lặp số điện thoại (Nếu schema của bạn set phone là @unique)
  // Ở đây tôi fake tạm bằng cách thêm chữ số vào đuôi số cũ
  const newPhone = phone ? `${phone.slice(0, -2)}99` : null;

  // 4. Tạo User mới và nhân bản luôn Pets + Applications thông qua Nested Writes
  console.log("⏳ Đang tiến hành ghi xuống Database...");

  const newUser = await prisma.user.create({
    data: {
      ...baseUserData,
      email: TARGET_EMAIL,
      password: hashedPassword,
      phone: newPhone,
      
      // Copy mảng Pets (loại bỏ id và relation keys)
      pets: {
        create: pets.map((pet) => {
          const { id, createdAt, updatedAt, ownerId, ...petData } = pet;
          return petData;
        })
      },

      // Copy mảng Applications (loại bỏ id và relation keys)
      applications: {
        create: applications.map((app) => {
          const { id, createdAt, updatedAt, userId, petId, ...appData } = app;
          return {
            ...appData,
            // Chú ý: Đơn nhận nuôi thường trỏ tới 1 con pet cụ thể (petId). 
            // Nếu bạn muốn giữ nguyên lịch sử, ta truyền lại petId gốc.
            petId: petId 
          };
        })
      }
    }
  });

  console.log(`✨ Hoàn tất! Đã tạo thành công User mới:`);
  console.log(`   👉 ID: ${newUser.id}`);
  console.log(`   👉 Đã copy ${pets.length} bé thú cưng`);
  console.log(`   👉 Đã copy ${applications.length} đơn nhận nuôi`);
}

main()
  .catch((e) => {
    console.error("❌ Có lỗi xảy ra trong quá trình seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });