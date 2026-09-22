"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const mockLocations = [
    { address: "123 Đường Láng, Đống Đa, Hà Nội", lat: 21.0166, lng: 105.8115 },
    { address: "456 Nguyễn Trãi, Thanh Xuân, Hà Nội", lat: 20.9937, lng: 105.8083 },
    { address: "789 Cầu Giấy, Quan Hoa, Hà Nội", lat: 21.0333, lng: 105.7958 },
    { address: "101 Kim Mã, Ba Đình, Hà Nội", lat: 21.0311, lng: 105.8197 },
    { address: "202 Hai Bà Trưng, Hoàn Kiếm, Hà Nội", lat: 21.0254, lng: 105.8512 },
    { address: "55 Lê Lợi, Hà Đông, Hà Nội", lat: 20.9702, lng: 105.7725 },
];
const mockCovers = [
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1553322378-eb94e5966b0c?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1596492784531-6e6eb5ea9993?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1527526029430-319f10814151?q=80&w=1000&auto=format&fit=crop"
];
async function main() {
    console.log('🚀 Bắt đầu bổ sung dữ liệu (Contact Info, Verified, Location, Cover Image)...');
    const shelters = await prisma.shelter.findMany();
    if (shelters.length === 0) {
        console.log('⚠️ Không tìm thấy Shelter nào trong DB. Vui lòng chạy file seed cũ trước.');
        return;
    }
    for (let i = 0; i < shelters.length; i++) {
        const shelter = shelters[i];
        const emailDomain = shelter.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pawlife';
        const isVerified = Math.random() > 0.3;
        const joinDate = new Date();
        joinDate.setFullYear(joinDate.getFullYear() - 1 - Math.floor(Math.random() * 2));
        const verifyDate = new Date(joinDate);
        verifyDate.setMonth(verifyDate.getMonth() + 1);
        const location = mockLocations[i % mockLocations.length];
        const coverUrl = mockCovers[i % mockCovers.length];
        await prisma.shelter.update({
            where: { id: shelter.id },
            data: {
                emailAddress: `contact@${emailDomain}.com`,
                isVerified: isVerified,
                createdAt: joinDate,
                verifiedAt: isVerified ? verifyDate : null,
                address: location.address,
                latitude: location.lat,
                longitude: location.lng,
                coverUrl: coverUrl,
            },
        });
        console.log(`✅ Đã cập nhật Contact, Location & Cover Image cho: ${shelter.name}`);
    }
    console.log('🎉 Hoàn tất quá trình bổ sung dữ liệu!');
}
main()
    .catch((e) => {
    console.error('❌ Lỗi khi chạy seed bổ sung:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-supplementary.js.map