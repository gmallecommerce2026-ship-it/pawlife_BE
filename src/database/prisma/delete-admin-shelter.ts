import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const TARGET_EMAIL = 'admin@pawlife.vn';
  console.log(`🧹 Bắt đầu dọn dẹp Trạm cứu hộ bị bỏ lại...`);

  try {
    // Tìm Shelter theo email (Vì User đăng nhập đã bị xóa mất ở lần chạy trước)
    let shelterToDelete = await prisma.shelter.findFirst({
      where: { emailAddress: TARGET_EMAIL },
    });

    // Dự phòng: Nếu Trạm không lưu email này, hãy thử tìm theo Tên của Trạm cũ
    if (!shelterToDelete) {
       // Bạn có thể đổi 'Tên Trạm Ở Đây' thành tên trạm cũ nếu không tìm thấy qua email
       // shelterToDelete = await prisma.shelter.findFirst({ where: { name: 'Tên Trạm Ở Đây' } });
       console.log(`⚠️ Không tìm thấy Shelter nào chứa email: ${TARGET_EMAIL}`);
       return;
    }

    console.log(`🔍 Tìm thấy Shelter: ${shelterToDelete.name} (ID: ${shelterToDelete.id})`);

    // ==========================================
    // DỌN DẸP CÁC DỮ LIỆU ĐANG RÀNG BUỘC (FOREIGN KEYS)
    // ==========================================

    // 1. Xóa các Lịch hẹn (Appointment)
    // Trường shelterId trong bảng Appointment là bắt buộc, nên ta phải xoá lịch hẹn
    const deletedAppointments = await prisma.appointment.deleteMany({
      where: { shelterId: shelterToDelete.id },
    });
    console.log(`🧹 Đã xoá ${deletedAppointments.count} lịch hẹn (Appointment).`);

    // 2. Gỡ liên kết Thú cưng (Pet)
    // Để tránh xoá nhầm Pet gây lỗi dây chuyền, ta gỡ liên kết bằng cách set shelterId = null
    const updatedPets = await prisma.pet.updateMany({
      where: { shelterId: shelterToDelete.id },
      data: { shelterId: null },
    });
    console.log(`🧹 Đã gỡ liên kết ${updatedPets.count} thú cưng khỏi Trạm.`);

    // 3. Gỡ liên kết các Nhân viên khác (User)
    // Đề phòng Trạm có nhiều hơn 1 nhân viên, ta đưa shelterId của họ về null
    const updatedUsers = await prisma.user.updateMany({
      where: { shelterId: shelterToDelete.id },
      data: { shelterId: null },
    });
    console.log(`🧹 Đã gỡ liên kết ${updatedUsers.count} nhân viên khác khỏi Trạm.`);

    // ==========================================
    // XOÁ SHELTER CHÍNH
    // ==========================================
    const deletedShelter = await prisma.shelter.delete({
      where: { id: shelterToDelete.id },
    });
    
    console.log(`✅ Đã xóa dứt điểm Trạm cứu hộ: ${deletedShelter.name}`);
    console.log('🎉 Hoàn tất quá trình dọn dẹp!');
    
  } catch (error) {
    console.error('❌ Lỗi trong quá trình xóa dữ liệu:', error);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });