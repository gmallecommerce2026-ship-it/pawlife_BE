"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const GOOD_WITH_OPTIONS = ['Dogs', 'Cats', 'Kids', 'Strangers', 'Other Pets', 'Seniors'];
const BAD_WITH_OPTIONS = ['Dogs', 'Cats', 'Kids', 'Loud Noises', 'Small Animals'];
const IDEAL_HOME_OPTIONS = [
    'Needs a house with a fenced yard to run around safely.',
    'Perfect for apartment living as long as they get daily walks.',
    'A quiet home without small children would be best.',
    'Needs an active family who loves hiking and outdoor activities.',
    'Would thrive in a cozy environment with someone who is home most of the day.',
    'Needs an experienced owner willing to continue their training.'
];
function getRandomItems(arr, min, max) {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
async function main() {
    console.log('🌱 Bắt đầu seed biến thể (Behavior, Ideal Home) cho TOÀN BỘ thú cưng...');
    const pets = await prisma.pet.findMany({ select: { id: true } });
    if (pets.length === 0) {
        console.log('⚠️ Không tìm thấy thú cưng nào!');
        return;
    }
    const chunkSize = 100;
    for (let i = 0; i < pets.length; i += chunkSize) {
        const chunk = pets.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (pet) => {
            const goodWith = getRandomItems(GOOD_WITH_OPTIONS, 1, 3);
            const availableBadOptions = BAD_WITH_OPTIONS.filter(item => !goodWith.includes(item));
            const badWith = getRandomItems(availableBadOptions, 0, 2);
            const idealHome = IDEAL_HOME_OPTIONS[Math.floor(Math.random() * IDEAL_HOME_OPTIONS.length)];
            await prisma.pet.update({
                where: { id: pet.id },
                data: {
                    goodWith: goodWith,
                    badWith: badWith,
                    idealHome: idealHome,
                }
            });
        }));
        console.log(`✅ Đã xử lý xong batch ${i / chunkSize + 1} (${chunk.length} pets)`);
    }
    console.log('🎉 HOÀN TẤT SEED BIẾN THỂ!');
}
main()
    .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-pet-variants.js.map