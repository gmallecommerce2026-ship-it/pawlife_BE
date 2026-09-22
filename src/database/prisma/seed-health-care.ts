// src/database/prisma/seed-health-care.ts
import { PrismaClient, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed Health Care data cho toàn bộ Pet...');
  const pets = await prisma.pet.findMany();

  let updatedCount = 0;

  for (const pet of pets) {
    const isSpayedNeutered = Math.random() > 0.5;
    const isFullyVaccinated = Math.random() > 0.4;

    await prisma.pet.update({
      where: { id: pet.id },
      data: { isSpayedNeutered, isVaccinated: isFullyVaccinated },
    });

    await prisma.medicalRecord.deleteMany({
      where: { petId: pet.id, type: 'vaccination' },
    });

    // Xác định loài để chọn tên Vaccine chuẩn
    const speciesStr = JSON.stringify(pet.species || {}).toLowerCase();
    const isDog = speciesStr.includes('dog') || speciesStr.includes('chó') || pet.species === 'Dog';

    // Rule vaccine: 1 mũi Dại + 3 mũi Lõi
    const coreVaccineName = isDog ? 'Vaccine 5 bệnh (DHPP)' : 'Vaccine 3 bệnh (FVRCP)';
    const rabiesVaccineName = 'Vaccine Dại (Rabies)';

    // Giả lập số lượng mũi đã tiêm
    const rabiesCount = isFullyVaccinated ? 1 : Math.floor(Math.random() * 2); // 0 hoặc 1
    const coreCount = isFullyVaccinated ? 3 : Math.floor(Math.random() * 4); // 0, 1, 2, hoặc 3

    const vaccinesToCreate: any[] = [];

    // Tạo record mũi Dại
    if (rabiesCount > 0) {
      vaccinesToCreate.push({
        petId: pet.id,
        type: 'vaccination',
        recordName: { en: 'Rabies Vaccine', vi: rabiesVaccineName },
        recordDate: new Date(Date.now() - Math.random() * 10000000000),
        verificationStatus: VerificationStatus.VERIFIED,
      });
    }

    // Tạo record mũi Lõi
    for (let i = 0; i < coreCount; i++) {
      vaccinesToCreate.push({
        petId: pet.id,
        type: 'vaccination',
        recordName: { en: isDog ? '5-in-1 Vaccine' : '3-in-1 (FVRCP)', vi: coreVaccineName },
        recordDate: new Date(Date.now() - Math.random() * 10000000000),
        verificationStatus: VerificationStatus.VERIFIED,
      });
    }

    if (vaccinesToCreate.length > 0) {
      await prisma.medicalRecord.createMany({ data: vaccinesToCreate });
    }
    updatedCount++;
  }

  console.log(`✅ Đã seed chi tiết Vaccine thành công cho ${updatedCount} pets!`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());