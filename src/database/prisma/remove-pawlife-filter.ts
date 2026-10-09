/**
 * Xoá filter chip "Bạn của Pawlife" khỏi PlaceAmenity.
 * Liên kết trong place_amenity_links tự xoá theo (onDelete: Cascade).
 *
 * Chạy:
 *   npx ts-node src/database/prisma/remove-pawlife-filter.ts --dry-run   # chỉ xem dòng sẽ bị xoá
 *   npx ts-node src/database/prisma/remove-pawlife-filter.ts             # xoá thật
 *
 * Nếu chip có tên/key khác, chỉ định thủ công:
 *   npx ts-node src/database/prisma/remove-pawlife-filter.ts --key=ten_key
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const KEY_ARG = process.argv.find((a) => a.startsWith('--key='))?.split('=')[1];

async function main() {
  const where = KEY_ARG
    ? { key: KEY_ARG }
    : {
        OR: [
          { labelVi: { contains: 'Bạn của Pawlife' } },
          { labelEn: { contains: 'Pawlife' } },
          { key: { contains: 'pawlife' } },
        ],
      };

  const found = await prisma.placeAmenity.findMany({
    where,
    include: { _count: { select: { places: true } } },
  });

  if (found.length === 0) {
    console.log('Không tìm thấy amenity nào khớp trong DB.');
    console.log('Nếu chip vẫn hiện trên app, nó đang được hard-code ở backend (API config filters), không nằm trong DB.');
    return;
  }

  console.log('Sẽ xoá:');
  found.forEach((a) =>
    console.log(`  - [${a.key}] "${a.labelVi}" / "${a.labelEn}" (isFilter=${a.isFilter}, gắn với ${a._count.places} place)`),
  );

  if (DRY_RUN) {
    console.log('Dry-run xong, chưa xoá gì.');
    return;
  }

  const res = await prisma.placeAmenity.deleteMany({ where: { id: { in: found.map((a) => a.id) } } });
  console.log(`Đã xoá ${res.count} amenity.`);
}

main()
  .catch((e) => {
    console.error('Lỗi:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());