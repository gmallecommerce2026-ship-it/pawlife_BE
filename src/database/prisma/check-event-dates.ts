import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allEvents = await prisma.event.findMany({
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const keywords = ['Interpetfest', 'Grand Season', 'WCF Jubilee'];
  const events = allEvents.filter((ev) => {
    const titleStr = JSON.stringify(ev.title);
    return keywords.some((kw) => titleStr.includes(kw));
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