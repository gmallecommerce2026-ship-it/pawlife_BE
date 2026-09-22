"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Bắt đầu tạo Tag (QR Code) cho thú cưng...');
    const petsWithoutTag = await prisma.pet.findMany({
        where: {
            tags: {
                none: {}
            },
        },
    });
    if (petsWithoutTag.length === 0) {
        console.log('Tất cả thú cưng đều đã có QR Code.');
        return;
    }
    for (const pet of petsWithoutTag) {
        await prisma.tag.create({
            data: {
                petId: pet.id,
                status: 'ACTIVE',
            },
        });
        console.log(`✅ Đã tạo QR Code cho bé: ${pet.name}`);
    }
    console.log('Hoàn tất seed QR Code!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-tags.js.map