"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const prisma = new client_1.PrismaClient();
function getRandomDateBetween(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
async function main() {
    console.log('🌱 Bắt đầu seeding Paw History cho toàn bộ Pets...');
    const pets = await prisma.pet.findMany({
        include: { tags: true, transferRequests: true }
    });
    const users = await prisma.user.findMany({ take: 5 });
    let updatedCount = 0;
    for (const pet of pets) {
        const updates = {};
        if (!pet.dob) {
            const dob = getRandomDateBetween(new Date(2019, 0, 1), new Date(2023, 11, 31));
            updates.dob = dob;
        }
        if (!pet.vaccinationRecordUrls || (Array.isArray(pet.vaccinationRecordUrls) && pet.vaccinationRecordUrls.length === 0)) {
            updates.vaccinationRecordUrls = [
                "https://example.com/fake-vaccine-1.jpg",
                "https://example.com/fake-vaccine-2.jpg"
            ];
        }
        if (pet.tags.length === 0) {
            const newTagId = (0, uuid_1.v4)();
            await prisma.tag.create({
                data: {
                    id: newTagId,
                    status: 'ACTIVE',
                    petId: pet.id,
                    reports: { create: [] }
                }
            });
            updates.qrCodeUrl = `https://pawcare.app/tag/${newTagId}`;
            updates.qrVerificationStatus = 'VERIFIED';
        }
        if (Object.keys(updates).length > 0) {
            await prisma.pet.update({
                where: { id: pet.id },
                data: updates
            });
        }
        if (pet.transferRequests.length === 0 && Math.random() > 0.7 && users.length > 1) {
            const sender = users[0];
            const receiver = pet.ownerId === users[1].id ? users[2] : users[1];
            await prisma.transferRequest.create({
                data: {
                    petId: pet.id,
                    senderId: sender.id,
                    receiverId: receiver.id,
                    status: 'COMPLETED',
                    createdAt: getRandomDateBetween(new Date(2023, 0, 1), new Date(2024, 0, 1)),
                    updatedAt: getRandomDateBetween(new Date(2024, 1, 1), new Date()),
                }
            });
        }
        updatedCount++;
        if (updatedCount % 50 === 0) {
            console.log(`...Đã xử lý ${updatedCount}/${pets.length} pets`);
        }
    }
    console.log(`✅ Hoàn tất seed Paw History. Đã cập nhật ${updatedCount} hồ sơ!`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-paw-history.js.map