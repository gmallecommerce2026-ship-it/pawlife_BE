// src/modules/pawcare/pawcare.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';

@Injectable()
export class PawcareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService // Inject thêm RedisService
  ) {}

  async getVideosByCategory(category: string) {
    // 1. Khai báo key duy nhất cho cache
    const cacheKey = `pawcare:videos:${category}`;
    
    // 2. Kiểm tra dữ liệu trong Redis
    const cachedVideos = await this.redisService.get<any[]>(cacheKey);
    if (cachedVideos) {
      return cachedVideos; // Trả về ngay lập tức nếu có cache
    }

    // 3. Nếu chưa có cache, lấy từ DB
    const videos = await this.prisma.pawcareVideo.findMany({
      where: { category },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Lưu vào Redis với TTL là 1 giờ (3600 giây) để tránh query DB nhiều lần
    await this.redisService.set(cacheKey, videos, 3600);

    return videos;
  }

  async getPlaylistsByCategory(category: string) {
    const cacheKey = `pawcare:playlists:${category}`;
    
    // 1. Kiểm tra dữ liệu trong Redis
    const cachedPlaylists = await this.redisService.get<any[]>(cacheKey);
    if (cachedPlaylists) {
      return cachedPlaylists;
    }

    // 2. Nếu chưa có cache, query DB như cũ
    const playlists = await this.prisma.pawcarePlaylist.findMany({
      where: { category },
      include: {
        videos: true, 
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Xử lý map data đếm số lượng video
    const formattedPlaylists = playlists.map(pl => ({
      ...pl,
      count: pl.videos.length,
    }));

    // 4. Lưu toàn bộ kết quả ĐÃ FORMAT vào Redis (TTL 1 giờ)
    // Việc này giúp tiết kiệm luôn cả thời gian chạy vòng lặp .map() cho các request sau
    await this.redisService.set(cacheKey, formattedPlaylists, 3600);

    return formattedPlaylists;
  }
}