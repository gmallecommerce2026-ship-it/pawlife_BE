// src/modules/ingredients/ingredients.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ingredient.findMany({
      orderBy: { createdAt: 'desc' } // Sắp xếp hiển thị mới nhất lên đầu
    });
  }

  // Sử dụng Prisma.IngredientCreateInput để tự động khớp với schema hiện tại
  async create(data: Prisma.IngredientCreateInput | any) {
    return this.prisma.ingredient.create({ data });
  }

  // Sử dụng Prisma.IngredientUpdateInput cho update
  async update(id: string, data: Prisma.IngredientUpdateInput | any) {
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