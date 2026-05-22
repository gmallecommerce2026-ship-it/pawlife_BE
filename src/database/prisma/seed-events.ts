import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('File seed-events.ts này đã được thay thế bởi seed-organizer.ts.');
  console.log('Vui lòng chạy file seed-organizer.ts để tạo dữ liệu Event và Organizer nhé!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });