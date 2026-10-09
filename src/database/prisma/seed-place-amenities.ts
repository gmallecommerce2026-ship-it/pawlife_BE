import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// key | labelVi (khớp đúng chữ FE đang gửi) | labelEn | isFilter | showInDetail
const AMENITIES = [
  // Chào đón thú cưng
  ['dog_allowed',        'Cho phép chó',            'Dogs allowed',        true,  true],
  ['cat_allowed',        'Cho phép mèo',            'Cats allowed',        true,  true],
  ['other_pets_allowed', 'Cho phép thú cưng khác',  'Other pets allowed',  false, true],
  // Chỗ ngồi & tiện nghi
  ['indoor',             'Trong nhà',               'Indoor seating',      false, true],
  ['outdoor',            'Ngoài trời',              'Outdoor seating',     false, true],
  ['air_conditioned',    'Khu vực có điều hòa',     'Air-conditioned area',false, true],
  ['rest_area',          'Khu nghỉ ngơi',           'Rest area',           false, true],
  // Dịch vụ đi kèm
  ['water_bowl',         'Bát nước',                'Water bowl',          false, true],
  ['pet_menu',           'Thực đơn riêng',          'Pet menu',            false, true],
  ['waste_bags',         'Túi dọn phân',            'Waste bags',          false, true],
  ['leash_hook',         'Móc treo dây dắt',        'Leash hooks',         false, true],
  // Quy định
  ['leash_required',     'Bắt buộc dùng dây dắt',   'Leash required',      false, true],
  ['size_limit',         'Giới hạn kích cỡ',        'Size limit',          false, true],
  ['reservation',        'Cần đặt chỗ trước',       'Reservation required',false, true],
] as const;

async function main() {
  for (const [i, [key, labelVi, labelEn, isFilter, showInDetail]] of AMENITIES.entries()) {
    // Tiện ích đã tồn tại (khớp theo key hoặc labelVi) thì chỉ đảm bảo hiển thị ở detail
    const existing = await prisma.placeAmenity.findFirst({
      where: { OR: [{ key }, { labelVi }] },
    });
    if (existing) {
      await prisma.placeAmenity.update({
        where: { id: existing.id },
        data: { showInDetail: true },
      });
      continue;
    }
    await prisma.placeAmenity.create({
      data: { key, labelVi, labelEn, isFilter, showInDetail, sortOrder: 100 + i },
    });
  }
  console.log('Seed amenities xong.');
}
main().finally(() => prisma.$disconnect());