import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Pawcare Data...');

  // Danh mục: Training
  const trainingPlaylist = await prisma.pawcarePlaylist.create({
    data: {
      title: 'Puppy Training Basics',
      thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=600',
      category: 'Training',
      videos: {
        create: [
          { title: 'Sit, Stay, Come: Basic Commands', views: '2.1M', time: '5 days ago', duration: '15:20', thumbnail: 'https://images.unsplash.com/photo-1544367563-12123d8965cd?q=80&w=600', category: 'Training', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
          { title: 'Leash Walking Guide', views: '1.8M', time: '1 week ago', duration: '28:33', thumbnail: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?q=80&w=600', category: 'Training', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
        ]
      }
    }
  });

  // Danh mục: Nutrition
  const nutritionPlaylist = await prisma.pawcarePlaylist.create({
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

  // Tạo thêm một số video rời (không thuộc playlist)
  await prisma.pawcareVideo.createMany({
    data: [
      { title: 'At-home Dog Grooming (Beauty)', views: '800K', time: '3 days ago', duration: '22:10', thumbnail: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?q=80&w=600', category: 'Beauty', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
      { title: 'Cat Vaccination Schedule (Health)', views: '300K', time: '2 months ago', duration: '05:30', thumbnail: 'https://images.unsplash.com/photo-1606425271394-c3ca95b6c58e?q=80&w=600', category: 'Health', url: 'https://www.youtube.com/watch?v=jFMA5ggFsXU' },
    ]
  });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });