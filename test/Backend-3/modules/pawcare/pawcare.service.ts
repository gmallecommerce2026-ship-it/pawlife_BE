import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class PawcareService {
  constructor(private prisma: PrismaService) {}

  async getVideosByCategory(category: string) {
    return this.prisma.pawcareVideo.findMany({
      where: { category },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlaylistsByCategory(category: string) {
    const playlists = await this.prisma.pawcarePlaylist.findMany({
      where: { category },
      include: {
        videos: true, // Lấy luôn danh sách video trong playlist
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map lại data để đếm số lượng video trả về cho Frontend
    return playlists.map(pl => ({
      ...pl,
      count: pl.videos.length,
    }));
  }
}