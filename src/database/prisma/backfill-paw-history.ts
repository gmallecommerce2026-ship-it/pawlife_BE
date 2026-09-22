// prisma/backfill-paw-history.ts
//
// Chạy 1 lần để generate pawHistory cho toàn bộ pet đang có trong DB.
// Script KHÔNG tạo pet mới, KHÔNG xoá dữ liệu hiện có.
// Nó chỉ tạo thêm MedicalRecord + Tag nếu thiếu, theo đúng constraint tuổi.
//
// Usage:
//   npx ts-node prisma/backfill-paw-history.ts
//   (hoặc: npx tsx prisma/backfill-paw-history.ts)

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const bi = (vi: string, en: string) => ({ vi, en });

/** Trả về Date = referenceDate - offsetDays, floor về đầu ngày */
const dateOffsetFrom = (reference: Date, offsetDays: number): Date => {
  const d = new Date(reference);
  d.setDate(d.getDate() - offsetDays);
  d.setHours(8, 0, 0, 0);
  return d;
};

/** Số ngày giữa 2 mốc (>0 nếu a trước b) */
const daysBetween = (a: Date, b: Date) =>
  Math.floor((b.getTime() - a.getTime()) / 86_400_000);

/**
 * Tính tuổi con thú tính đến 1 ngày cụ thể.
 * Nếu không có dob, dùng createdAt làm mốc (xem như mới nhất).
 */
const ageInDaysAt = (pet: PetRow, atDate: Date): number => {
  const birthRef = pet.dob ?? pet.createdAt;
  return Math.max(0, daysBetween(birthRef, atDate));
};

/**
 * Tìm ngày sớm nhất hợp lệ để thêm 1 event vào timeline.
 * Đảm bảo:
 *   - Không sớm hơn ngày sinh (dob / createdAt)
 *   - Không trễ hơn hôm nay
 *   - Không sớm hơn createdAt của pet (profile chưa tồn tại)
 * Trả null nếu không thể tìm được ngày hợp lệ.
 */
const validDate = (
  pet: PetRow,
  idealDate: Date,
  minAgeDays = 0,
): Date | null => {
  const today = new Date();
  const birthRef = pet.dob ?? pet.createdAt;
  const earliest = new Date(Math.max(
    birthRef.getTime() + minAgeDays * 86_400_000,
    pet.createdAt.getTime(),
  ));

  if (earliest > today) return null; // Pet quá trẻ, event này chưa thể xảy ra

  const clamped = new Date(Math.max(
    Math.min(idealDate.getTime(), today.getTime()),
    earliest.getTime(),
  ));

  return clamped;
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type PetRow = Awaited<ReturnType<typeof fetchAllPets>>[number];

// ─────────────────────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAllPets() {
  return prisma.pet.findMany({
    include: {
      owner:          { select: { id: true, name: true } },
      shelter:        { select: { id: true, name: true } },
      medicalRecords: { orderBy: { recordDate: 'asc' } },
      tags:           { orderBy: { linkedAt: 'asc' } },
      transferRequests: {
        where:   { status: 'COMPLETED' },
        orderBy: { updatedAt: 'asc' },
        include: {
          sender:   { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VACCINE LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Danh sách vaccine cần có cho từng loài.
 * minAgeDays: tuổi tối thiểu (ngày) để tiêm mũi này.
 * intervalDays: cách mũi trước tối thiểu bao nhiêu ngày.
 */
const DOG_VACCINE_SCHEDULE = [
  {
    type:            'VACCINATION',
    recordName:      bi('Tiêm phòng 5 bệnh (5in1) - Mũi 1', 'DHPP 5-in-1 - Dose 1'),
    vaccineCategory: 'CORE',
    minAgeDays:      42,   // 6 tuần
    intervalDays:    0,
  },
  {
    type:            'VACCINATION',
    recordName:      bi('Tiêm phòng 5 bệnh (5in1) - Mũi 2', 'DHPP 5-in-1 - Dose 2'),
    vaccineCategory: 'CORE',
    minAgeDays:      63,   // 9 tuần
    intervalDays:    21,
  },
  {
    type:            'VACCINATION',
    recordName:      bi('Tiêm phòng 7 bệnh (7in1) - Mũi 3', 'DHPP 7-in-1 - Dose 3'),
    vaccineCategory: 'CORE',
    minAgeDays:      84,   // 12 tuần
    intervalDays:    21,
  },
  {
    type:            'VACCINATION',
    recordName:      bi('Tiêm phòng dại', 'Rabies Vaccination'),
    vaccineCategory: 'RABIES',
    minAgeDays:      84,   // 12 tuần
    intervalDays:    0,    // có thể cùng ngày mũi 3
  },
];

const CAT_VACCINE_SCHEDULE = [
  {
    type:            'VACCINATION',
    recordName:      bi('Tiêm phòng 3 bệnh (FVRCP) - Mũi 1', 'FVRCP 3-in-1 - Dose 1'),
    vaccineCategory: 'CORE',
    minAgeDays:      56,   // 8 tuần
    intervalDays:    0,
  },
  {
    type:            'VACCINATION',
    recordName:      bi('Tiêm phòng 3 bệnh (FVRCP) - Mũi 2', 'FVRCP 3-in-1 - Dose 2'),
    vaccineCategory: 'CORE',
    minAgeDays:      84,   // 12 tuần
    intervalDays:    28,
  },
  {
    type:            'VACCINATION',
    recordName:      bi('Tiêm phòng dại (mèo)', 'Rabies Vaccination (Cat)'),
    vaccineCategory: 'RABIES',
    minAgeDays:      84,
    intervalDays:    0,
  },
];

const CHECKUP_TEMPLATE = {
  type:       'CHECKUP',
  recordName: bi('Khám tổng quát định kỳ', 'Annual Checkup'),
  minAgeDays: 90,
};

const DENTAL_TEMPLATE = {
  type:       'DENTAL',
  recordName: bi('Khám răng miệng', 'Dental Care'),
  minAgeDays: 180,
};

/**
 * Tính toán danh sách vaccine CẦN TẠO cho 1 pet.
 * - Skip nếu pet đã có record trùng tên (en) để tránh duplicate.
 * - Tính ngày tiêm dựa trên dob/createdAt + minAgeDays.
 * - Mỗi mũi phải cách mũi trước ít nhất intervalDays.
 * - Không vượt quá hôm nay và không được trước ngày sinh.
 */
function computeMissingVaccines(pet: PetRow): Array<{
  type: string;
  recordName: { vi: string; en: string };
  vaccineCategory: string | null;
  recordDate: Date;
  hasNextDueDate: boolean;
  nextDueDate: Date | null;
  nextDueName: { vi: string; en: string } | null;
}> {
  const speciesJson = pet.species as any;
  const speciesEn = (
    typeof speciesJson === 'object' ? speciesJson?.en ?? '' : String(speciesJson)
  ).toLowerCase();

  const isDog = speciesEn.includes('dog');
  const isCat = speciesEn.includes('cat');
  if (!isDog && !isCat) return []; // exotic — bỏ qua

  const schedule = isDog ? DOG_VACCINE_SCHEDULE : CAT_VACCINE_SCHEDULE;
  const birthRef = pet.dob ?? pet.createdAt;
  const today = new Date();

  // Tập tên vaccine đã có (lowercase, dùng en)
  const existingNames = new Set(
    pet.medicalRecords.map((r) => {
      const rn = r.recordName as any;
      return (typeof rn === 'object' ? rn?.en ?? '' : String(rn)).toLowerCase().trim();
    }),
  );

  const result: ReturnType<typeof computeMissingVaccines> = [];
  let lastVaccineDate: Date | null = null;

  for (const tpl of schedule) {
    const nameEn = tpl.recordName.en.toLowerCase().trim();

    // Đã có → skip, nhưng cập nhật lastVaccineDate để interval vẫn chính xác
    if (existingNames.has(nameEn)) {
      // Tìm ngày thực tế của record này
      const existing = pet.medicalRecords.find((r) => {
        const rn = r.recordName as any;
        return (typeof rn === 'object' ? rn?.en ?? '' : String(rn))
          .toLowerCase()
          .trim() === nameEn;
      });
      if (existing) lastVaccineDate = existing.recordDate;
      continue;
    }

    // Tính ngày tiêm lý tưởng
    let idealDate = dateOffsetFrom(birthRef, -tpl.minAgeDays); // birth + minAgeDays

    // Đảm bảo cách mũi trước đủ intervalDays
    if (lastVaccineDate && tpl.intervalDays > 0) {
      const minAfterPrev = new Date(lastVaccineDate);
      minAfterPrev.setDate(minAfterPrev.getDate() + tpl.intervalDays);
      if (idealDate < minAfterPrev) idealDate = minAfterPrev;
    }

    const finalDate = validDate(pet, idealDate, tpl.minAgeDays);
    if (!finalDate) continue; // Pet còn quá nhỏ

    // Tránh trùng ngày với vaccine khác trong batch hiện tại (cộng thêm 1 ngày)
    const sameDay = result.find(
      (r) => r.recordDate.toDateString() === finalDate.toDateString(),
    );
    if (sameDay) finalDate.setDate(finalDate.getDate() + 1);
    if (finalDate > today) continue;

    lastVaccineDate = finalDate;

    const nextDueDate = new Date(finalDate);
    nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);

    result.push({
      type:            tpl.type,
      recordName:      tpl.recordName,
      vaccineCategory: tpl.vaccineCategory,
      recordDate:      finalDate,
      hasNextDueDate:  true,
      nextDueDate:     nextDueDate > today ? nextDueDate : null,
      nextDueName:     bi(
        `Nhắc lịch: ${tpl.recordName.vi}`,
        `Reminder: ${tpl.recordName.en}`,
      ),
    });
  }

  return result;
}

/**
 * Tính checkup và dental cần tạo.
 * Chỉ tạo nếu chưa có record cùng loại.
 */
function computeMissingCheckups(pet: PetRow): Array<{
  type: string;
  recordName: { vi: string; en: string };
  vaccineCategory: null;
  recordDate: Date;
  hasNextDueDate: boolean;
  nextDueDate: Date | null;
  nextDueName: null;
}> {
  const result: ReturnType<typeof computeMissingCheckups> = [];
  const today = new Date();

  const existingTypes = new Set(pet.medicalRecords.map((r) => r.type.toUpperCase()));

  for (const tpl of [CHECKUP_TEMPLATE, DENTAL_TEMPLATE]) {
    if (existingTypes.has(tpl.type.toUpperCase())) continue;

    const birthRef = pet.dob ?? pet.createdAt;
    const idealDate = dateOffsetFrom(birthRef, -tpl.minAgeDays);
    const finalDate = validDate(pet, idealDate, tpl.minAgeDays);
    if (!finalDate || finalDate > today) continue;

    result.push({
      type:            tpl.type,
      recordName:      tpl.recordName,
      vaccineCategory: null,
      recordDate:      finalDate,
      hasNextDueDate:  false,
      nextDueDate:     null,
      nextDueName:     null,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAG LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy 1 tag INACTIVE chưa link pet nào từ pool.
 * Nếu không có → tạo tag mới.
 */
async function getOrCreateFreeTag(): Promise<string> {
  const freeTag = await prisma.tag.findFirst({
    where: { petId: null, status: 'INACTIVE' },
  });
  if (freeTag) return freeTag.id;

  // Tạo mới
  const newTag = await prisma.tag.create({
    data: { status: 'INACTIVE' },
  });
  return newTag.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Backfilling pawHistory for all existing pets...\n');

  const pets = await fetchAllPets();
  console.log(`📦 Found ${pets.length} pets to process\n`);

  let totalMedicalCreated = 0;
  let totalTagsLinked = 0;
  let skipped = 0;

  for (const pet of pets) {
    const birthRef = pet.dob ?? pet.createdAt;
    const ageInDays = daysBetween(birthRef, new Date());
    const ageLabel = ageInDays >= 365
      ? `${Math.floor(ageInDays / 365)}y ${Math.floor((ageInDays % 365) / 30)}m`
      : `${Math.floor(ageInDays / 30)}m`;

    const speciesJson = pet.species as any;
    const speciesEn = (typeof speciesJson === 'object' ? speciesJson?.en ?? 'Unknown' : String(speciesJson));

    console.log(`🐾 [${speciesEn}] "${pet.name}" (age: ${ageLabel}, status: ${pet.status})`);

    // ── Medical Records ──────────────────────────────────────────────────────
    const missingVaccines  = computeMissingVaccines(pet);
    const missingCheckups  = computeMissingCheckups(pet);
    const allMissing       = [...missingVaccines, ...missingCheckups];

    if (allMissing.length > 0) {
      // Sort theo ngày trước khi insert để đảm bảo thứ tự hợp lý
      allMissing.sort((a, b) => a.recordDate.getTime() - b.recordDate.getTime());

      await prisma.medicalRecord.createMany({
        data: allMissing.map((r) => ({
          petId:             pet.id,
          type:              r.type,
          recordName:        r.recordName as any,
          recordDate:        r.recordDate,
          images:            [],
          hasNextDueDate:    r.hasNextDueDate,
          nextDueDate:       r.nextDueDate ?? null,
          nextDueName:       r.nextDueName as any ?? null,
          verificationStatus:'PENDING' as const,
        })),
        skipDuplicates: true,
      });

      console.log(`  ✓ +${allMissing.length} medical records`);
      totalMedicalCreated += allMissing.length;
    } else {
      console.log(`  · medical records OK (${pet.medicalRecords.length} existing)`);
    }

    // ── isVaccinated flag ─────────────────────────────────────────────────
    // Nếu pet chưa được đánh dấu isVaccinated nhưng thực tế đã có đủ vaccine
    // (RABIES + ít nhất 1 CORE) thì update lại
    if (!pet.isVaccinated && missingVaccines.length === 0 && pet.medicalRecords.length > 0) {
      const speciesEn2 = (typeof pet.species === 'object'
        ? (pet.species as any)?.en ?? '' : String(pet.species)).toLowerCase();
      const allRecordsNow = await prisma.medicalRecord.findMany({
        where: { petId: pet.id, type: 'VACCINATION' },
      });
      const hasRabies = allRecordsNow.some((r) => {
        const rn = (r.recordName as any)?.en?.toLowerCase() ?? '';
        return rn.includes('rabies');
      });
      const hasCore = allRecordsNow.some((r) => {
        const rn = (r.recordName as any)?.en?.toLowerCase() ?? '';
        return rn.includes('dhpp') || rn.includes('fvrcp') || rn.includes('in-1');
      });
      if (hasRabies && hasCore) {
        await prisma.pet.update({
          where: { id: pet.id },
          data:  { isVaccinated: true },
        });
        console.log(`  ✓ isVaccinated → true`);
      }
    }

    // ── QR Tag ────────────────────────────────────────────────────────────
    const hasActiveTag = pet.tags.some((t) => t.status !== 'INACTIVE' && t.petId === pet.id);

    // Chỉ link tag nếu pet chưa có tag nào active
    // Điều kiện: pet đủ 60 ngày tuổi (thực tế đã có chủ hoặc shelter quản lý)
    if (!hasActiveTag && ageInDays >= 60) {
      const tagId = await getOrCreateFreeTag();

      // Ngày link = 60 ngày tuổi hoặc ngày tạo profile + 7 ngày, chọn cái nào muộn hơn
      const linkDate = validDate(pet, dateOffsetFrom(birthRef, -(ageInDays - 60)), 60);

      if (linkDate) {
        await prisma.$transaction([
          prisma.tag.update({
            where: { id: tagId },
            data: {
              petId:    pet.id,
              status:   'ACTIVE',
              linkedAt: linkDate,
            },
          }),
          prisma.pet.update({
            where: { id: pet.id },
            data: {
              qrCodeUrl:            `https://pawlife.app/tag/${tagId}`,
              qrVerificationStatus: 'VERIFIED',
            },
          }),
        ]);
        console.log(`  ✓ QR Tag linked (${tagId})`);
        totalTagsLinked++;
      }
    } else if (hasActiveTag) {
      console.log(`  · QR Tag OK (already linked)`);
    } else {
      console.log(`  · QR Tag SKIP (pet < 60 days old)`);
      skipped++;
    }

    // ── Shelter history note ───────────────────────────────────────────────
    // Không tạo data vật lý cho shelter history — pawHistory của BE đọc
    // trực tiếp từ pet.shelter + pet.status để generate UNDER/WAS_UNDER_SHELTER_CARE.
    // Không cần backfill gì thêm ở đây.

    // ── Owner / Transfer note ─────────────────────────────────────────────
    // CURRENT_OWNER và PREVIOUS_OWNER được derive từ pet.owner + transferRequests.
    // Script không tạo thêm transfer giả — chỉ đảm bảo data thực tế đã đủ.

    console.log('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('━'.repeat(52));
  console.log('✅ Backfill complete!');
  console.log(`   Pets processed      : ${pets.length}`);
  console.log(`   Medical records +   : ${totalMedicalCreated}`);
  console.log(`   QR Tags linked      : ${totalTagsLinked}`);
  console.log(`   Too young for tag   : ${skipped}`);
  console.log('━'.repeat(52));
  console.log('');
  console.log('ℹ️  pawHistory (CURRENT_OWNER, UNDER_SHELTER_CARE, BIRTH...)');
  console.log('   được generate động trong getPetById() từ data thực.');
  console.log('   Không cần seed thêm bảng nào.');
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());