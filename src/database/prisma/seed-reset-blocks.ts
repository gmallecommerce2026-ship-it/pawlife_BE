import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Bắt đầu reset toàn bộ trạng thái Hide/Block...');

  try {
    const [
      deletedHiddenPets,
      deletedBlockedShelters,
      deletedHiddenEvents,
      deletedUserBlocks,        // ✅ THÊM: block scanner trong tag report
      restoredTagReports,       // ✅ THÊM: unhide các TagReport bị ẩn
    ] = await prisma.$transaction([
      prisma.userHiddenPet.deleteMany({}),
      prisma.userBlockedShelter.deleteMany({}),
      prisma.userHiddenEvent.deleteMany({}),

      // Block scanner (tạo bởi reportTagReportItem khi isBlockRequested=true)
      prisma.userBlock.deleteMany({}),

      // Unhide các TagReport bị ẩn (bởi hide hoặc block)
      prisma.tagReport.updateMany({
        where: { isHidden: true },
        data: { isHidden: false, hiddenAt: null },
      }),
    ]);

    console.log('✅ Đã reset thành công:');
    console.log(`  - Bỏ ẩn Pet:        ${deletedHiddenPets.count}`);
    console.log(`  - Mở chặn Shelter:  ${deletedBlockedShelters.count}`);
    console.log(`  - Bỏ ẩn Event:      ${deletedHiddenEvents.count}`);
    console.log(`  - Mở chặn Scanner:  ${deletedUserBlocks.count}`);   // UserBlock rows
    console.log(`  - Khôi phục TagReport bị ẩn: ${restoredTagReports.count}`);
  } catch (error) {
    console.error('❌ Lỗi reset:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });