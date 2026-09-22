"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🔍 Đang kiểm tra 5 bé mới nhất trong Database...\n');
    const pets = await prisma.pet.findMany({
        take: 5,
        include: { images: true },
    });
    if (pets.length === 0) {
        console.log('❌ Database đang trống, chưa có bé nào được seed!');
        return;
    }
    pets.forEach((pet) => {
        console.log(`🐶 Tên bé: ${pet.name}`);
        if (pet.images.length === 0) {
            console.log(`   ⚠️ KHÔNG CÓ ẢNH NÀO!`);
        }
        else {
            pet.images.forEach((img, index) => {
                console.log(`   📸 Ảnh ${index + 1}: ${img.url}`);
            });
        }
        console.log('----------------------------------------');
    });
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=check-img.js.map