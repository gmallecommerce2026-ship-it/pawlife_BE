import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 12 item gốc bạn đang hardcode, chuyển thành catalog
const REQUIREMENT_CATALOG = [
  { key: 'house_with_yard',   iconKey: 'home-icon',         vi: 'Có sân vườn',            en: 'House with yard' },
  { key: 'daily_walk',        iconKey: 'dog-walk',          vi: 'Đi dạo thường xuyên',    en: 'Daily Walk' },
  { key: 'advance_experience',iconKey: 'experience-icon',   vi: 'Chủ có kinh nghiệm',     en: 'Advance Experience' },
  { key: 'no_cat',            iconKey: 'no-cat-icon',       vi: 'Không có chó khác',      en: 'No cat' },
  { key: 'no_dog',            iconKey: 'no-dog-icon',       vi: 'Không có mèo khác',      en: 'No dog' },
  { key: 'no_other_pet',      iconKey: 'no-dog-icon',       vi: 'Không pet khác',         en: 'No other pet' },
  { key: 'no_small_animal',   iconKey: 'no-small-pet-icon', vi: 'Không động vật nhỏ',     en: 'No small animal' },
  { key: 'indoor_raise',      iconKey: 'home-icon',         vi: 'Nuôi trong nhà',         en: 'Indoor raise' },
  { key: 'spacious_living',   iconKey: 'home-icon',         vi: 'Không gian rộng',        en: 'Spacious Living' },
  { key: 'quiet_home',        iconKey: 'home-icon',         vi: 'Nhà yên tĩnh',           en: 'Quiet Home' },
  { key: 'often_at_home',     iconKey: 'home-icon',         vi: 'Có thời gian ở nhà',     en: 'Often at Home' },
  { key: 'stable_routine',    iconKey: 'calendar-icon',     vi: 'Lịch sinh hoạt ổn định', en: 'Stable Routine' },
];

// Gom nhóm để random có nghĩa, tránh sinh ra tổ hợp vô lý
// (vd: vừa "no_other_pet" vừa "no_cat" riêng lẻ thì dư thừa)
const GROUP_HOUSING   = ['house_with_yard', 'indoor_raise', 'spacious_living', 'quiet_home'];
const GROUP_LIFESTYLE = ['daily_walk', 'advance_experience', 'often_at_home', 'stable_routine'];
const GROUP_OTHER_PET = ['no_cat', 'no_dog', 'no_other_pet', 'no_small_animal'];

function pickRandom<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function seedAdoptionRequirements() {
  console.log('🌱 Seeding AdoptionRequirement catalog...');

  const created: Record<string, string> = {}; // key -> id

  for (const [index, item] of REQUIREMENT_CATALOG.entries()) {
    const record = await prisma.adoptionRequirement.upsert({
      where: { key: item.key },
      update: {
        label: { vi: item.vi, en: item.en },
        iconKey: item.iconKey,
      },
      create: {
        key: item.key,
        label: { vi: item.vi, en: item.en },
        iconKey: item.iconKey,
        sortOrder: index,
      },
    });
    created[item.key] = record.id;
  }

  console.log('🌱 Assigning random requirements to all pets...');

  const pets = await prisma.pet.findMany({ select: { id: true } });

  for (const pet of pets) {
    // xoá gán cũ để script idempotent (chạy lại nhiều lần không bị duplicate/rác)
    await prisma.petAdoptionRequirement.deleteMany({ where: { petId: pet.id } });

    const selectedKeys = [
      ...pickRandom(GROUP_HOUSING, 0, 2),
      ...pickRandom(GROUP_LIFESTYLE, 0, 2),
      ...pickRandom(GROUP_OTHER_PET, 0, 1), // chỉ chọn tối đa 1 trong nhóm này
    ];

    if (selectedKeys.length === 0) continue; // cho phép 1 số pet không có yêu cầu gì

    await prisma.petAdoptionRequirement.createMany({
      data: selectedKeys.map((key) => ({
        petId: pet.id,
        requirementId: created[key],
      })),
      skipDuplicates: true,
    });
  }

  console.log(`✅ Done seeding requirements for ${pets.length} pets.`);
}

if (require.main === module) {
  seedAdoptionRequirements()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}