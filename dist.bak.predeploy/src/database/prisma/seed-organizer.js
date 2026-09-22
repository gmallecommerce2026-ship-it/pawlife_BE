"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Bắt đầu dọn dẹp dữ liệu Organizer và Event cũ...');
    await prisma.eventImage.deleteMany();
    await prisma.eventInterest.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organizer.deleteMany();
    console.log('Đang tạo Organizers...');
    const organizersData = [
        {
            name: 'PawLife Official',
            handle: '@pawlife_vn',
            about: 'Đơn vị tổ chức các sự kiện kết nối cộng đồng yêu thú cưng hàng đầu tại Việt Nam. Chúng tôi mang đến những trải nghiệm tuyệt vời nhất cho bạn và những người bạn bốn chân thông qua các workshop, hội chợ và buổi offline.',
            avatarUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=200&auto=format&fit=crop',
            coverUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=800&auto=format&fit=crop',
            followers: 12500,
        },
        {
            name: 'Pawsome Events Co.',
            handle: '@pawsome_events',
            about: 'Chuyên tổ chức các khóa huấn luyện, dog marathon và các hoạt động thể chất ngoài trời dành riêng cho cún cưng.',
            avatarUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=200&auto=format&fit=crop',
            coverUrl: 'https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?q=80&w=800&auto=format&fit=crop',
            followers: 8430,
        },
        {
            name: 'Feline Friends Hub',
            handle: '@feline_hub',
            about: 'Tổ chức phi lợi nhuận tập trung vào các sự kiện triển lãm mèo nghệ thuật, workshop chăm sóc sức khỏe mèo và các buổi cafe mèo cuối tuần.',
            avatarUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=200&auto=format&fit=crop',
            coverUrl: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?q=80&w=800&auto=format&fit=crop',
            followers: 5200,
        },
        {
            name: 'City Pet Training',
            handle: '@citypettraining',
            about: 'Trung tâm huấn luyện thú cưng chuyên nghiệp, thường xuyên mở các buổi workshop giao lưu và dạy kỹ năng cơ bản cho chó con.',
            avatarUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=200&auto=format&fit=crop',
            coverUrl: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?q=80&w=800&auto=format&fit=crop',
            followers: 3100,
        }
    ];
    const createdOrganizers = [];
    for (const org of organizersData) {
        const createdOrg = await prisma.organizer.create({
            data: org,
        });
        createdOrganizers.push(createdOrg);
    }
    console.log(`Đã tạo thành công ${createdOrganizers.length} Organizers!`);
    console.log('Đang tạo Events mẫu liên kết với Organizers kèm Photo Gallery...');
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    await prisma.event.create({
        data: {
            title: 'Dog art therapy & painting class',
            category: 'Art',
            description: 'Tham gia lớp học vẽ nghệ thuật cùng những người bạn bốn chân. Trải nghiệm thư giãn tuyệt vời dành cho những người yêu chó và đam mê nghệ thuật.',
            bannerUrl: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?q=80&w=800&auto=format&fit=crop',
            startDate: new Date(nextWeek.setHours(18, 0, 0, 0)),
            endDate: new Date(nextWeek.setHours(21, 0, 0, 0)),
            locationName: 'Paw Studio',
            address: 'Quận Tây Hồ, Hà Nội',
            latitude: 21.058178,
            longitude: 105.804158,
            interestedCount: 255,
            organizerId: createdOrganizers[0].id,
            images: {
                create: [
                    { url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?q=80&w=300&auto=format&fit=crop' }
                ]
            }
        }
    });
    await prisma.event.create({
        data: {
            title: 'Hội thi Chó chạy Marathon 2026',
            category: 'Sports',
            description: 'Giải chạy bộ đồng hành cùng thú cưng quy mô lớn nhất năm. Cơ hội để thú cưng của bạn thể hiện sức bền và nhận những phần quà giá trị.',
            bannerUrl: 'https://images.unsplash.com/photo-1537204696486-967f1b7198c8?q=80&w=800&auto=format&fit=crop',
            startDate: new Date(nextMonth.setHours(6, 0, 0, 0)),
            endDate: new Date(nextMonth.setHours(10, 0, 0, 0)),
            locationName: 'Công viên Yên Sở',
            address: 'Hoàng Mai, Hà Nội',
            latitude: 20.955091,
            longitude: 105.868285,
            interestedCount: 840,
            organizerId: createdOrganizers[1].id,
            images: {
                create: [
                    { url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1504595403659-9088ce801e29?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1517423568366-8b83523034fd?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1546975490-a79ee8ebfb72?q=80&w=300&auto=format&fit=crop' }
                ]
            }
        }
    });
    await prisma.event.create({
        data: {
            title: 'Morning Yoga with Cats',
            category: 'Health',
            description: 'Start your morning with a relaxing yoga session surrounded by our adorable rescue cats. A perfect way to find your zen and maybe find a new furry family member.',
            bannerUrl: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?q=80&w=800&auto=format&fit=crop',
            startDate: new Date(nextMonth.setHours(8, 0, 0, 0)),
            endDate: new Date(nextMonth.setHours(10, 0, 0, 0)),
            locationName: 'Central Park, NY',
            address: 'Central Park West, New York, NY',
            latitude: 40.785091,
            longitude: -73.968285,
            interestedCount: 128,
            organizerId: createdOrganizers[2].id,
            images: {
                create: [
                    { url: 'https://images.unsplash.com/photo-1596492784531-6e6eb5ea92b5?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1511044568932-338cba0ad803?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1501820488136-72669149e0d4?q=80&w=300&auto=format&fit=crop' }
                ]
            }
        }
    });
    await prisma.event.create({
        data: {
            title: 'Puppy Socialization Hour',
            category: 'Training',
            description: 'Bring your puppies for a fun, safe, and supervised socialization hour. This helps them build confidence and learn how to interact properly with other dogs.',
            bannerUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800&auto=format&fit=crop',
            startDate: new Date(nextMonth.setHours(15, 0, 0, 0)),
            endDate: new Date(nextMonth.setHours(17, 0, 0, 0)),
            locationName: 'City Pet Center',
            address: '456 Pet Avenue, Los Angeles, CA',
            latitude: 34.052235,
            longitude: -118.243683,
            interestedCount: 340,
            organizerId: createdOrganizers[3].id,
            images: {
                create: [
                    { url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1544568100-847a948585b9?q=80&w=300&auto=format&fit=crop' },
                    { url: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?q=80&w=300&auto=format&fit=crop' }
                ]
            }
        }
    });
    console.log('Đã tạo xong dữ liệu Organizer và Event mẫu với đầy đủ Gallery ảnh!');
}
main()
    .catch((e) => {
    console.error('Lỗi khi seed organizer:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-organizer.js.map