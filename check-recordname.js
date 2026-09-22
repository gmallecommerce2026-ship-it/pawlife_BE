
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();

const PET_ID = '11ed946c-4f67-4229-b0df-bc8c62267248'; // <-- đổi thành id pet đang lỗi

async function run() {

  const records = await p.medicalRecord.findMany({

    where: { petId: PET_ID }

  });

  records.forEach((r) => {

    console.log('--- record id:', r.id, '---');

    console.log('typeof recordName:', typeof r.recordName);

    console.log('raw recordName (JSON.stringify):', JSON.stringify(r.recordName));

    console.log('typeof nextDueName:', typeof r.nextDueName);

    console.log('raw nextDueName (JSON.stringify):', JSON.stringify(r.nextDueName));

    console.log('');

  });

}

run().finally(() => p.$disconnect());

