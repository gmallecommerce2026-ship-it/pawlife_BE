/**
 * Xoá 1 shelter TRÙNG TÊN "Sân Nhà Nhiều Chó" (mặc định id = seed-shelter-1) kể cả khi nó có pet.
 *
 * Mặc định chạy ở chế độ THỬ (dry-run): chỉ in ra sẽ làm gì, KHÔNG thay đổi dữ liệu.
 *
 *   Chạy thử:           npx ts-node prisma/seed-remove-duplicate-shelter.ts
 *   Xoá thật:           npx ts-node prisma/seed-remove-duplicate-shelter.ts --apply
 *
 * Tuỳ chọn:
 *   --id=<shelterId>    Xoá shelter có id khác (mặc định: seed-shelter-1)
 *   --move-pets         Chuyển pet của shelter bị xoá sang shelter giữ lại, thay vì xoá pet
 *   --force             Cho phép xoá pet dù pet có dấu hiệu là dữ liệu thật (xem bên dưới)
 *
 * Chạy từ thư mục gốc dự án (nơi có file .env) để Prisma đọc được DATABASE_URL.
 *
 * Các lớp bảo vệ:
 *  1. Shelter bị xoá phải thật sự tên "Sân Nhà Nhiều Chó" (so khớp bỏ qua khác biệt Unicode/khoảng trắng).
 *  2. Phải còn ít nhất 1 shelter cùng tên có pet để giữ lại, và shelter bị xoá phải có ÍT pet hơn
 *     shelter giữ lại (tránh xoá nhầm shelter 160 pet).
 *  3. Dừng nếu shelter có nhân viên (user.shelterId).
 *  4. Khi xoá pet: dừng nếu có pet đã ADOPTED, hoặc pet có đơn nhận nuôi / yêu cầu chuyển nhượng,
 *     vì đó có thể là dữ liệu thật của người dùng. Dùng --move-pets hoặc --force để vượt qua.
 *  5. Mọi thứ nằm trong 1 transaction, kiểm tra lại ngay trước khi xoá. Có lỗi là rollback toàn bộ.
 *  6. Khi xoá pet, nhả các QR tag đang gắn về INACTIVE (giống hàm removePet trong PetsService).
 */
import { PrismaClient } from '@prisma/client';

const TARGET_NAME = 'Sân Nhà Nhiều Chó';
const DEFAULT_SHELTER_ID = 'seed-shelter-1';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const MOVE_PETS = args.includes('--move-pets');
const FORCE = args.includes('--force');
const SHELTER_ID =
  args.find((a) => a.startsWith('--id='))?.slice('--id='.length).trim() || DEFAULT_SHELTER_ID;

const prisma = new PrismaClient();

const normalizeName = (s: string) =>
  s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

async function main() {
  console.log(
    APPLY
      ? '⚠️  CHẾ ĐỘ XOÁ THẬT (--apply)'
      : '🔍 CHẾ ĐỘ CHẠY THỬ (dry-run): không thay đổi gì. Thêm --apply để thực hiện.',
  );
  console.log(
    `Pet của shelter bị xoá sẽ được: ${MOVE_PETS ? 'CHUYỂN sang shelter giữ lại' : 'XOÁ cùng shelter'}\n`,
  );

  const allShelters = await prisma.shelter.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { pets: true, followers: true } },
    },
  });

  const sameName = allShelters.filter(
    (s) => normalizeName(s.name ?? '') === normalizeName(TARGET_NAME),
  );

  console.log(`Các shelter tên "${TARGET_NAME}":`);
  for (const s of sameName) {
    console.log(
      `  - id=${s.id} | pets=${s._count.pets} | followers=${s._count.followers} | name=${JSON.stringify(s.name)}`,
    );
  }
  console.log('');

  // Lớp bảo vệ 1
  const target = sameName.find((s) => s.id === SHELTER_ID);
  if (!target) {
    console.error(
      `❌ DỪNG: không có shelter id="${SHELTER_ID}" trong nhóm shelter tên "${TARGET_NAME}". Không làm gì cả.`,
    );
    process.exitCode = 1;
    return;
  }

  // Lớp bảo vệ 2
  const others = sameName.filter((s) => s.id !== target.id);
  const keeper = others.sort((a, b) => b._count.pets - a._count.pets)[0];
  if (!keeper || keeper._count.pets === 0) {
    console.error(
      '❌ DỪNG: không có shelter nào khác cùng tên có pet để giữ lại. Xoá shelter này sẽ mất hết dữ liệu.',
    );
    process.exitCode = 1;
    return;
  }
  if (target._count.pets >= keeper._count.pets) {
    console.error(
      `❌ DỪNG: shelter bị xoá (${target._count.pets} pet) không ít pet hơn shelter giữ lại ` +
        `id=${keeper.id} (${keeper._count.pets} pet). Có thể bạn đang chọn nhầm id.`,
    );
    process.exitCode = 1;
    return;
  }

  // Lớp bảo vệ 3
  const userCount = await prisma.user.count({ where: { shelterId: target.id } });
  if (userCount > 0) {
    console.error(
      `❌ DỪNG: có ${userCount} tài khoản nhân viên đang gắn với shelter ${target.id}. ` +
        'Hãy chuyển họ sang shelter khác trước.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Shelter sẽ bị xoá : id=${target.id} (${target._count.pets} pet, ${target._count.followers} follow)`);
  console.log(`Shelter giữ lại   : id=${keeper.id} (${keeper._count.pets} pet)\n`);

  const pets = await prisma.pet.findMany({
    where: { shelterId: target.id },
    select: {
      id: true,
      name: true,
      status: true,
      ownerId: true,
      _count: {
        select: {
          images: true,
          tags: true,
          medicalRecords: true,
          interactions: true,
          adoptionApplications: true,
          transferRequests: true,
        },
      },
    },
  });

  console.log(`Pet thuộc shelter bị xoá (${pets.length}):`);
  const risky: string[] = [];
  for (const p of pets) {
    const c = p._count;
    console.log(
      `  - id=${p.id} | name=${JSON.stringify(p.name)} | status=${p.status} | ownerId=${p.ownerId ?? 'null'} | ` +
        `ảnh=${c.images} QR=${c.tags} hồ sơ y tế=${c.medicalRecords} swipe=${c.interactions} ` +
        `đơn nhận nuôi=${c.adoptionApplications} chuyển nhượng=${c.transferRequests}`,
    );
    const reasons: string[] = [];
    if (p.status === 'ADOPTED') reasons.push('đã ADOPTED');
    if (c.adoptionApplications > 0) reasons.push(`có ${c.adoptionApplications} đơn nhận nuôi`);
    if (c.transferRequests > 0) reasons.push(`có ${c.transferRequests} yêu cầu chuyển nhượng`);
    if (reasons.length > 0) risky.push(`${p.id} (${p.name}): ${reasons.join(', ')}`);
  }
  console.log('');

  // Lớp bảo vệ 4
  if (!MOVE_PETS && risky.length > 0 && !FORCE) {
    console.error('❌ DỪNG: có pet có thể là dữ liệu thật của người dùng, xoá sẽ mất vĩnh viễn:');
    for (const r of risky) console.error(`   - ${r}`);
    console.error(
      'Dùng --move-pets để chuyển các pet này sang shelter giữ lại, hoặc --force nếu chắc chắn muốn xoá.',
    );
    process.exitCode = 1;
    return;
  }

  if (!APPLY) {
    console.log('🔍 [dry-run] Sẽ thực hiện, theo thứ tự:');
    if (pets.length > 0) {
      if (MOVE_PETS) {
        console.log(`   1. Chuyển ${pets.length} pet sang shelter ${keeper.id}`);
      } else {
        console.log('   1. Nhả các QR tag đang gắn với các pet này về INACTIVE');
        console.log('   2. Xoá lượt yêu thích / ẩn pet của các pet này');
        console.log(`   3. Xoá ${pets.length} pet`);
      }
    }
    console.log(`   - Xoá ${target._count.followers} lượt follow và các lượt block trỏ tới shelter`);
    console.log(`   - Xoá shelter ${target.id}`);
    console.log('\nNếu đúng ý, chạy lại với cờ --apply để thực hiện thật.');
    return;
  }

  const previewIds = pets.map((p) => p.id).sort().join(',');

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lớp bảo vệ 5: kiểm tra lại trong transaction
      const usersNow = await tx.user.count({ where: { shelterId: target.id } });
      if (usersNow > 0) {
        throw new Error(`Shelter ${target.id} vừa có ${usersNow} nhân viên mới, huỷ.`);
      }

      const petsNow = await tx.pet.findMany({
        where: { shelterId: target.id },
        select: { id: true },
      });
      const nowIds = petsNow.map((p) => p.id).sort().join(',');
      if (nowIds !== previewIds) {
        throw new Error('Danh sách pet của shelter vừa thay đổi so với lúc xem trước, huỷ. Chạy lại để xem danh sách mới.');
      }
      const petIds = petsNow.map((p) => p.id);

      let petsAffected = 0;
      if (petIds.length > 0) {
        if (MOVE_PETS) {
          const moved = await tx.pet.updateMany({
            where: { id: { in: petIds } },
            data: { shelterId: keeper.id },
          });
          petsAffected = moved.count;
        } else {
          // Giống PetsService.removePet: nhả QR tag trước rồi mới xoá pet
          await tx.tag.updateMany({
            where: { petId: { in: petIds } },
            data: { status: 'INACTIVE', petId: null, linkedAt: null },
          });
          await tx.favoritePet.deleteMany({ where: { petId: { in: petIds } } });
          await tx.userHiddenPet.deleteMany({ where: { petId: { in: petIds } } });
          const removed = await tx.pet.deleteMany({ where: { id: { in: petIds } } });
          petsAffected = removed.count;
        }
      }

      const follows = await tx.followedShelter.deleteMany({ where: { shelterId: target.id } });
      const blocks = await tx.userBlockedShelter.deleteMany({ where: { shelterId: target.id } });
      await tx.shelter.delete({ where: { id: target.id } });

      return { petIds, petsAffected, follows: follows.count, blocks: blocks.count };
    });

    console.log('──────── KẾT QUẢ ────────');
    console.log(`🗑️  Đã xoá shelter ${target.id}`);
    console.log(
      `   Pet ${MOVE_PETS ? 'đã chuyển sang shelter giữ lại' : 'đã xoá'}: ${result.petsAffected} | ` +
        `follow đã xoá: ${result.follows} | block đã xoá: ${result.blocks}`,
    );

    const after = (
      await prisma.shelter.findMany({
        select: { id: true, name: true, _count: { select: { pets: true } } },
      })
    ).filter((s) => normalizeName(s.name ?? '') === normalizeName(TARGET_NAME));

    console.log(`\nCòn lại ${after.length} shelter tên "${TARGET_NAME}":`);
    for (const s of after) {
      console.log(`  - id=${s.id} | pets=${s._count.pets}`);
    }

    console.log('\n👉 Nhớ xoá cache Redis:');
    console.log("   redis-cli unlink 'shelters:allowed:id:v1'");
    console.log("   và các key pets:available:*, shelters:*" +
      (MOVE_PETS ? '' : `, pet:detail:<id> của các pet đã xoá: ${result.petIds.join(', ') || '(không có)'}`));
  } catch (e: any) {
    if (e?.code === 'P2003') {
      console.error(
        '❌ KHÔNG XOÁ ĐƯỢC: còn bảng khác tham chiếu tới shelter hoặc pet (lỗi khoá ngoại P2003). ' +
          'Đã rollback, không có dữ liệu nào bị thay đổi. Chi tiết: ' +
          (e?.meta ? JSON.stringify(e.meta) : e?.message),
      );
    } else {
      console.error(`❌ KHÔNG XOÁ ĐƯỢC: ${e?.message ?? e}. Đã rollback, không có dữ liệu nào bị thay đổi.`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error('❌ Script lỗi:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });