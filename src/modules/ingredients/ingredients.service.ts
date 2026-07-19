import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ingredient.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(data: { name: string; description?: string; imageUrl?: string }) {
    return this.prisma.ingredient.create({ data });
  }

  async update(id: string, data: { name?: string; description?: string; imageUrl?: string }) {
    const exists = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ingredient không tồn tại');

    return this.prisma.ingredient.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ingredient không tồn tại');

    return this.prisma.ingredient.delete({ where: { id } });
  }
}