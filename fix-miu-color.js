const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const pet = await p.pet.findFirst({ where: { name: 'miu' } });
  if (!pet) { console.log('Không tìm thấy pet "miu"'); return; }

  console.log('Trước:', JSON.stringify(pet.color));

  await p.pet.update({
    where: { id: pet.id },
    data: { color: { vi: 'Cam', en: 'Orange' } }
  });

  const after = await p.pet.findUnique({ where: { id: pet.id } });
  console.log('Sau:', JSON.stringify(after.color));
}

run().finally(() => p.$disconnect());
