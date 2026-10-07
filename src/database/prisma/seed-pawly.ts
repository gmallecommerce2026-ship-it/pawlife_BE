/**
 * Seed dữ liệu Pawly Place. Idempotent — chạy lại nhiều lần không bị trùng.
 *   npx ts-node prisma/seed-pawly-places.ts
 * (hoặc thêm script "seed:places": "ts-node prisma/seed-pawly-places.ts" vào package.json)
 */
import { PetGender, PetSize, PetStatus, PlaceReactionType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const u = (id: string, w = 800) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;
const IMG = {
  cat1: u('photo-1514888286974-6c03e2ca1dba'),
  cat2: u('photo-1573865526739-10659fec78a5'),
  cat3: u('photo-1525253013412-55c1a69a5738'),
  dog1: u('photo-1574158622682-e40e69881006'),
  dog2: u('photo-1543466835-00a7907e9de1'),
  dog3: u('photo-1513360371669-4adf3dd7dff8'),
  drink: u('photo-1558642891-54be180ea339', 400),
  face: u('photo-1544005313-94ddf0286df2', 150),
  street: u('photo-1524661135-423995f22d0b'),
};

// ----------------------------- MASTER DATA -----------------------------
const CATEGORIES = [
  { key: 'viet', nameVi: 'Món Việt', nameEn: 'Vietnamese', icon: 'food-variant' },
  { key: 'milk_tea', nameVi: 'Trà sữa', nameEn: 'Milk tea', icon: 'cup-outline' },
  { key: 'fast_food', nameVi: 'Ăn nhanh', nameEn: 'Fast food', icon: 'hamburger' },
  { key: 'chinese', nameVi: 'Món Hoa', nameEn: 'Chinese', icon: 'noodles' },
  { key: 'breakfast', nameVi: 'Ăn sáng', nameEn: 'Breakfast', icon: 'bread-slice-outline' },
];

const AMENITIES = [
  { key: 'pawlife_friend', labelVi: 'Bạn của PawLife', labelEn: 'PawLife friend', isFilter: true, showInDetail: false },
  { key: 'pet_allowed', labelVi: 'Cho phép mang thú cưng', labelEn: 'Pets allowed', isFilter: true, showInDetail: true },
  { key: 'shelter_support', labelVi: 'Hỗ trợ trạm cứu hộ', labelEn: 'Supports shelters', isFilter: true, showInDetail: true },
  { key: 'pet_friendly', labelVi: 'Thân thiện với pet', labelEn: 'Pet friendly', isFilter: true, showInDetail: true },
  { key: 'dog_allowed', labelVi: 'Cho phép mang chó', labelEn: 'Dogs allowed', isFilter: false, showInDetail: true },
];
const A_ALL = ['pawlife_friend', 'pet_allowed', 'pet_friendly', 'dog_allowed', 'shelter_support'];
const A_BASIC = ['pet_allowed', 'pet_friendly', 'dog_allowed'];

const SHELTERS = [
  { id: 'seed-shelter-1', name: 'Sân Nhà Nhiều Chó', address: 'TP. Hồ Chí Minh' },
  { id: 'seed-shelter-2', name: 'Forever Wheelchair', address: 'TP. Hồ Chí Minh' },
  { id: 'seed-shelter-3', name: 'Saigon Time', address: 'TP. Hồ Chí Minh' },
];

const DOG = { vi: 'Chó', en: 'Dog' };
const CAT = { vi: 'Mèo', en: 'Cat' };
const PETS: Record<string, any> = {
  max: { id: 'seed-pet-max', name: 'Max', shelterId: 'seed-shelter-1', pid: 'PL-01234', gender: PetGender.FEMALE, size: PetSize.LARGE, weight: 22, species: DOG, breed: { vi: 'Chó ta Việt Nam', en: 'Vietnamese mixed dog' }, color: { vi: 'Vàng', en: 'Golden' }, img: IMG.dog2, desc: { vi: 'Max hiền lành, thích đón khách ở cửa quán.', en: 'Max is gentle and loves greeting guests at the door.' } },
  ni: { id: 'seed-pet-ni', name: 'Ni', shelterId: 'seed-shelter-2', pid: 'PL-01235', gender: PetGender.FEMALE, size: PetSize.MEDIUM, weight: 12, species: DOG, breed: { vi: 'Chó ta', en: 'Mixed dog' }, color: { vi: 'Trắng đen', en: 'Black & white' }, img: IMG.dog1, desc: { vi: 'Ni di chuyển bằng xe lăn nhưng cực kỳ năng động.', en: 'Ni uses a wheelchair but is super energetic.' } },
  khoai: { id: 'seed-pet-khoai', name: 'Khoai', shelterId: 'seed-shelter-3', pid: 'PL-01236', gender: PetGender.MALE, size: PetSize.SMALL, weight: 4.5, species: CAT, breed: { vi: 'Mèo ta', en: 'Domestic shorthair' }, color: { vi: 'Cam', en: 'Orange' }, img: IMG.dog3, desc: { vi: 'Khoai thích nằm sưởi nắng bên cửa sổ.', en: 'Khoai loves basking by the window.' } },
  bong: { id: 'seed-pet-bong', name: 'Bông', shelterId: 'seed-shelter-1', pid: 'PL-01237', gender: PetGender.FEMALE, size: PetSize.SMALL, weight: 3.8, species: CAT, breed: { vi: 'Mèo Anh lông ngắn', en: 'British shorthair' }, color: { vi: 'Xám', en: 'Grey' }, img: IMG.cat2, desc: { vi: 'Bông điềm tĩnh, rất thích được vuốt ve.', en: 'Bông is calm and loves cuddles.' } },
  mochi: { id: 'seed-pet-mochi', name: 'Mochi', shelterId: 'seed-shelter-2', pid: 'PL-01238', gender: PetGender.MALE, size: PetSize.MEDIUM, weight: 9, species: DOG, breed: { vi: 'Corgi lai', en: 'Corgi mix' }, color: { vi: 'Nâu trắng', en: 'Brown & white' }, img: IMG.dog1, desc: { vi: 'Mochi nghịch ngợm và rất thích chơi bóng.', en: 'Mochi is playful and loves balls.' } },
  lu: { id: 'seed-pet-lu', name: 'Lu', shelterId: 'seed-shelter-3', pid: 'PL-01239', gender: PetGender.MALE, size: PetSize.LARGE, weight: 25, species: DOG, breed: { vi: 'Chó Phú Quốc lai', en: 'Phu Quoc ridgeback mix' }, color: { vi: 'Nâu', en: 'Brown' }, img: IMG.dog2, desc: { vi: 'Lu to xác nhưng hiền như cục bột.', en: 'Lu is big but gentle as a lamb.' } },
};
const MAX_INTRO = {
  vi: 'Max đã quyết định đăng ký làm đào bán nghệ tại PawLife Coffee để báo hiếu cho Sân Nhà Nhiều Chó và nuôi các em chó gấu đồng meo ở nhà.',
  en: 'Max signed up to work at PawLife Coffee to give back to Sân Nhà Nhiều Chó shelter.',
};

const hours = (open = '08:00', close = '22:00') => {
  const day = [{ open, close }];
  return { mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day };
};

const MENU: Record<string, { title: { vi: string; en: string }; items: [string, string, number][] }[]> = {
  milk_tea: [
    { title: { vi: 'Signature', en: 'Signature' }, items: [['Trà sữa hồng trà', 'Best seller', 60000], ['Trà sữa matcha', 'Matcha Uji', 65000], ['Cà phê muối', 'Đậm vị', 45000]] },
    { title: { vi: 'Topping', en: 'Toppings' }, items: [['Trân châu đen', '', 10000], ['Pudding trứng', '', 12000]] },
  ],
  viet: [
    { title: { vi: 'Món chính', en: 'Mains' }, items: [['Phở bò tái', 'Nước dùng 12 tiếng', 65000], ['Bún chả', 'Kiểu Hà Nội', 60000], ['Cơm tấm sườn', '', 55000]] },
    { title: { vi: 'Đồ uống', en: 'Drinks' }, items: [['Trà đá', '', 5000], ['Nước mía', '', 15000]] },
  ],
  fast_food: [
    { title: { vi: 'Burger', en: 'Burgers' }, items: [['Cheese burger', '', 75000], ['Chicken burger', '', 69000], ['Khoai tây chiên', '', 35000]] },
    { title: { vi: 'Đồ uống', en: 'Drinks' }, items: [['Coca-Cola', '', 20000], ['Trà đào', '', 30000]] },
  ],
  chinese: [
    { title: { vi: 'Dim sum', en: 'Dim sum' }, items: [['Há cảo tôm', '', 55000], ['Xíu mại', '', 50000], ['Bánh bao trứng muối', '', 45000]] },
    { title: { vi: 'Món nước', en: 'Noodles' }, items: [['Mì hoành thánh', '', 70000], ['Hủ tiếu sa tế', '', 65000]] },
  ],
  breakfast: [
    { title: { vi: 'Bữa sáng', en: 'Breakfast' }, items: [['Bánh mì ốp la', '', 30000], ['Xôi gà', '', 35000], ['Bánh cuốn nóng', '', 40000]] },
    { title: { vi: 'Đồ uống', en: 'Drinks' }, items: [['Cà phê sữa', '', 25000], ['Sữa đậu nành', '', 15000]] },
  ],
};

const INTRO_1 = {
  vi: 'Đây là mô hình cà phê mèo sân thượng đầu tiên tại Việt Nam với diện tích rộng rãi hơn 200m².',
  en: 'Vietnam’s first rooftop cat café, with more than 200 m² of space.',
};
const gen = (vi: string, en: string) => ({ vi, en });

const PLACES = [
  { id: 'seed-place-1', name: 'PawLife Coffee', cat: 'milk_tea', catText: gen('Cà phê & Trà, Tráng miệng', 'Coffee & Tea, Desserts'), city: 'TP. Hồ Chí Minh', address: '123 Đường số 1, Phường Tân Mỹ, TP. Hồ Chí Minh', lat: 10.7645, lng: 106.6601, phone: '0987654321', intro: INTRO_1, hero: IMG.cat1, gallery: [IMG.dog1, IMG.cat2], amenities: A_ALL, pets: ['max', 'ni', 'khoai'] },
  { id: 'seed-place-2', name: 'PawLife Coffee Quận 10', cat: 'milk_tea', catText: gen('Cà phê & Trà', 'Coffee & Tea'), city: 'TP. Hồ Chí Minh', address: '45 Sư Vạn Hạnh, Phường 12, TP. Hồ Chí Minh', lat: 10.7615, lng: 106.6625, phone: '0987654322', intro: gen('Không gian thoáng với khu vui chơi riêng cho chó.', 'Spacious café with a dedicated dog play area.'), hero: IMG.cat3, gallery: [IMG.cat1, IMG.dog3], amenities: A_ALL, pets: ['mochi', 'bong'] },
  { id: 'seed-place-3', name: 'Vườn Mèo Của Qin', cat: 'milk_tea', catText: gen('Trà, Nước ép', 'Tea, Juices'), city: 'TP. Hồ Chí Minh', address: '88 Nguyễn Tri Phương, Phường 8, TP. Hồ Chí Minh', lat: 10.7702, lng: 106.6672, phone: '0987654323', intro: gen('Khu vườn nhỏ xinh với hơn 15 bé mèo cứu hộ.', 'A cozy garden with 15+ rescued cats.'), hero: IMG.cat2, gallery: [IMG.cat3], amenities: A_ALL, pets: ['khoai', 'bong'] },
  { id: 'seed-place-4', name: 'Bánh Mì Bên Thềm', cat: 'breakfast', catText: gen('Ăn sáng, Bánh mì', 'Breakfast, Bánh mì'), city: 'TP. Hồ Chí Minh', address: '12 Trần Hưng Đạo, Phường 2, TP. Hồ Chí Minh', lat: 10.7589, lng: 106.6554, phone: '0987654324', intro: gen('Bánh mì nướng than, có bàn ngoài hiên cho khách mang chó.', 'Charcoal-grilled bánh mì with patio seating for dog owners.'), hero: IMG.street, gallery: [IMG.dog1], amenities: A_BASIC, pets: ['lu'] },
  { id: 'seed-place-5', name: 'Phở Hòa Pet', cat: 'viet', catText: gen('Món Việt, Phở', 'Vietnamese, Phở'), city: 'TP. Hồ Chí Minh', address: '210 Cách Mạng Tháng 8, Phường 10, TP. Hồ Chí Minh', lat: 10.766, lng: 106.654, phone: '0987654325', intro: gen('Phở truyền thống, chủ quán là người yêu chó mèo.', 'Traditional phở from pet-loving owners.'), hero: IMG.street, gallery: [IMG.dog3], amenities: A_BASIC.concat('shelter_support'), pets: ['mochi'] },
  { id: 'seed-place-6', name: 'Dim Sum Pet Corner', cat: 'chinese', catText: gen('Món Hoa, Dim sum', 'Chinese, Dim sum'), city: 'TP. Hồ Chí Minh', address: '77 Nguyễn Trãi, Phường 3, TP. Hồ Chí Minh', lat: 10.7571, lng: 106.6689, phone: '0987654326', intro: gen('Dim sum nóng hổi, có khu riêng cho thú cưng.', 'Hot dim sum with a pet-friendly zone.'), hero: IMG.street, gallery: [IMG.cat1], amenities: ['pet_allowed', 'pet_friendly'], pets: [] },
  { id: 'seed-place-7', name: 'Burger Paws', cat: 'fast_food', catText: gen('Ăn nhanh, Burger', 'Fast food, Burgers'), city: 'TP. Hồ Chí Minh', address: '5 Lý Thường Kiệt, Phường 7, TP. Hồ Chí Minh', lat: 10.7712, lng: 106.6623, phone: '0987654327', intro: gen('Burger bò Úc, mỗi đơn ủng hộ 2% cho trạm cứu hộ.', 'Aussie beef burgers — 2% of each order supports shelters.'), hero: IMG.street, gallery: [IMG.dog2], amenities: ['pawlife_friend', 'pet_allowed', 'shelter_support'], pets: ['lu'] },
  { id: 'seed-place-8', name: 'PawLife Coffee Hà Nội', cat: 'milk_tea', catText: gen('Cà phê & Trà', 'Coffee & Tea'), city: 'Hà Nội', address: '25 Tràng Tiền, Hoàn Kiếm, Hà Nội', lat: 21.0245, lng: 105.8542, phone: '0987654328', intro: gen('Chi nhánh Hà Nội, view hồ Gươm.', 'Hanoi branch overlooking Hoan Kiem Lake.'), hero: IMG.cat3, gallery: [IMG.cat2], amenities: A_ALL, pets: ['ni'] },
  // 2 quán ở Quy Nhơn để test trên thiết bị thật
  { id: 'seed-place-9', name: 'PawLife Quy Nhơn Coffee', cat: 'milk_tea', catText: gen('Cà phê & Trà', 'Coffee & Tea'), city: 'Gia Lai', address: '10 Xuân Diệu, Quy Nhơn, Gia Lai', lat: 13.7765, lng: 109.2237, phone: '0987654329', intro: gen('Cà phê gần biển, thoải mái dắt thú cưng đi cùng.', 'Seaside café — pets welcome.'), hero: IMG.cat1, gallery: [IMG.dog1, IMG.cat3], amenities: A_ALL, pets: ['max', 'mochi'] },
  { id: 'seed-place-10', name: 'Bún Chả Cá Biển', cat: 'viet', catText: gen('Món Việt, Hải sản', 'Vietnamese, Seafood'), city: 'Gia Lai', address: '55 Nguyễn Huệ, Quy Nhơn, Gia Lai', lat: 13.7712, lng: 109.2255, phone: '0987654330', intro: gen('Bún chả cá đặc sản Quy Nhơn.', 'Quy Nhơn’s signature fish-cake noodles.'), hero: IMG.street, gallery: [IMG.dog3], amenities: A_BASIC, pets: ['khoai'] },
];

const USERS = [
  ['Julia Nguyễn', IMG.face], ['Thanh Nhàn', null], ['Minh Khoa', null], ['Hải Yến', IMG.face],
  ['Quốc Bảo', null], ['Ngọc Anh', null], ['Gia Hân', IMG.face],
] as const;

const REVIEW_TEXTS = [
  'Sự kết hợp cân bằng giữa vị đậm đà và vị chua thanh. Phù hợp gu vừa phải, hiện đại.',
  'Không gian thoáng mát, đồ uống ngon và đặc biệt là các bé siêu quấn người. Rất thích hợp để thư giãn cuối tuần.',
  'Nhân viên thân thiện, cho chó nhà mình vào thoải mái. Sẽ quay lại!',
  'Quán sạch sẽ, các bé thú cưng được chăm sóc tốt. Giá hợp lý.',
  'Mình rất thích ý tưởng ủng hộ trạm cứu hộ mỗi lượt check-in.',
  'Đồ uống ổn, phục vụ hơi chậm lúc đông khách nhưng không gian đáng yêu.',
  'Chỗ lý tưởng để đi cùng bạn bè và thú cưng.',
];
const RATINGS = [5, 4, 5, 3, 4, 5, 4];

// ----------------------------- RUN -----------------------------
async function clean() {
  await prisma.place.deleteMany({ where: { id: { startsWith: 'seed-place-' } } }); // cascade review/menu/working pets
  await prisma.user.deleteMany({ where: { id: { startsWith: 'seed-user-' } } });
  await prisma.pet.deleteMany({ where: { id: { startsWith: 'seed-pet-' } } });
  await prisma.shelter.deleteMany({ where: { id: { startsWith: 'seed-shelter-' } } });
  console.log('🧹 Đã xoá toàn bộ dữ liệu seed Pawly Places.');
}

async function main() {
  if (process.argv.includes('--clean')) return clean();
  console.log('🌱 Seeding Pawly Places...');

  const catId: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await prisma.placeCategory.upsert({ where: { key: c.key }, create: { ...c, sortOrder: i }, update: { ...c, sortOrder: i } });
    catId[c.key] = row.id;
  }
  const amenityId: Record<string, string> = {};
  for (const [i, a] of AMENITIES.entries()) {
    const row = await prisma.placeAmenity.upsert({ where: { key: a.key }, create: { ...a, sortOrder: i }, update: { ...a, sortOrder: i } });
    amenityId[a.key] = row.id;
  }

  for (const s of SHELTERS) {
    const data = { name: s.name, address: s.address, contactInfo: '0900000000', isVerified: true };
    await prisma.shelter.upsert({ where: { id: s.id }, create: { id: s.id, ...data }, update: data });
  }

  for (const p of Object.values(PETS)) {
    const data = {
      name: p.name, species: p.species, breed: p.breed, color: p.color, description: p.desc,
      weight: p.weight, gender: p.gender, size: p.size, status: PetStatus.FOSTERING, // KHÔNG dùng AVAILABLE để pet seed không lọt vào feed vuốt / search nhận nuôi
     
      idSetByShelter: p.pid, shelterId: p.shelterId,
    };
    await prisma.pet.upsert({ where: { id: p.id }, create: { id: p.id, ...data }, update: data });
    await prisma.petImage.deleteMany({ where: { petId: p.id } });
    await prisma.petImage.create({ data: { petId: p.id, url: p.img } });
  }

  const userIds: string[] = [];
  for (const [i, [name, avatar]] of USERS.entries()) {
    const id = `seed-user-${i + 1}`;
    const data = { name, avatarUrl: avatar };
    await prisma.user.upsert({
      where: { id },
      create: { id, email: `seed${i + 1}@pawlife.test`, ...data },
      update: data,
    });
    userIds.push(id);
  }

  const reactionTypes = [PlaceReactionType.HUUICH, PlaceReactionType.CAMON, PlaceReactionType.HUHU];

  for (const [i, p] of PLACES.entries()) {
    const data = {
      name: p.name, categoryId: catId[p.cat], categoryText: p.catText, intro: p.intro,
      address: p.address, city: p.city, latitude: p.lat, longitude: p.lng, phone: p.phone,
      heroImage: p.hero, galleryImages: p.gallery, openingHours: hours(i % 3 === 0 ? '09:00' : '08:00', i % 3 === 0 ? '21:00' : '22:00'),
      isActive: true,
    };
    await prisma.place.upsert({ where: { id: p.id }, create: { id: p.id, ...data }, update: data });

    // Amenities
    await prisma.placeAmenityOnPlace.deleteMany({ where: { placeId: p.id } });
    await prisma.placeAmenityOnPlace.createMany({
      data: p.amenities.map((k) => ({ placeId: p.id, amenityId: amenityId[k] })),
    });

    // Menu
    await prisma.placeMenuSection.deleteMany({ where: { placeId: p.id } });
    for (const [si, sec] of MENU[p.cat].entries()) {
      await prisma.placeMenuSection.create({
        data: {
          placeId: p.id, title: sec.title, sortOrder: si,
          items: {
            create: sec.items.map(([name, subtext, price], ii) => ({
              name, subtext, price, image: IMG.drink, sortOrder: ii, isFeatured: si === 0,
            })),
          },
        },
      });
    }

    // Working pets
    for (const [pi, key] of p.pets.entries()) {
      const pet = PETS[key];
      await prisma.placeWorkingPet.upsert({
        where: { placeId_petId: { placeId: p.id, petId: pet.id } },
        create: { placeId: p.id, petId: pet.id, sortOrder: pi, intro: key === 'max' ? MAX_INTRO : undefined },
        update: { sortOrder: pi, intro: key === 'max' ? MAX_INTRO : undefined },
      });
    }

    // Reviews (quán 1-2: 7 review để test "Xem tất cả"; còn lại 3)
    const reviewCount = i < 2 ? 7 : 3;
    const reviewIds: string[] = [];
    for (let j = 0; j < reviewCount; j++) {
      const id = `seed-review-${i + 1}-${j + 1}`;
      const rdata = {
        rating: RATINGS[(j + i) % RATINGS.length],
        content: REVIEW_TEXTS[j % REVIEW_TEXTS.length],
        images: j === 1 ? [IMG.cat1] : [],
      };
      await prisma.placeReview.upsert({
        where: { id },
        create: { id, placeId: p.id, userId: userIds[j], createdAt: new Date(Date.now() - (j * 4 + 2) * 86400000), ...rdata },
        update: rdata,
      });
      reviewIds.push(id);
    }

    // Reactions giả lập
    const reactions: { reviewId: string; userId: string; type: PlaceReactionType }[] = [];
    reviewIds.forEach((reviewId, j) =>
      userIds.forEach((userId, k) =>
        reactionTypes.forEach((type, t) => {
          if (k !== j && (i + j + k + t) % 4 === 0) reactions.push({ reviewId, userId, type });
        }),
      ),
    );
    if (reactions.length) await prisma.placeReviewReaction.createMany({ data: reactions, skipDuplicates: true });

    // Denormalized rating
    const agg = await prisma.placeReview.aggregate({ where: { placeId: p.id }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.place.update({
      where: { id: p.id },
      data: { rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0, reviewsCount: agg._count._all },
    });
  }

  // "Xem gần đây" mẫu cho seed-user-1
  for (const [n, pid] of ['seed-place-1', 'seed-place-3', 'seed-place-5'].entries()) {
    await prisma.recentPlaceView.upsert({
      where: { userId_placeId: { userId: userIds[0], placeId: pid } },
      create: { userId: userIds[0], placeId: pid, viewedAt: new Date(Date.now() - n * 3600_000) },
      update: { viewedAt: new Date(Date.now() - n * 3600_000) },
    });
  }

  console.log(`✅ Done: ${CATEGORIES.length} categories, ${AMENITIES.length} amenities, ${PLACES.length} places, ${Object.keys(PETS).length} pets, ${USERS.length} users.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());