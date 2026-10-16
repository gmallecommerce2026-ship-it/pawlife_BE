import { ApplicationStatus, AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

export interface RelatedApplicationItem {
  id: string;
  status: ApplicationStatus;
  petId: string;
  petName: string;
  interview: { at: Date; status: AppointmentStatus; staff: string[] } | null;
}

const INACTIVE: ApplicationStatus[] = [ApplicationStatus.CLOSED, ApplicationStatus.ADOPTION_COMPLETED];
const DEAD_APPOINTMENT: AppointmentStatus[] = [AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED];

// Gắn vào mỗi đơn danh sách các đơn ĐANG XỬ LÝ khác của cùng người nộp tại shelter.
// Query độc lập với bộ lọc status/petId của danh sách, nên đơn ở cột khác vẫn được tính.
export async function attachRelatedApplications<T extends { id: string; userId: string }>(
  prisma: PrismaService,
  shelterId: string,
  apps: T[],
): Promise<(T & { relatedApplications: RelatedApplicationItem[] })[]> {
  if (apps.length === 0) return [];

  const rows = await prisma.adoptionApplication.findMany({
    where: {
      userId: { in: [...new Set(apps.map((a) => a.userId))] },
      pet: { shelterId },
      status: { notIn: INACTIVE },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      petId: true,
      pet: { select: { name: true } },
      appointment: { select: { appointmentDate: true, status: true, members: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byUser.get(r.userId);
    if (list) list.push(r);
    else byUser.set(r.userId, [r]);
  }

  return apps.map((a) => ({
    ...a,
    relatedApplications: (byUser.get(a.userId) ?? [])
      .filter((r) => r.id !== a.id)
      .map((r): RelatedApplicationItem => {
        const ap = r.appointment && !DEAD_APPOINTMENT.includes(r.appointment.status) ? r.appointment : null;
        const members = Array.isArray(ap?.members) ? (ap!.members as any[]) : [];
        return {
          id: r.id,
          status: r.status,
          petId: r.petId,
          petName: r.pet.name,
          interview: ap
            ? {
                at: ap.appointmentDate,
                status: ap.status,
                staff: members.map((m) => m?.name ?? m?.email).filter(Boolean) as string[],
              }
            : null,
        };
      }),
  }));
}