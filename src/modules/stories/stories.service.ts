import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateStoryDto } from './dto/story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}

  // 1. Lấy danh sách kèm số lượng like và trạng thái isLiked của user hiện tại
  async findAll(currentUserId?: string) {
    const stories = await this.prisma.story.findMany({
      orderBy: { date: 'asc' },
      include: {
        _count: {
          select: { likes: true },
        },
        ...(currentUserId && {
          likes: {
            where: { userId: currentUserId },
            select: { id: true },
          },
        }),
      },
    });

    return stories.map((story) => {
      const { _count, likes, ...rest } = story as any;
      return {
        ...rest,
        likes: _count?.likes ?? 0,
        isLiked: Boolean(likes && likes.length > 0),
      };
    });
  }

  // 2. Toggle Like (nếu đã like thì bỏ like, chưa like thì tạo like)
  async toggleLike(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Câu chuyện không tồn tại');

    const existingLike = await this.prisma.storyLike.findUnique({
      where: {
        storyId_userId: { storyId, userId },
      },
    });

    let isLiked = false;

    if (existingLike) {
      // Đã like -> Xoá like
      await this.prisma.storyLike.delete({
        where: { id: existingLike.id },
      });
      isLiked = false;
    } else {
      // Chưa like -> Tạo like
      await this.prisma.storyLike.create({
        data: { storyId, userId },
      });
      isLiked = true;
    }

    // Đếm lại tổng số like mới nhất
    const totalLikes = await this.prisma.storyLike.count({
      where: { storyId },
    });

    return {
      isLiked,
      likes: totalLikes,
    };
  }

  async create(dto: CreateStoryDto) {
    return this.prisma.story.create({
      data: {
        id: dto.id,
        avatar: dto.avatar ?? '',
        title: dto.title as unknown as Prisma.InputJsonValue,
        subtitle: dto.subtitle as unknown as Prisma.InputJsonValue,
        content: dto.content as unknown as Prisma.InputJsonValue,
        fullContent: dto.fullContent as unknown as Prisma.InputJsonValue,
        quote: dto.quote as unknown as Prisma.InputJsonValue,
        afterQuote: dto.afterQuote as unknown as Prisma.InputJsonValue,
        date: new Date(dto.date),
        images: dto.images as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateStoryDto) {
    const exists = await this.prisma.story.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Câu chuyện không tồn tại');

    return this.prisma.story.update({
      where: { id },
      data: {
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.title !== undefined && {
          title: dto.title as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.subtitle !== undefined && {
          subtitle: dto.subtitle as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.content !== undefined && {
          content: dto.content as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.fullContent !== undefined && {
          fullContent: dto.fullContent as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.quote !== undefined && {
          quote: dto.quote as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.afterQuote !== undefined && {
          afterQuote: dto.afterQuote as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.images !== undefined && {
          images: dto.images as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.story.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Câu chuyện không tồn tại');

    return this.prisma.story.delete({ where: { id } });
  }
}