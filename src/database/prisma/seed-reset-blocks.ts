import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Bắt đầu quá trình reset toàn bộ trạng thái Block/Hide...');

  try {
    // Sử dụng transaction để đảm bảo an toàn dữ liệu. 
    // Nếu có lỗi ở 1 bảng, toàn bộ quá trình sẽ rollback.
    const [deletedUserBlocks, deletedShelterBlocks, deletedHiddenEvents] = await prisma.$transaction([
      prisma.userBlock.deleteMany({}),
      prisma.userBlockedShelter.deleteMany({}),
      prisma.userHiddenEvent.deleteMany({})
    ]);

    console.log('✅ Đã reset thành công:');
    console.log(`  - Đã mở chặn (unblock) ${deletedUserBlocks.count} lượt chặn giữa các User/Pet.`);
    console.log(`  - Đã mở chặn (unblock) ${deletedShelterBlocks.count} lượt chặn Shelter.`);
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
    // Luôn nhớ ngắt kết nối database sau khi xong
    await prisma.$disconnect();
  });