// src/modules/ingredients/ingredients.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';

// Các field kiểu Json? (nullable) trong model Ingredient.
// Khi FE gửi lên giá trị null cho các field này (VD: đổi badge sang 'safe'
// thì actionGuide/details phải bị xoá), Prisma KHÔNG chấp nhận JS `null` trần
// cho cột Json? — cần map sang Prisma.DbNull thì DB mới thực sự lưu NULL.
// Nếu không map, Prisma sẽ throw lỗi hoặc field cũ không được xoá đi.
const JSON_NULLABLE_FIELDS = ['actionGuide', 'details', 'benefits'] as const;

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ingredient.findMany({
      orderBy: { createdAt: 'desc' }, // Sắp xếp hiển thị mới nhất lên đầu
    });
  }

  /**
   * Chuẩn hoá payload trước khi ghi xuống DB:
   * - Field nào là Json? mà FE gửi lên `null` → đổi thành Prisma.DbNull
   *   để Prisma thực sự set NULL trong cột (thay vì throw lỗi hoặc bỏ qua).
   */
  private normalizeJsonNulls<T extends Record<string, any>>(data: T): T {
    const result: Record<string, any> = { ...data };
    for (const field of JSON_NULLABLE_FIELDS) {
      if (result[field] === null) {
        result[field] = Prisma.DbNull;
      }
    }
    return result as T;
  }

  // Sử dụng Prisma.IngredientCreateInput để tự động khớp với schema hiện tại
  async create(data: Prisma.IngredientCreateInput | any) {
    return this.prisma.ingredient.create({
      data: this.normalizeJsonNulls(data),
    });
  }

  // Sử dụng Prisma.IngredientUpdateInput cho update
  async update(id: string, data: Prisma.IngredientUpdateInput | any) {
    const exists = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ingredient không tồn tại');

    // FE gửi payload có kèm cả field `id` (vì payload dùng chung cho cả
    // POST và PATCH). Bỏ `id` ra khỏi data update để tránh mọi rủi ro
    // xung đột giữa `where.id` và `data.id` trên MySQL.
    const { id: _omitId, ...rest } = data ?? {};

    return this.prisma.ingredient.update({
      where: { id },
      data: this.normalizeJsonNulls(rest),
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ingredient không tồn tại');

    return this.prisma.ingredient.delete({ where: { id } });
  }
}