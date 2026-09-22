"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const POSSIBLE_TRAITS = [
    'Playful', 'Clingy', 'Friendly', 'Quiet', 'Active',
    'Smart', 'Lazy', 'Curious', 'Shy', 'Loud', 'Gentle',
    'Loyal', 'Independent', 'Energetic', 'Calm'
];
function getRandomTraits(count) {
    const shuffled = [...POSSIBLE_TRAITS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
async function main() {
    console.log('🌱 Bắt đầu random traits (tính cách) cho TOÀN BỘ thú cưng trong hệ thống...');
    const pets = await prisma.pet.findMany({
        select: { id: true, name: true }
    });
    if (pets.length === 0) {
        console.log('⚠️ Không tìm thấy thú cưng nào trong hệ thống!');
        return;
    }
    console.log(`👉 Tìm thấy ${pets.length} thú cưng. Đang tiến hành cập nhật...`);
    for (const pet of pets) {
        const numTraits = Math.floor(Math.random() * 2) + 2;
        const randomSelectedTraits = getRandomTraits(numTraits);
        await prisma.pet.update({
            where: { id: pet.id },
            data: {
                traitsList: {
                    deleteMany: {},
                    create: randomSelectedTraits.map(traitName => ({ name: traitName }))
                }
            }
        });
        console.log(`✅ Đã cập nhật cho bé [${pet.name}] các tính cách: ${randomSelectedTraits.join(', ')}`);
    }
    console.log('🎉 HOÀN TẤT! Toàn bộ thú cưng đã được gắn tính cách ngẫu nhiên.');
}
main()
    .catch((e) => {
    console.error('❌ Có lỗi xảy ra:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-random-traits.js.map