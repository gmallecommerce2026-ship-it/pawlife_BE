import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Bắt đầu quá trình reset toàn bộ trạng thái Hide/Block...');

  try {
    // Sử dụng transaction để đảm bảo an toàn dữ liệu.
    // Nếu có lỗi ở 1 bảng, toàn bộ quá trình sẽ rollback.
    const [deletedHiddenPets, deletedBlockedShelters, deletedHiddenEvents] = await prisma.$transaction([
      prisma.userHiddenPet.deleteMany({}),       // Ẩn Pet (pet-detail-modal, matching screen)
      prisma.userBlockedShelter.deleteMany({}),  // Chặn Shelter (pet-detail-modal, matching, shelter-profile)
      prisma.userHiddenEvent.deleteMany({}),     // Ẩn Event (event-detail)
    ]);

    console.log('✅ Đã reset thành công:');
    console.log(`  - Đã bỏ ẩn (unhide) ${deletedHiddenPets.count} lượt ẩn Pet.`);
    console.log(`  - Đã mở chặn (unblock) ${deletedBlockedShelters.count} lượt chặn Shelter.`);
    console.log(`  - Đã bỏ ẩn (unhide) ${deletedHiddenEvents.count} lượt ẩn Event.`);

    console.log('🎉 Hoàn tất quá trình seed!');
  } catch (error) {
    console.error('❌ Lỗi trong quá trình reset trạng thái:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });