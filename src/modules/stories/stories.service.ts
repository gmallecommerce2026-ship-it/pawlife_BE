import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateStoryDto } from './dto/story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.story.findMany({
      orderBy: { date: 'asc' },
    });
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