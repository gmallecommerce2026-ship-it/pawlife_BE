/**
 * Xoá các shelter TRÙNG TÊN "Sân Nhà Nhiều Chó" mà KHÔNG có pet nào.
 *
 * Mặc định chạy ở chế độ THỬ (dry-run): chỉ in ra sẽ xoá gì, KHÔNG xoá.
 *
 *   Chạy thử:    npx ts-node prisma/seed-remove-empty-snnc-shelters.ts
 *   Xoá thật:    npx ts-node prisma/seed-remove-empty-snnc-shelters.ts --apply
 *
 * Chạy từ thư mục gốc dự án (nơi có file .env) để Prisma đọc được DATABASE_URL.
 *
 * Các lớp bảo vệ:
 *  1. Đếm pet ở MỌI trạng thái (AVAILABLE, ADOPTED, PENDING...), không chỉ AVAILABLE.
 *  2. Dừng nếu không có shelter nào cùng tên có pet (tránh xoá sạch tất cả).
 *  3. Chỉ xoá shelter có 0 pet. Shelter có pet không bao giờ bị đụng tới.
 *  4. Bỏ qua shelter đang có nhân viên (user.shelterId) và chỉ báo cáo ra.
 *  5. Mỗi shelter xoá trong 1 transaction, kiểm tra lại 0 pet / 0 nhân viên ngay trước khi xoá.
 *     Nếu lỗi (vd. ràng buộc khoá ngoại) thì rollback shelter đó, các shelter khác vẫn xử lý tiếp.
 *  6. So khớp tên bỏ qua khác biệt Unicode (NFC/NFD), khoảng trắng thừa và hoa/thường.
 */
import { PrismaClient } from '@prisma/client';

const TARGET_NAME = 'Sân Nhà Nhiều Chó';
const APPLY = process.argv.includes('--apply');

const prisma = new PrismaClient();

const normalizeName = (s: string) =>
  s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

type ShelterRow = {
  id: string;
  name: string;
  petCount: number;
  followerCount: number;
  userCount: number;
};

async function main() {
  console.log(
    APPLY
      ? '⚠️  CHẾ ĐỘ XOÁ THẬT (--apply)\n'
      : '🔍 CHẾ ĐỘ CHẠY THỬ (dry-run): không xoá gì. Thêm --apply để xoá thật.\n',
  );

  // Bảng shelter nhỏ nên lấy hết rồi lọc tên bằng JS để không lọt các biến thể Unicode/khoảng trắng
  const allShelters = await prisma.shelter.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { pets: true, followers: true } },
    },
  });

  const matched = allShelters.filter(
    (s) => normalizeName(s.name ?? '') === normalizeName(TARGET_NAME),
  );

  if (matched.length === 0) {
    console.log(`Không tìm thấy shelter nào tên "${TARGET_NAME}". Không có gì để làm.`);
    return;
  }

  const rows: ShelterRow[] = [];
  for (const s of matched) {
    const userCount = await prisma.user.count({ where: { shelterId: s.id } });
    rows.push({
      id: s.id,
      name: s.name,
      petCount: s._count.pets,
      followerCount: s._count.followers,
      userCount,
    });
  }

  console.log(`Tìm thấy ${rows.length} shelter tên "${TARGET_NAME}":`);
  for (const r of rows) {
    console.log(
      `  - id=${r.id} | pets=${r.petCount} | followers=${r.followerCount} | nhân viên=${r.userCount} | name=${JSON.stringify(r.name)}`,
    );
  }
  console.log('');

  const withPets = rows.filter((r) => r.petCount > 0);
  const empty = rows.filter((r) => r.petCount === 0);

  // Lớp bảo vệ 2: phải còn ít nhất 1 shelter có pet để giữ lại
  if (withPets.length === 0) {
    console.error(
      '❌ DỪNG: không có shelter nào tên này có pet. Nếu xoá sẽ mất hết, nên script không làm gì cả.',
    );
    process.exitCode = 1;
    return;
  }

  if (withPets.length > 1) {
    console.warn(
      `⚠️  Có ${withPets.length} shelter cùng tên đều có pet. Script KHÔNG đụng tới các shelter này, ` +
        'bạn cần tự gộp thủ công nếu muốn chỉ còn một.\n',
    );
  }

  // App tìm shelter bằng đúng chuỗi TARGET_NAME, nên cảnh báo nếu bản giữ lại lệch chuỗi này
  for (const keeper of withPets) {
    if (keeper.name !== TARGET_NAME) {
      console.warn(
        `⚠️  Shelter giữ lại (id=${keeper.id}) có tên ${JSON.stringify(keeper.name)} khác chuỗi chính xác ` +
          `${JSON.stringify(TARGET_NAME)} (có thể lệch dấu Unicode hoặc khoảng trắng). ` +
          'Kiểm tra lại vì code app lọc theo chuỗi chính xác này.\n',
      );
    }
  }

  if (empty.length === 0) {
    console.log('✅ Không có shelter rỗng nào cần xoá.');
    return;
  }

  console.log(`Shelter rỗng (0 pet) là ứng viên để xoá: ${empty.length}`);
  console.log(`Shelter được giữ lại: ${withPets.map((r) => r.id).join(', ')}\n`);

  let deleted = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of empty) {
    // Lớp bảo vệ 4: shelter đang có nhân viên thì không xoá
    if (c.userCount > 0) {
      console.warn(
        `⏭️  BỎ QUA ${c.id}: đang có ${c.userCount} tài khoản nhân viên gắn với shelter này. ` +
          'Hãy chuyển họ sang shelter đúng rồi chạy lại.',
      );
      skipped++;
      continue;
    }

    if (!APPLY) {
      console.log(
        `🔍 [dry-run] SẼ XOÁ ${c.id} (kèm ${c.followerCount} lượt follow và các lượt block của người dùng nếu có)`,
      );
      continue;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lớp bảo vệ 5: kiểm tra lại ngay trong transaction phòng trường hợp vừa có dữ liệu mới
        const petsNow = await tx.pet.count({ where: { shelterId: c.id } });
        if (petsNow > 0) {
          throw new Error(`Shelter ${c.id} vừa có ${petsNow} pet mới, huỷ xoá.`);
        }
        const usersNow = await tx.user.count({ where: { shelterId: c.id } });
        if (usersNow > 0) {
          throw new Error(`Shelter ${c.id} vừa có ${usersNow} nhân viên mới, huỷ xoá.`);
        }

        const follows = await tx.followedShelter.deleteMany({ where: { shelterId: c.id } });
        const blocks = await tx.userBlockedShelter.deleteMany({ where: { shelterId: c.id } });
        await tx.shelter.delete({ where: { id: c.id } });

        return { follows: follows.count, blocks: blocks.count };
      });

      console.log(
        `🗑️  ĐÃ XOÁ ${c.id} (follow: ${result.follows}, block: ${result.blocks})`,
      );
      deleted++;
    } catch (e: any) {
      failed++;
      if (e?.code === 'P2003') {
        console.error(
          `❌ KHÔNG XOÁ ĐƯỢC ${c.id}: còn bảng khác tham chiếu tới shelter này (lỗi khoá ngoại P2003). ` +
            'Đã rollback, dữ liệu shelter này giữ nguyên. Chi tiết: ' +
            (e?.meta ? JSON.stringify(e.meta) : e?.message),
        );
      } else {
        console.error(`❌ KHÔNG XOÁ ĐƯỢC ${c.id}: ${e?.message ?? e}`);
      }
    }
  }

  console.log('\n──────── KẾT QUẢ ────────');
  if (APPLY) {
    console.log(`Đã xoá: ${deleted} | Bỏ qua: ${skipped} | Lỗi: ${failed}`);

    // Kiểm tra lại sau khi xoá
    const after = (
      await prisma.shelter.findMany({
        select: { id: true, name: true, _count: { select: { pets: true } } },
      })
    ).filter((s) => normalizeName(s.name ?? '') === normalizeName(TARGET_NAME));

    console.log(`Còn lại ${after.length} shelter tên "${TARGET_NAME}":`);
    for (const s of after) {
      console.log(`  - id=${s.id} | pets=${s._count.pets}`);
    }

    console.log(
      '\n👉 Nhớ xoá cache Redis (nhất là key id shelter): ' +
        "redis-cli unlink 'shelters:allowed:id:v1'",
    );
  } else {
    console.log(`Chạy thử xong. Bỏ qua: ${skipped}. Chưa có gì bị xoá.`);
    console.log('Nếu danh sách trên đúng ý, chạy lại với cờ --apply để xoá thật.');
  }

  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('❌ Script lỗi:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });