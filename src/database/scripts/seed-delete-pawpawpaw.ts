// database/scripts/seed-delete-pawpawpaw.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Có thể truyền tên khác qua CLI khi chạy:
//   npx ts-node database/scripts/seed-delete-pawpawpaw.ts "TenKhac"
// Nếu không truyền gì, mặc định xoá theo tên "Pawpawpaw"
const targetName = process.argv[2] || 'Pawpawpaw';

async function main() {
  console.log(`Đang tìm kiếm tài khoản có tên: "${targetName}"...`);

  // 1. Tìm TẤT CẢ user trùng tên (name không phải trường unique nên có thể trùng nhiều account test)
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
    await deleteUserAndShelter(user.id, user.email, user.shelterId, user.shelter?.name, user.shelter?.isVerified);
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
    // 1. Xoá các bản ghi PHỤ THUỘC vào User trước, tránh lỗi FK constraint khi xoá User.
    //    ⚠️ Điều chỉnh danh sách model bên dưới nếu schema thực tế của bạn khác.
    await tx.deviceSession.deleteMany({ where: { userId } });
    await tx.userBlock.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
    await tx.report.deleteMany({ where: { userId } });
    await tx.followedShelter.deleteMany({ where: { userId } });
    await tx.userBlockedShelter.deleteMany({ where: { userId } });

    // 2. Xoá User (phải xoá trước Shelter vì User đang giữ khoá shelterId)
    await tx.user.delete({ where: { id: userId } });
    console.log(`   🗑️  Đã xoá User: ${email}`);

    if (!shelterId) return;

    // 3. Nếu Shelter đã có pet thật (không phải test rỗng) thì KHÔNG tự xoá,
    //    để tránh mất dữ liệu ngoài ý muốn — chỉ cảnh báo để bạn tự kiểm tra.
    const petCount = await tx.pet.count({ where: { shelterId } });
    if (petCount > 0) {
      console.log(
        `   ⚠️  Shelter "${shelterName}" (id=${shelterId}) đang có ${petCount} pet(s). ` +
        `Bỏ qua xoá Shelter để tránh mất dữ liệu — vui lòng kiểm tra thủ công nếu vẫn muốn xoá.`,
      );
      return;
    }

    // 4. Xoá các bản ghi phụ thuộc Shelter rồi xoá Shelter
    await tx.followedShelter.deleteMany({ where: { shelterId } });
    await tx.userBlockedShelter.deleteMany({ where: { shelterId } });
    await tx.shelter.delete({ where: { id: shelterId } });

    console.log(
      `   🗑️  Đã xoá Shelter: "${shelterName}" (id=${shelterId}, isVerified trước đó=${shelterVerified})`,
    );
  });
}

main()
  .catch((e) => {
    console.error('❌ Lỗi trong quá trình chạy Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });