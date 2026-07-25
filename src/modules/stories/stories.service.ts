import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateStoryDto } from './dto/story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    // Sắp xếp theo ngày của câu chuyện (tăng dần) để carousel hiển thị
    // đúng thứ tự "hành trình" — đổi thành createdAt/desc nếu bạn muốn
    // hiển thị theo thứ tự thêm mới thay vì theo ngày.
    return this.prisma.story.findMany({
      orderBy: { date: 'asc' },
    });
  }

  async create(dto: CreateStoryDto) {
    return this.prisma.story.create({
      data: {
        id: dto.id,
        avatar: dto.avatar ?? '',
        title: dto.title,
        subtitle: dto.subtitle,
        content: dto.content,
        fullContent: dto.fullContent,
        quote: dto.quote,
        afterQuote: dto.afterQuote,
        date: new Date(dto.date),
        images: dto.images,
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
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.fullContent !== undefined && { fullContent: dto.fullContent }),
        ...(dto.quote !== undefined && { quote: dto.quote }),
        ...(dto.afterQuote !== undefined && { afterQuote: dto.afterQuote }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.images !== undefined && { images: dto.images }),
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.story.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Câu chuyện không tồn tại');

    return this.prisma.story.delete({ where: { id } });
  }
}