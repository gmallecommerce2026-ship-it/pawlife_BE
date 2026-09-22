// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PAWCARE_SOURCES } from './seed-data/sources';

const prisma = new PrismaClient();

interface VideoMetadata {
  title: string;
  views: string;
  time: string;
  duration: string;
  thumbnail: string;
  fetchedAt?: string;
}

const METADATA_PATH = path.join(__dirname, 'seed-data/metadata.json');

function loadMetadata(): Record<string, VideoMetadata> {
  if (!fs.existsSync(METADATA_PATH)) {
    console.warn(
      '⚠️  Không tìm thấy prisma/seed-data/metadata.json.\n' +
        '    Chạy "npx ts-node -r dotenv/config scripts/fetch-youtube-metadata.ts" trước\n' +
        '    để lấy dữ liệu thật từ YouTube. Seed sẽ tạm dùng placeholder.',
    );
    return {};
  }
  return JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
}

function placeholder(videoId: string): VideoMetadata {
  return {
    title: `(Video ${videoId} — chưa đồng bộ)`,
    views: '—',
    time: '—',
    duration: '00:00',
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

async function main() {
  const metadata = loadMetadata();

  console.log('Bắt đầu dọn dẹp dữ liệu Pawcare cũ...');
  await prisma.pawcareVideo.deleteMany();
  await prisma.pawcarePlaylist.deleteMany();

  console.log('Seeding Pawcare Data từ YouTube...');

  for (const playlist of PAWCARE_SOURCES) {
    const videos = playlist.videos.map(({ videoId }) => {
      const meta = metadata[videoId] ?? placeholder(videoId);
      return {
        title: meta.title,
        views: meta.views,
        time: meta.time,
        duration: meta.duration,
        thumbnail: meta.thumbnail,
        category: playlist.category,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    });

    await prisma.pawcarePlaylist.create({
      data: {
        title: playlist.title,
        thumbnail: videos[0]?.thumbnail ?? '',
        category: playlist.category,
        videos: { create: videos },
      },
    });

    console.log(`  ✓ ${playlist.title} (${videos.length} video)`);
  }

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