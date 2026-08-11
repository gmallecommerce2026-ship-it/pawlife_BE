import { PrismaClient, AppointmentType, AppointmentStatus, ApplicationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'hello@pawlife.vn';

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Không tìm thấy user với email ${email}`);
  }

  // Lấy 1 pet bất kỳ đang thuộc 1 shelter (bắt buộc phải có shelterId vì Appointment cần shelterId)
  const pet = await prisma.pet.findFirst({
    where: { shelterId: { not: null } },
    include: { shelter: true },
  });
  if (!pet || !pet.shelterId) {
    throw new Error('Không tìm thấy pet nào có shelter để seed.');
  }

  // Tìm hoặc tạo AdoptionApplication cho user + pet này (unique theo [userId, petId])
  let application = await prisma.adoptionApplication.findUnique({
    where: { userId_petId: { userId: user.id, petId: pet.id } },
  });

  if (!application) {
    application = await prisma.adoptionApplication.create({
      data: {
        userId: user.id,
        petId: pet.id,
        status: ApplicationStatus.INTERVIEW_SCHEDULED,
        fullName: user.name || 'PawLife Demo User',
        phone: user.phone || '0900000000',
        zalo: user.phone || '0900000000',
        adoptFor: 'Myself',
        location: 'Hà Nội',
        housing: 'Apartment (allows pet ownership)',
        children: 'No',
        cage: 'No',
        petExperience: "No, I haven't",
        prevPetHistory: 'N/A',
        employmentStatus: 'Currently employed',
        adoptionReason: 'Because I want to give them a forever home',
        commitments: {
          vaccine: 'Yes',
          medical: 'Yes',
          expenses: 'Yes',
          updateStatus: 'Yes',
          homeVisit: 'Yes',
          provideID: 'Yes',
        },
      },
    });
  } else if (application.status !== ApplicationStatus.INTERVIEW_SCHEDULED) {
    application = await prisma.adoptionApplication.update({
      where: { id: application.id },
      data: { status: ApplicationStatus.INTERVIEW_SCHEDULED },
    });
  }

  // Tính giờ hẹn = hiện tại + 10 phút
  const now = new Date();
  const start = new Date(now.getTime() + 10 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;

  const appointmentDateOnly = new Date(now);
  appointmentDateOnly.setHours(0, 0, 0, 0);

  const appointment = await prisma.appointment.upsert({
    where: { applicationId: application.id },
    create: {
      applicationId: application.id,
      userId: user.id,
      petId: pet.id,
      shelterId: pet.shelterId,
      appointmentDate: appointmentDateOnly,
      startTime,
      endTime,
      type: AppointmentType.ONLINE,
      status: AppointmentStatus.CONFIRMED,
      meetLink: 'https://meet.google.com/abc-defg-hij', // link demo, thay bằng link Meet thật khi có
      bookingDelegated: false,
      createdBy: user.id,
    },
    update: {
      appointmentDate: appointmentDateOnly,
      startTime,
      endTime,
      type: AppointmentType.ONLINE,
      status: AppointmentStatus.CONFIRMED,
      meetLink: 'https://meet.google.com/abc-defg-hij',
    },
  });

  console.log('✅ Seed xong:');
  console.log({
    user: user.email,
    pet: pet.name,
    shelter: pet.shelter?.name,
    appointmentId: appointment.id,
    startTime,
    endTime,
    appointmentDate: appointmentDateOnly.toISOString().split('T')[0],
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });