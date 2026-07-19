"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Bắt đầu thêm dữ liệu My Pets cho hello@pawlife.vn...');
    const targetEmail = 'hello@pawlife.vn';
    const myUser = await prisma.user.upsert({
        where: { email: targetEmail },
        update: {},
        create: {
            email: targetEmail,
            name: 'Thiện Ân',
            role: client_1.Role.USER,
        },
    });
    console.log(`Đã tìm thấy/tạo User: ${myUser.email} (ID: ${myUser.id})`);
    console.log('Đang dọn dẹp dữ liệu cũ của Luna và Piglet (nếu có)...');
    await prisma.tag.deleteMany({
        where: {
            id: { in: ['luna-lost-tag-id', 'piglet-safe-tag-id'] }
        }
    });
    await prisma.pet.deleteMany({
        where: {
            ownerId: myUser.id,
            name: { in: ['LUNA', 'Piglet'] }
        }
    });
    console.log('Đang tạo bé LUNA...');
    const luna = await prisma.pet.create({
        data: {
            name: 'LUNA',
            species: 'Dog',
            breed: 'Golden Retriever',
            gender: client_1.PetGender.FEMALE,
            size: client_1.PetSize.LARGE,
            color: 'Vàng rơm',
            status: client_1.PetStatus.ADOPTED,
            ownerId: myUser.id,
            qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=pawlife://tag/luna-lost-tag-id',
            qrVerificationStatus: client_1.VerificationStatus.VERIFIED,
            images: {
                create: [
                    { url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=600&auto=format&fit=crop' }
                ]
            },
            tags: {
                create: {
                    id: 'luna-lost-tag-id',
                    status: client_1.TagStatus.LOST,
                }
            }
        }
    });
    console.log(`Đã thêm thành công Pet: ${luna.name} kèm QR Code`);
    console.log('Đang tạo bé Piglet...');
    const piglet = await prisma.pet.create({
        data: {
            name: 'Piglet a',
            species: 'Cat',
            breed: 'Tabby Cat',
            gender: client_1.PetGender.MALE,
            size: client_1.PetSize.SMALL,
            color: 'Xám Trắng',
            status: client_1.PetStatus.ADOPTED,
            ownerId: myUser.id,
            qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=pawlife://tag/piglet-safe-tag-id',
            qrVerificationStatus: client_1.VerificationStatus.VERIFIED,
            images: {
                create: [
                    { url: 'https://images.unsplash.com/photo-1513245543132-31f507417b26?q=80&w=600&auto=format&fit=crop' }
                ]
            },
            tags: {
                create: {
                    id: 'piglet-safe-tag-id',
                    status: client_1.TagStatus.ACTIVE,
                }
            }
        }
    });
    console.log(`Đã thêm thành công Pet: ${piglet.name} kèm QR Code`);
    console.log('✅ Đã thêm dữ liệu My Pets thành công!');
}
main()
    .catch((e) => {
    console.error('Lỗi khi seed thêm dữ liệu:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-my-pets.js.map