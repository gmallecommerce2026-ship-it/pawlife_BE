"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function getRandomWeight(min, max) {
    const weight = Math.random() * (max - min) + min;
    return Math.round(weight * 10) / 10;
}
async function main() {
    console.log('🚀 Bắt đầu cập nhật cân nặng (weight) ngẫu nhiên cho thú cưng...');
    const petsWithoutWeight = await prisma.pet.findMany({
        where: {
            weight: null,
        },
        select: {
            id: true,
            size: true,
        },
    });
    if (petsWithoutWeight.length === 0) {
        console.log('✅ Tất cả thú cưng trong hệ thống đều đã có cân nặng. Không cần cập nhật.');
        return;
    }
    console.log(`🔍 Tìm thấy ${petsWithoutWeight.length} thú cưng chưa có cân nặng. Tiến hành cập nhật...`);
    let updatedCount = 0;
    for (const pet of petsWithoutWeight) {
        let randomWeight = 0;
        switch (pet.size) {
            case client_1.PetSize.SMALL:
                randomWeight = getRandomWeight(2.0, 7.0);
                break;
            case client_1.PetSize.MEDIUM:
                randomWeight = getRandomWeight(7.5, 18.0);
                break;
            case client_1.PetSize.LARGE:
                randomWeight = getRandomWeight(19.0, 45.0);
                break;
            default:
                randomWeight = getRandomWeight(3.0, 20.0);
        }
        await prisma.pet.update({
            where: { id: pet.id },
            data: {
                weight: randomWeight,
            },
        });
        updatedCount++;
        if (updatedCount % 50 === 0) {
            console.log(`⏳ Đã cập nhật ${updatedCount}/${petsWithoutWeight.length} thú cưng...`);
        }
    }
    console.log(`🎉 HOÀN TẤT: Đã cập nhật thành công cân nặng cho ${updatedCount} thú cưng!`);
}
main()
    .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng trong quá trình cập nhật:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-weight-update.js.map