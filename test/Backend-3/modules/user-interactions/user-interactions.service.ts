import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SwipeAction } from '@prisma/client';

@Injectable()
export class UserInteractionsService {
  constructor(private prisma: PrismaService) {}

  // 1. Chức năng Quẹt (Like/Pass)
  async swipePet(userId: string, petId: string, action: SwipeAction) {
    // Kiểm tra xem đã quẹt chưa để tránh lỗi Unique constraint
    const existing = await this.prisma.petInteraction.findUnique({
      where: { userId_petId: { userId, petId } }
    });

    if (existing) {
      throw new ConflictException('Đã tương tác với thú cưng này');
    }

    return this.prisma.petInteraction.create({
      data: { userId, petId, action }
    });
  }

  // 2. Chức năng Thêm/Xóa Yêu thích
  async toggleFavorite(userId: string, petId: string) {
    const existing = await this.prisma.favoritePet.findUnique({
      where: { userId_petId: { userId, petId } }
    });

    if (existing) {
      // Nếu đã yêu thích thì xóa (Unlike)
      await this.prisma.favoritePet.delete({
        where: { id: existing.id }
      });
      return { favorited: false };
    } else {
      // Nếu chưa thì thêm vào (Like)
      await this.prisma.favoritePet.create({
        data: { userId, petId }
      });
      return { favorited: true };
    }
  }

  // 3. Chức năng Theo dõi Trạm cứu hộ
  async toggleFollowShelter(userId: string, shelterId: string) {
    const existing = await this.prisma.followedShelter.findUnique({
      where: { userId_shelterId: { userId, shelterId } }
    });

    if (existing) {
      await this.prisma.followedShelter.delete({
        where: { id: existing.id }
      });
      return { followed: false };
    } else {
      await this.prisma.followedShelter.create({
        data: { userId, shelterId }
      });
      return { followed: true };
    }
  }
}