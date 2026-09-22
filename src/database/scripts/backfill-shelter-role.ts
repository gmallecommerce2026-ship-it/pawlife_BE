import { PrismaClient, ShelterStaffRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shelters = await prisma.shelter.findMany({ select: { id: true } });

  for (const shelter of shelters) {
    const users = await prisma.user.findMany({
      where: { shelterId: shelter.id, role: 'SHELTER', shelterRole: null },
      orderBy: { createdAt: 'asc' },
    });

    if (users.length === 0) continue;

    // Người tạo sớm nhất -> ADMIN
    await prisma.user.update({
      where: { id: users[0].id },
      data: { shelterRole: ShelterStaffRole.ADMIN },
    });

    // Các user còn lại (nếu có) -> MEMBER
    for (const u of users.slice(1)) {
      await prisma.user.update({
        where: { id: u.id },
        data: { shelterRole: ShelterStaffRole.MEMBER },
      });
    }

    console.log(`Shelter ${shelter.id}: đã gán ${users.length} user`);
  }
}

main()
  .then(() => console.log('Backfill xong.'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());