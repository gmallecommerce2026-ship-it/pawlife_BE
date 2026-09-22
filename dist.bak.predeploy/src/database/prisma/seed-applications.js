"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getPastDate = (years, months = 0) => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    date.setMonth(date.getMonth() - months);
    return date;
};
async function main() {
    console.log('🌱 Bắt đầu seed 7 trạng thái Adoption Applications...');
    console.log('🧹 Đang dọn dẹp dữ liệu cũ (Applications, Pets, Images)...');
    await prisma.adoptionApplication.deleteMany({});
    const mockPetIds = [
        'pet-milo-001', 'pet-luna-002', 'pet-bella-003', 'pet-simba-004',
        'pet-max-005', 'pet-daisy-006', 'pet-charlie-007'
    ];
    await prisma.petImage.deleteMany({ where: { petId: { in: mockPetIds } } });
    await prisma.pet.deleteMany({ where: { id: { in: mockPetIds } } });
    console.log('✅ Đã dọn dẹp xong. Bắt đầu tạo dữ liệu mới tinh...');
    const testUser = await prisma.user.upsert({
        where: { email: 'hello@pawlife.vn' },
        update: {
            avatarUrl: 'https://api.dicebear.com/9.x/avataaars/png?seed=AnDev&size=256',
        },
        create: {
            email: 'hello@pawlife.vn',
            name: 'pawlife',
            phone: '0766668602',
            role: 'USER',
            avatarUrl: 'https://api.dicebear.com/9.x/avataaars/png?seed=AnDev&size=256',
        },
    });
    const shelters = await prisma.shelter.findMany({ select: { id: true } });
    if (shelters.length === 0) {
        throw new Error('❌ Không tìm thấy trạm cứu hộ nào trong hệ thống. Vui lòng seed Shelter trước!');
    }
    const mockPets = [
        { name: 'Milo', species: 'Dog', breed: 'Corgi', gender: client_1.PetGender.MALE, size: client_1.PetSize.MEDIUM, weight: 12.5, statusId: mockPetIds[0], imgUrl: 'https://images.dog.ceo/breeds/corgi-cardigan/cg1.jpg', dob: getPastDate(2, 0), desc: 'Corgi năng động.', ideal: 'Sân vườn.' },
        { name: 'Luna', species: 'Cat', breed: 'British Shorthair', gender: client_1.PetGender.FEMALE, size: client_1.PetSize.SMALL, weight: 4.2, statusId: mockPetIds[1], imgUrl: 'https://cdn2.thecatapi.com/images/0XYvRd7oD.jpg', dob: getPastDate(1, 0), desc: 'Mèo Anh lông ngắn ngọt ngào.', ideal: 'Nhà yên tĩnh.' },
        { name: 'Bella', species: 'Dog', breed: 'Golden Retriever', gender: client_1.PetGender.FEMALE, size: client_1.PetSize.LARGE, weight: 28.0, statusId: mockPetIds[2], imgUrl: 'https://images.dog.ceo/breeds/retriever-golden/n02099601_3004.jpg', dob: getPastDate(3, 6), desc: 'Golden hiền lành.', ideal: 'Gia đình có trẻ nhỏ.' },
        { name: 'Simba', species: 'Cat', breed: 'Persian', gender: client_1.PetGender.MALE, size: client_1.PetSize.SMALL, weight: 4.5, statusId: mockPetIds[3], imgUrl: 'https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg', dob: getPastDate(0, 8), desc: 'Ba Tư quấn chủ.', ideal: 'Cần người chải lông.' },
        { name: 'Max', species: 'Dog', breed: 'Husky', gender: client_1.PetGender.MALE, size: client_1.PetSize.LARGE, weight: 24.5, statusId: mockPetIds[4], imgUrl: 'https://images.dog.ceo/breeds/husky/n02110185_10047.jpg', dob: getPastDate(4, 0), desc: 'Husky năng lượng.', ideal: 'Chủ yêu thể thao.' },
        { name: 'Daisy', species: 'Dog', breed: 'Poodle', gender: client_1.PetGender.FEMALE, size: client_1.PetSize.MEDIUM, weight: 15.0, statusId: mockPetIds[5], imgUrl: 'https://images.dog.ceo/breeds/poodle-standard/n02113799_2280.jpg', dob: getPastDate(2, 5), desc: 'Poodle lanh lợi.', ideal: 'Căn hộ chung cư.' },
        { name: 'Charlie', species: 'Dog', breed: 'Beagle', gender: client_1.PetGender.MALE, size: client_1.PetSize.MEDIUM, weight: 10.5, statusId: mockPetIds[6], imgUrl: 'https://images.dog.ceo/breeds/beagle/n02088364_12440.jpg', dob: getPastDate(0, 10), desc: 'Beagle ham ăn.', ideal: 'Có anh chị chó chơi cùng.' },
    ];
    const createdPets = [];
    const POSSIBLE_TAGS = ['Playful', 'Clingy', 'Friendly', 'Quiet', 'Active', 'Smart'];
    for (let i = 0; i < mockPets.length; i++) {
        const p = mockPets[i];
        const randomShelter = shelters[Math.floor(Math.random() * shelters.length)];
        const pet = await prisma.pet.create({
            data: {
                id: p.statusId,
                name: p.name,
                species: p.species,
                breed: p.breed,
                dob: p.dob,
                gender: p.gender,
                size: p.size,
                weight: p.weight,
                description: p.desc,
                idealHome: p.ideal,
                status: 'AVAILABLE',
                shelterId: randomShelter.id,
                traitsList: {
                    create: [
                        { name: "Playful" },
                        { name: "Clingy" }
                    ]
                }
            },
        });
        await prisma.petImage.create({ data: { url: p.imgUrl, petId: pet.id } });
        createdPets.push(pet);
    }
    const standardCommitments = {
        vaccine: true, medical: true, expenses: true,
        updateStatus: true, homeVisit: true, provideID: true,
    };
    const applicationsData = [
        { petId: createdPets[0].id, status: client_1.ApplicationStatus.SUBMITTED, note: 'Vừa mới nộp, chờ hệ thống tiếp nhận.', adoptFor: 'Myself', housing: 'Apartment' },
        { petId: createdPets[1].id, status: client_1.ApplicationStatus.PENDING, note: 'Đang xem xét hồ sơ sơ bộ.', adoptFor: 'Myself', housing: 'House with Yard' },
        { petId: createdPets[2].id, status: client_1.ApplicationStatus.NEED_MORE_INFO, note: 'Yêu cầu bổ sung hình ảnh nơi ở hiện tại.', adoptFor: 'Family', housing: 'Townhouse' },
        { petId: createdPets[3].id, status: client_1.ApplicationStatus.INTERVIEW_SCHEDULED, note: 'Đã hẹn lịch phỏng vấn qua điện thoại vào sáng mai.', adoptFor: 'Myself', housing: 'Apartment' },
        { petId: createdPets[4].id, status: client_1.ApplicationStatus.APPROVED, note: 'Hồ sơ đạt chuẩn. Chuẩn bị qua trạm đón bé.', adoptFor: 'Family', housing: 'House with Yard' },
        { petId: createdPets[5].id, status: client_1.ApplicationStatus.ADOPTION_COMPLETED, note: 'Nhận nuôi thành công, bé đã về nhà.', adoptFor: 'Myself', housing: 'Apartment' },
        { petId: createdPets[6].id, status: client_1.ApplicationStatus.CLOSED, note: 'Đơn bị từ chối do không đủ điều kiện chăm sóc.', adoptFor: 'Someone else', housing: 'Shared Apartment' },
    ];
    for (const app of applicationsData) {
        const petName = createdPets.find(p => p.id === app.petId)?.name || 'thú cưng';
        await prisma.adoptionApplication.create({
            data: {
                userId: testUser.id,
                petId: app.petId,
                status: app.status,
                fullName: testUser.name || 'Nguyễn Thiên Ân',
                phone: testUser.phone || '0901234567',
                zalo: '0901234567',
                adoptFor: app.adoptFor,
                location: 'Quận Cầu Giấy, Hà Nội',
                housing: app.housing,
                children: 'No',
                cage: 'Sometimes',
                petExperience: 'Yes, had a dog for 5 years.',
                prevPetHistory: 'Bé cún trước đây mất do tuổi già.',
                employmentStatus: 'Full-time Developer',
                adoptionReason: `Tôi rất thích bé ${petName} và tự tin có đủ tài chính chăm sóc. ${app.note}`,
                commitments: standardCommitments,
            },
        });
    }
    console.log('🎉 Hoàn tất seed 7 trạng thái cùng đầy đủ tuổi, giới tính, kích cỡ và cân nặng! Hãy reload lại app React Native nhé!');
}
main()
    .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-applications.js.map