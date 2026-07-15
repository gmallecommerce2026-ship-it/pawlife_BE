import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { title: { path: ['vi'], string_contains: 'Interpetfest' } },
        { title: { path: ['vi'], string_contains: 'Grand Season' } },
        { title: { path: ['vi'], string_contains: 'WCF Jubilee' } },
      ],
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
  });

  console.log(`Tìm thấy ${events.length} event khớp:\n`);
  for (const ev of events) {
    console.log(JSON.stringify(ev, null, 2));
    console.log('---');
  }

  if (events.length === 0) {
    console.log(
      '❌ Không tìm thấy event nào -> nghĩa là lần chạy seed gần nhất KHÔNG tạo được event (có thể bị lỗi giữa chừng, hoặc bạn đang tìm sai title).',
    );
  } else {
    for (const ev of events) {
      if (!ev.startDate) {
        console.log(`⚠️ Event id ${ev.id} bị THIẾU startDate trong DB -> lỗi nằm ở seed.`);
      } else {
        console.log(`✅ Event id ${ev.id} có startDate = ${ev.startDate.toISOString()} -> DB đúng, lỗi nhiều khả năng nằm ở backend API (DTO không trả field này) hoặc FE.`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error('Lỗi khi kiểm tra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });