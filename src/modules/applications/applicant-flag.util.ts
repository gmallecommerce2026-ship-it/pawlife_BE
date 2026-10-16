import { PrismaService } from '../../database/prisma/prisma.service';

export const APPLICANT_FLAG_REASONS = [
  'NO_SHOW',
  'ABUSIVE',
  'FAKE_INFO',
  'PET_ABANDONED',
  'OTHER',
] as const;

// Gắn applicantFlag (hoặc null) vào từng đơn, chỉ 1 query cho cả danh sách
export async function attachApplicantFlags<T extends { userId: string }>(
  prisma: PrismaService,
  shelterId: string,
  apps: T[],
) {
  const userIds = [...new Set(apps.map((a) => a.userId))];
  const flags = await prisma.applicantFlag.findMany({
    where: { shelterId, userId: { in: userIds } },
    select: { userId: true, reason: true, note: true, createdAt: true },
  });
  const map = new Map(flags.map((f) => [f.userId, f] as const));
  return apps.map((a) => ({ ...a, applicantFlag: map.get(a.userId) ?? null }));
}