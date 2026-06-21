/**
 * scripts/fetch-youtube-metadata.ts
 *
 * Lấy metadata THẬT từ YouTube Data API v3 cho toàn bộ video khai báo trong
 * `prisma/seed-data/sources.ts`, ghi kết quả ra `prisma/seed-data/metadata.json`.
 *
 * VÌ SAO CẦN SCRIPT NÀY THAY VÌ HARDCODE TRỰC TIẾP VÀO SEED:
 *   - views/time là dữ liệu sống, thay đổi từng giờ -> hardcode sẽ lỗi thời
 *     ngay sau khi seed chạy lần đầu.
 *   - title/duration cần chính xác 100%, không nên lấy từ nguồn không đáng tin.
 *   - Tách "fetch dữ liệu" khỏi "seed DB" giúp re-run đồng bộ định kỳ (cron/CI)
 *     mà không phải sửa code seed.
 *
 * CÁCH DÙNG:
 *   1. Tạo API key miễn phí tại https://console.cloud.google.com/apis/credentials
 *      -> bật "YouTube Data API v3" cho project -> Create Credentials -> API key.
 *   2. Thêm vào file .env ở root project:
 *        YOUTUBE_API_KEY=xxxxxxxxxxxxxxxxxxxx
 *   3. Chạy:
 *        npx ts-node -r dotenv/config scripts/fetch-youtube-metadata.ts
 *      (hoặc thêm script vào package.json:
 *        "fetch:youtube": "ts-node -r dotenv/config scripts/fetch-youtube-metadata.ts")
 *   4. Sau khi chạy xong sẽ có file prisma/seed-data/metadata.json
 *      -> chạy `npx prisma db seed` như bình thường.
 *
 * QUOTA: mỗi video tốn 1 unit, quota free 10.000 unit/ngày/project -> dư dùng.
 * Yêu cầu Node >= 18 (dùng fetch() built-in).
 */

import * as fs from 'fs';
import * as path from 'path';
import { PAWCARE_SOURCES } from '../prisma/seed-data/sources';

const API_KEY = process.env.YOUTUBE_API_KEY;
const OUTPUT_PATH = path.join(__dirname, '../prisma/seed-data/metadata.json');

interface VideoMetadata {
  title: string;
  views: string;
  time: string;
  duration: string;
  thumbnail: string;
  fetchedAt: string;
}

type MetadataMap = Record<string, VideoMetadata>;

function formatViews(viewCount: string): string {
  const n = Number(viewCount);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

// PT#H#M#S (ISO 8601) -> "12:45" hoặc "1:05:20"
function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = Number(match?.[1] || 0);
  const m = Number(match?.[2] || 0);
  const s = Number(match?.[3] || 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatRelativeTime(publishedAt: string): string {
  const diffDays = Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86_400_000);
  if (diffDays < 1) return 'Hôm nay';
  if (diffDays < 30) return `${diffDays} ngày trước`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} tháng trước`;
  return `${Math.floor(diffMonths / 12)} năm trước`;
}

function bestThumbnail(thumbnails: any, videoId: string): string {
  return (
    thumbnails?.maxres?.url ||
    thumbnails?.standard?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  );
}

async function fetchBatch(ids: string[]): Promise<MetadataMap> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${ids.join(',')}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const now = new Date().toISOString();
  const result: MetadataMap = {};
  for (const item of data.items ?? []) {
    result[item.id] = {
      title: item.snippet.title,
      views: formatViews(item.statistics?.viewCount ?? '0'),
      time: formatRelativeTime(item.snippet.publishedAt),
      duration: formatDuration(item.contentDetails.duration),
      thumbnail: bestThumbnail(item.snippet.thumbnails, item.id),
      fetchedAt: now,
    };
  }
  return result;
}

function writePlaceholders(ids: string[]) {
  const now = new Date().toISOString();
  const fallback: MetadataMap = {};
  for (const id of ids) {
    fallback[id] = {
      title: '(Chưa đồng bộ — cần YOUTUBE_API_KEY)',
      views: '—',
      time: '—',
      duration: '00:00',
      thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      fetchedAt: now,
    };
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fallback, null, 2));
  console.log(`⚠️  Không có YOUTUBE_API_KEY -> đã ghi placeholder vào ${OUTPUT_PATH}`);
  console.log('    Thumbnail vẫn là ảnh thật từ YouTube (CDN công khai, không cần API key).');
  console.log('    Title/views/duration sẽ là placeholder cho tới khi có API key.');
}

async function main() {
  const allIds = Array.from(
    new Set(PAWCARE_SOURCES.flatMap((p) => p.videos.map((v) => v.videoId))),
  );

  if (!API_KEY) {
    writePlaceholders(allIds);
    return;
  }

  console.log(`Đang lấy metadata cho ${allIds.length} video từ YouTube Data API...`);
  const merged: MetadataMap = {};
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    Object.assign(merged, await fetchBatch(batch));
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2));
  console.log(`✅ Đã lưu metadata của ${Object.keys(merged).length} video vào ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('❌ Lỗi khi fetch metadata YouTube:', err);
  process.exit(1);
});