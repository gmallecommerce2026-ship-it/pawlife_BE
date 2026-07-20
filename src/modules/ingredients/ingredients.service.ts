// src/modules/ingredients/ingredients.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { applyBadgeDefaults, Badge } from './ingredient-defaults';

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ingredient.findMany({
      orderBy: { createdAt: 'desc' }, // Sắp xếp hiển thị mới nhất lên đầu
    });
  }

  async create(data: Prisma.IngredientCreateInput | any) {
    const badge = (data.badge ?? 'safe') as Badge;

    // Merge nội dung FE gửi lên với default theo badge (xem ingredient-defaults.ts):
    // field nào admin đã gõ nội dung thật -> giữ nguyên; field nào để trống -> auto theo badge.
    const merged = {
      ...data,
      ...applyBadgeDefaults(badge, {
        actionGuide: data.actionGuide,
        details: data.details,
        benefits: data.benefits,
      }),
    };

    return this.prisma.ingredient.create({ data: merged });
  }

  async update(id: string, data: Prisma.IngredientUpdateInput | any) {
    const exists = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ingredient không tồn tại');

    // Bỏ field `id` dư thừa (FE dùng chung payload cho cả create và update)
    const { id: _omitId, ...rest } = data ?? {};

    // Badge hiệu lực: ưu tiên badge mới gửi lên, fallback badge hiện có trong DB
    const badge = (rest.badge ?? (exists as any).badge ?? 'safe') as Badge;

    const merged = {
      ...rest,
      ...applyBadgeDefaults(badge, {
        actionGuide: rest.actionGuide,
        details: rest.details,
        benefits: rest.benefits,
      }),
    };

    return this.prisma.ingredient.update({ where: { id }, data: merged });
  }

  async remove(id: string) {
    const exists = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ingredient không tồn tại');

    return this.prisma.ingredient.delete({ where: { id } });
  }
}