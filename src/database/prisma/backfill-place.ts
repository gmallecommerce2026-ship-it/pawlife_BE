import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const norm = (v?: string | null) => {
  const s = v?.trim();
  return !s ? null : /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

async function main() {
  const subs = await prisma.placeSubmission.findMany({
    where: { status: 'APPROVED', placeId: { not: null } },
  });
  for (const s of subs) {
    const labels = Array.isArray(s.amenities) ? (s.amenities as string[]) : [];
    if (labels.length) {
      const rows = await prisma.placeAmenity.findMany({
        where: { OR: [{ key: { in: labels } }, { labelVi: { in: labels } }, { labelEn: { in: labels } }] },
      });
      await prisma.placeAmenityOnPlace.createMany({
        data: rows.map((a) => ({ placeId: s.placeId!, amenityId: a.id })),
        skipDuplicates: true,
      });
      const matched = new Set(rows.flatMap((a) => [a.key, a.labelVi, a.labelEn]));
      const miss = labels.filter((l) => !matched.has(l));
      if (miss.length) console.log(`Place ${s.placeId} không khớp:`, miss);
    }
    if (s.website) {
      await prisma.place.update({ where: { id: s.placeId! }, data: { website: norm(s.website) } });
    }
  }
}
main().finally(() => prisma.$disconnect()); 