"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Bắt đầu cập nhật avatar cho các trạm cứu hộ hiện tại...');
    const shelters = await prisma.shelter.findMany();
    if (shelters.length === 0) {
        console.log('Không có trạm cứu hộ nào trong database để cập nhật.');
        return;
    }
    const avatarUrls = [
        'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=200&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=200&auto=format&fit=crop'
    ];
    const coverUrls = [
        'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1534361960057-19889db9621e?q=80&w=800&auto=format&fit=crop'
    ];
    let updatedCount = 0;
    for (let i = 0; i < shelters.length; i++) {
        const shelter = shelters[i];
        const avatarToAssign = avatarUrls[i % avatarUrls.length];
        const coverToAssign = coverUrls[i % coverUrls.length];
        await prisma.shelter.update({
            where: { id: shelter.id },
            data: {
                avatarUrl: avatarToAssign,
                coverUrl: coverToAssign,
            },
        });
        updatedCount++;
        console.log(`- Đã update trạm: ${shelter.name}`);
    }
    console.log(`\n✅ Thành công! Đã cập nhật avatar/cover cho ${updatedCount} trạm cứu hộ.`);
}
main()
    .catch((e) => {
    console.error('Lỗi khi cập nhật avatar trạm cứu hộ:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=update-shelter-avatars.js.map