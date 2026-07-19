"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const goodWithOptions = ['Dogs', 'Cats', 'Kids', 'Seniors', 'Other Pets', 'Strangers', 'Large crowds', 'Car rides'];
const badWithOptions = ['Cats', 'Small children', 'Loud noises', 'Other dogs', 'Small animals', 'Being left alone', 'Fast movements', 'Thunderstorms'];
function getRandomItems(array, maxItems) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.floor(Math.random() * maxItems) + 1);
}
async function main() {
    console.log('Bắt đầu seeding Pet Behaviors (goodWith, badWith)...');
    const pets = await prisma.pet.findMany();
    console.log(`Tìm thấy ${pets.length} thú cưng. Đang tiến hành cập nhật...`);
    let updatedCount = 0;
    for (const pet of pets) {
        const goodWith = getRandomItems(goodWithOptions, 3);
        const hasBadWith = Math.random() > 0.4;
        let badWith = [];
        if (hasBadWith) {
            const rawBadWith = getRandomItems(badWithOptions, 2);
            badWith = rawBadWith.filter(item => {
                if (item === 'Other dogs' && goodWith.includes('Dogs'))
                    return false;
                if (item === 'Cats' && goodWith.includes('Cats'))
                    return false;
                if (item === 'Small children' && goodWith.includes('Kids'))
                    return false;
                return true;
            });
        }
        await prisma.pet.update({
            where: { id: pet.id },
            data: {
                goodWith: goodWith,
                badWith: badWith.length > 0 ? badWith : [],
            },
        });
        updatedCount++;
        if (updatedCount % 50 === 0) {
            console.log(`Đã cập nhật ${updatedCount}/${pets.length} thú cưng...`);
        }
    }
    console.log('✅ Seeding Behavior thành công cho toàn bộ thú cưng!');
}
main()
    .catch((e) => {
    console.error('❌ Có lỗi xảy ra trong quá trình seeding:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-behavior.js.map