import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SwipeAction } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

// Đã thêm dấu `!` để fix lỗi TS2564
export class ShareLocationDto {
  petId!: string;
  lat!: number;
  lng!: number;
  radius!: number; // Gửi lên từ Frontend để nhét vào push notification (Deeplink)
  scannedBy?: string;
  phoneNumber?: string;
  message?: string;
}

@Injectable()
export class UserInteractionsService {
  constructor(
    private readonly prisma: PrismaService, 
    private readonly notificationsService: NotificationsService
  ) {}

  async shareLocation(dto: ShareLocationDto) {
    // A. Lấy tagId tương ứng với petId vì TagReport yêu cầu tagId
    const tag = await this.prisma.tag.findFirst({
      where: { petId: dto.petId },
      select: { id: true }
    });

    if (!tag) {
      throw new NotFoundException('Không tìm thấy Tag (vòng cổ) nào được gắn với thú cưng này');
    }

    // 1. Lưu location vào database (Đã loại bỏ petId, radius, scannerId cho khớp với DB)
    const savedReport = await this.prisma.tagReport.create({
      data: {
        tagId: tag.id,            // SỬA: Dùng tagId thay vì petId
        latitude: dto.lat,
        longitude: dto.lng,
        scannedBy: dto.scannedBy, // Frontend: Tên người quét (Sarah John)
        phoneNumber: dto.phoneNumber,
        message: dto.message,
        // radius: Dữ liệu này DB bạn không có bảng để lưu, nên chỉ dùng cho Notification ở dưới
      }
    });

    // 2. Tìm chủ của thú cưng
    const petOwnerId = await this.getPetOwnerId(dto.petId);

    // 3. Gửi Push Notification tới chủ thú cưng
    const notificationPayload = {
      title: 'Vị trí thú cưng của bạn đã được chia sẻ!',
      body: dto.message ? `Lời nhắn: ${dto.message}` : 'Một người nào đó vừa cập nhật vị trí của thú cưng.',
      referenceId: savedReport.id, // BẮT BUỘC THÊM DÒNG NÀY (Đóng vai trò là cầu nối)
      data: {
        type: 'SHARED_LOCATION',
        url: `/tag-report-detail?reportId=${savedReport.id}&lat=${dto.lat}&lng=${dto.lng}&radius=${dto.radius}`, 
      },
    };

    if (petOwnerId) {
      await this.notificationsService.sendPushNotification(petOwnerId, notificationPayload);
    }
    
    return savedReport;
  }

  private async getPetOwnerId(petId: string): Promise<string> {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { ownerId: true },
    });

    if (!pet || !pet.ownerId) {
      throw new NotFoundException('Không tìm thấy thông tin thú cưng hoặc chủ sở hữu');
    }

    return pet.ownerId;
  }

  // 1. Chức năng Quẹt (Like/Pass)
  async swipePet(userId: string, petId: string, action: SwipeAction) {
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
      await this.prisma.favoritePet.delete({
        where: { id: existing.id }
      });
      return { favorited: false };
    } else {
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