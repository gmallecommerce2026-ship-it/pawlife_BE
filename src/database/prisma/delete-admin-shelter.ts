import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const TARGET_EMAIL = 'admin@pawlife.vn';
  console.log(`🧹 Bắt đầu XÓA TẬN GỐC Trạm, Thú cưng và Tài khoản...`);

  try {
    // 1. Tìm Trạm cứu hộ cùng toàn bộ danh sách Pet và User
    const shelterToDelete = await prisma.shelter.findFirst({
      where: { emailAddress: TARGET_EMAIL },
      include: {
        pets: { select: { id: true } },
        users: { select: { id: true } }
      }
    });

    if (!shelterToDelete) {
       console.log(`⚠️ Không tìm thấy Shelter nào chứa email: ${TARGET_EMAIL}`);
       return;
    }

    const shelterId = shelterToDelete.id;
    const petIds = shelterToDelete.pets.map(p => p.id);
    const userIds = shelterToDelete.users.map(u => u.id);

    console.log(`🔍 TÌM THẤY Trạm: ${shelterToDelete.name} (ID: ${shelterId})`);
    console.log(`   🐾 ${petIds.length} Pet cần xóa.`);
    console.log(`   👥 ${userIds.length} User cần xóa.`);

    // ==========================================
    // BƯỚC 1: DỌN DẸP RÀNG BUỘC CỦA THÚ CƯNG (PET)
    // ==========================================
    if (petIds.length > 0) {
      console.log('⏳ Đang dọn dẹp dữ liệu ràng buộc của Pet...');
      await prisma.appointment.deleteMany({ where: { petId: { in: petIds } } });
      await prisma.adoptionApplication.deleteMany({ where: { petId: { in: petIds } } });
      await prisma.adoptionRequest.deleteMany({ where: { petId: { in: petIds } } });
      await prisma.transferRequest.deleteMany({ where: { petId: { in: petIds } } });
      await prisma.petNote.deleteMany({ where: { petId: { in: petIds } } });
      
      // Với Vòng cổ (Tag), chỉ gỡ liên kết (setNull) chứ không xoá vật lý vòng cổ
      await prisma.tag.updateMany({
        where: { petId: { in: petIds } },
        data: { petId: null, status: 'INACTIVE', linkedAt: null }
      });

      const deletedPets = await prisma.pet.deleteMany({ where: { shelterId } });
      console.log(`✅ Đã xóa ${deletedPets.count} Thú cưng.`);
    }

    // ==========================================
    // BƯỚC 2: DỌN DẸP RÀNG BUỘC CỦA TÀI KHOẢN (USER)
    // ==========================================
    if (userIds.length > 0) {
      console.log('⏳ Đang dọn dẹp dữ liệu ràng buộc của User...');
      
      // Xóa lời mời làm việc
      await prisma.shelterInvitation.deleteMany({ where: { invitedById: { in: userIds } } });
      
      // Xóa lịch hẹn, ghi chú, tin nhắn, và báo cáo (do schema không cascade)
      await prisma.appointment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.petNote.deleteMany({ where: { authorId: { in: userIds } } });
      await prisma.message.deleteMany({ where: { senderId: { in: userIds } } });
      await prisma.chatRoomUser.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userHiddenEvent.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.eventReport.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.report.deleteMany({ where: { userId: { in: userIds } } });

      const deletedUsers = await prisma.user.deleteMany({ where: { shelterId } });
      console.log(`✅ Đã xóa ${deletedUsers.count} Nhân viên/Tài khoản.`);
    }

    // ==========================================
    // BƯỚC 3: XOÁ TRẠM CỨU HỘ (SHELTER)
    // ==========================================
    // Đề phòng còn sót Appointment nào chỉ liên kết với Shelter
    await prisma.appointment.deleteMany({ where: { shelterId } });

    const deletedShelter = await prisma.shelter.delete({
      where: { id: shelterId },
    });
    
    console.log(`✅ Đã xóa dứt điểm Trạm cứu hộ: ${deletedShelter.name}`);
    console.log('🎉 Hoàn tất dọn dẹp TOÀN BỘ rác dữ liệu!');
    
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