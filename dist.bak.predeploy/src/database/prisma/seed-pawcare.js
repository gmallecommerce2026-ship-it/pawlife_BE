"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Bắt đầu dọn dẹp dữ liệu Pawcare cũ...');
    await prisma.pawcareVideo.deleteMany();
    await prisma.pawcarePlaylist.deleteMany();
    console.log('Seeding Pawcare Data...');
    await prisma.pawcarePlaylist.create({
        data: {
            title: 'Puppy Training Basics',
            thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=600',
            category: 'Training',
            videos: {
                create: [
                    { title: 'Sit, Stay, Come: Basic Commands', views: '2.1M', time: '5 days ago', duration: '15:20', thumbnail: 'https://images.unsplash.com/photo-1544367563-12123d8965cd?q=80&w=600', category: 'Training', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                    { title: 'Leash Walking Guide (No Pulling)', views: '1.8M', time: '1 week ago', duration: '28:33', thumbnail: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?q=80&w=600', category: 'Training', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                    { title: 'Potty Training in 7 Days', views: '3.5M', time: '2 weeks ago', duration: '12:45', thumbnail: 'https://images.unsplash.com/photo-1591561582301-7ce6588cc286?q=80&w=600', category: 'Training', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                ]
            }
        }
    });
    await prisma.pawcarePlaylist.create({
        data: {
            title: 'Advanced Dog Tricks',
            thumbnail: 'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=600',
            category: 'Training',
            videos: {
                create: [
                    { title: 'Teach Your Dog to Play Dead', views: '850K', time: '1 month ago', duration: '08:15', thumbnail: 'https://images.unsplash.com/photo-1537151608804-ea6f11840833?q=80&w=600', category: 'Training', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                    { title: 'High Five and Wave Hello', views: '1.1M', time: '3 weeks ago', duration: '06:20', thumbnail: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=600', category: 'Training', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                ]
            }
        }
    });
    await prisma.pawcarePlaylist.create({
        data: {
            title: 'Healthy Raw Diet Guide',
            thumbnail: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=600',
            category: 'Nutrition',
            videos: {
                create: [
                    { title: 'Best Dry Foods for Large Breeds', views: '500K', time: '1 month ago', duration: '10:05', thumbnail: 'https://images.unsplash.com/photo-1589924691995-400dc9ce8078?q=80&w=600', category: 'Nutrition', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                    { title: 'How much should your cat eat?', views: '1.2M', time: '2 weeks ago', duration: '08:45', thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=600', category: 'Nutrition', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                ]
            }
        }
    });
    await prisma.pawcarePlaylist.create({
        data: {
            title: 'Homemade Pet Food Recipes',
            thumbnail: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=600',
            category: 'Nutrition',
            videos: {
                create: [
                    { title: 'Chicken & Rice for Upset Stomachs', views: '2.5M', time: '3 months ago', duration: '05:50', thumbnail: 'https://images.unsplash.com/photo-1623366302587-bca9810bb3a8?q=80&w=600', category: 'Nutrition', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                    { title: 'Healthy Pumpkin Dog Treats', views: '900K', time: '4 months ago', duration: '07:12', thumbnail: 'https://images.unsplash.com/photo-1582798358481-d199fb7347bb?q=80&w=600', category: 'Nutrition', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                ]
            }
        }
    });
    await prisma.pawcarePlaylist.create({
        data: {
            title: 'Daily Pet Health Check',
            thumbnail: 'https://images.unsplash.com/photo-1606425271394-c3ca95b6c58e?q=80&w=600',
            category: 'Health',
            videos: {
                create: [
                    { title: 'Cat Vaccination Schedule Explained', views: '300K', time: '2 months ago', duration: '05:30', thumbnail: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?q=80&w=600', category: 'Health', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                    { title: 'How to Check Your Dog’s Vitals at Home', views: '450K', time: '1 month ago', duration: '11:20', thumbnail: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?q=80&w=600', category: 'Health', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                    { title: 'Signs of Dehydration in Pets', views: '620K', time: '3 weeks ago', duration: '04:15', thumbnail: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=600', category: 'Health', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                ]
            }
        }
    });
    await prisma.pawcarePlaylist.create({
        data: {
            title: 'Grooming Masterclass',
            thumbnail: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?q=80&w=600',
            category: 'Beauty',
            videos: {
                create: [
                    { title: 'At-home Dog Grooming Basics', views: '800K', time: '3 days ago', duration: '22:10', thumbnail: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=600', category: 'Beauty', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                    { title: 'How to Trim Cat Claws Safely', views: '1.5M', time: '2 weeks ago', duration: '08:40', thumbnail: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?q=80&w=600', category: 'Beauty', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                    { title: 'Bathing a Big Dog: Tips & Tricks', views: '2.2M', time: '1 month ago', duration: '14:05', thumbnail: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=600', category: 'Beauty', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
                ]
            }
        }
    });
    await prisma.pawcareVideo.createMany({
        data: [
            { title: 'Quick Tip: Stop Dog Barking at Door', views: '120K', time: '1 day ago', duration: '03:15', thumbnail: 'https://images.unsplash.com/photo-1554692916-2fb9dfa8fa5b?q=80&w=600', category: 'Training', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
            { title: 'Top 5 Toxic Human Foods for Pets', views: '890K', time: '5 months ago', duration: '06:45', thumbnail: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=600', category: 'Nutrition', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
            { title: 'Flea and Tick Prevention Tips', views: '340K', time: '2 weeks ago', duration: '09:30', thumbnail: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?q=80&w=600', category: 'Health', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
            { title: 'Dealing with Shedding Season', views: '550K', time: '1 month ago', duration: '10:00', thumbnail: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?q=80&w=600', category: 'Beauty', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' }
        ]
    });
    console.log('Seeding Pawcare completed!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-pawcare.js.map