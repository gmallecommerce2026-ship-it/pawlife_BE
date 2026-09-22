"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
//# sourceMappingURL=seed-events.js.map