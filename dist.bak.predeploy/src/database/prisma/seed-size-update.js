"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🚀 Bắt đầu cập nhật dữ liệu Size cho Pet...");
    const pets = await prisma.pet.findMany();
    for (const pet of pets) {
        if (!pet.weight)
            continue;
        let newSize = client_1.PetSize.MEDIUM;
        if (pet.weight < 5) {
            newSize = client_1.PetSize.SMALL;
        }
        else if (pet.weight > 15) {
            newSize = client_1.PetSize.LARGE;
        }
        else {
            newSize = client_1.PetSize.MEDIUM;
        }
        await prisma.pet.update({
            where: { id: pet.id },
            data: { size: newSize },
        });
        console.log(`✅ Đã cập nhật ${pet.name} (${pet.weight}kg) -> ${newSize}`);
    }
    console.log("✨ Hoàn tất cập nhật Size cho toàn bộ Pet!");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-size-update.js.map