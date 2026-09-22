"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma = new client_1.PrismaClient();
const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
async function main() {
    console.log('Bắt đầu dọn dẹp và cập nhật QR Code chuẩn UUID...');
    const allPets = await prisma.pet.findMany();
    for (const pet of allPets) {
        const existingTags = await prisma.tag.findMany({ where: { petId: pet.id } });
        const isCurrentlyLost = existingTags.some(tag => tag.status === 'LOST');
        const invalidTags = existingTags.filter(tag => !isUUID(tag.id));
        if (invalidTags.length > 0) {
            await prisma.tag.deleteMany({
                where: { id: { in: invalidTags.map(t => t.id) } }
            });
        }
        const hasValidTag = existingTags.some(tag => isUUID(tag.id));
        if (!hasValidTag) {
            const newUuidTag = (0, crypto_1.randomUUID)();
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=pawlife://tag/${newUuidTag}`;
            await prisma.pet.update({
                where: { id: pet.id },
                data: {
                    qrCodeUrl: qrUrl,
                    qrVerificationStatus: client_1.VerificationStatus.VERIFIED,
                }
            });
            await prisma.tag.create({
                data: {
                    id: newUuidTag,
                    status: isCurrentlyLost ? 'LOST' : 'ACTIVE',
                    petId: pet.id
                }
            });
            console.log(`✅ Đã cập nhật Tag UUID hợp lệ cho bé: ${pet.name}`);
        }
        else {
            console.log(`⏩ Bé ${pet.name} đã có mã UUID chuẩn, bỏ qua.`);
        }
    }
    console.log('🎉 Hoàn tất cập nhật mã QR chuẩn hệ thống!');
}
main()
    .catch((e) => {
    console.error('Lỗi khi cập nhật QR:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=update-all-qr.js.map