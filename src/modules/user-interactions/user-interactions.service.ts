import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SwipeAction } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from 'src/database/redis/redis.service';

// Added `!` to fix TS2564 error
export class ShareLocationDto {
  petId!: string;
  lat!: number;
  lng!: number;
  radius!: number; // Sent from Frontend to put into push notification (Deeplink)
  scannedBy?: string;
  phoneNumber?: string;
  message?: string;
}

@Injectable()
export class UserInteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService,
  ) { }

  async shareLocation(dto: ShareLocationDto) {
    // A. Get corresponding tagId for petId because TagReport requires tagId
    const tag = await this.prisma.tag.findFirst({
      where: { petId: dto.petId },
      select: { id: true }
    });

    if (!tag) {
      throw new NotFoundException('No Tag (collar) found attached to this pet');
    }

    // 1. Save location to database (Removed petId, radius, scannerId to match DB)
    const savedReport = await this.prisma.tagReport.create({
      data: {
        tagId: tag.id,            // FIX: Use tagId instead of petId
        latitude: dto.lat,
        longitude: dto.lng,
        radius: dto.radius,
        scannedBy: dto.scannedBy, // Frontend: Scanner name (Sarah John)
        phoneNumber: dto.phoneNumber,
        message: dto.message,
        // radius: Your DB doesn't have a table to save this data, so only use for Notification below
      }
    });

    // 2. Find pet owner
    const petOwnerId = await this.getPetOwnerId(dto.petId);

    // 3. Send Push Notification to pet owner
    const notificationPayload = {
      title: 'Your pet\'s location has been shared!',
      body: dto.message ? `Message: ${dto.message}` : 'Someone just updated the pet\'s location.',
      referenceId: savedReport.id,
      data: {
        type: 'SHARED_LOCATION',
        // Even though saved to DB, still pass params to url in case frontend reads from params for speed
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
      throw new NotFoundException('Pet or owner information not found');
    }

    return pet.ownerId;
  }

  // 1. Swipe function (Like/Pass)
  async swipePet(userId: string, petId: string, action: SwipeAction) {
    const existing = await this.prisma.petInteraction.findUnique({
      where: { userId_petId: { userId, petId } }
    });

    if (existing) {
      throw new ConflictException('Already interacted with this pet');
    }

    return this.prisma.petInteraction.create({
      data: { userId, petId, action }
    });
  }

  // 2. Add/Remove Favorite function
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

  // 3. Follow Shelter function
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

  // Thêm vào user-interactions.service.ts
  async handleReportAndBlock(
    reporterId: string,
    petId: string,
    reason: string,
    details?: string,
    isBlockRequested?: boolean,
    blockScope: 'pet' | 'owner' | 'shelter' = 'pet', // mặc định CHỈ ẩn pet này
  ) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { ownerId: true, shelterId: true },
    });

    if (!pet) throw new NotFoundException('Pet not found');

    if ((pet.ownerId && reporterId === pet.ownerId) || (pet.shelterId && reporterId === pet.shelterId)) {
      throw new BadRequestException('Bạn không thể tự báo cáo hoặc chặn nội dung của chính mình.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Luôn tạo report — bản ghi này CHÍNH LÀ "per-pet block record" luôn,
      // không cần model UserBlockedPet riêng.
      const report = await tx.contentReport.create({
        data: { reporterId, targetPetId: petId, reason, details },
      });

      let blockRecord: any = null;

      // Chỉ cascade lên owner/shelter khi UI thực sự yêu cầu (ví dụ nút riêng
      // "Chặn cả trạm cứu trợ này"), KHÔNG mặc định khi user chỉ chặn 1 pet.
      if (isBlockRequested) {
        if (blockScope === 'owner' && pet.ownerId) {
          blockRecord = await tx.userBlock.upsert({
            where: { blockerId_blockedId: { blockerId: reporterId, blockedId: pet.ownerId } },
            update: {},
            create: { blockerId: reporterId, blockedId: pet.ownerId },
          });
        }

        if (blockScope === 'shelter' && pet.shelterId) {
          blockRecord = await tx.userBlockedShelter.upsert({
            where: { userId_shelterId: { userId: reporterId, shelterId: pet.shelterId } },
            update: {},
            create: { userId: reporterId, shelterId: pet.shelterId },
          });
        }
        // blockScope === 'pet' → không tạo gì thêm, report ở trên đã là đủ tín hiệu
      }

      return { report, blockRecord };
    });
  }


  async reportAndHideTagReport(
    reporterId: string,
    tagReportId: string,
    reason: string,
    details?: string,
    isHideRequested?: boolean,
    isBlockRequested?: boolean,
  ) {
    const tagReport = await this.prisma.tagReport.findUnique({
      where: { id: tagReportId },
      include: { tag: { select: { pet: { select: { id: true, ownerId: true } } } } }, // 👈 thêm id
    });
    if (!tagReport) throw new NotFoundException('Scan report not found');

    const ownerId = tagReport.tag?.pet?.ownerId;
    const petId = tagReport.tag?.pet?.id; // 👈 cần để invalidate cache
    if (ownerId && reporterId !== ownerId) {
      throw new BadRequestException('Only the pet owner can moderate this content');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const report = await tx.contentReport.create({
        data: { reporterId, targetTagReportId: tagReportId, reason, details },
      });

      let hiddenResult: { id: string; isHidden: boolean; hiddenAt: Date | null } | null = null;
      if (isHideRequested) {
        hiddenResult = await tx.tagReport.update({
          where: { id: tagReportId },
          data: { isHidden: true, hiddenAt: new Date() },
          select: { id: true, isHidden: true, hiddenAt: true },
        });
      }

      let blockRecord: any = null;
      if (isBlockRequested && tagReport.phoneNumber) {
        const blockedUser = await tx.user.findFirst({
          where: { phone: tagReport.phoneNumber },
          select: { id: true },
        });
        if (blockedUser) {
          blockRecord = await tx.userBlock.upsert({
            where: { blockerId_blockedId: { blockerId: reporterId, blockedId: blockedUser.id } },
            update: {},
            create: { blockerId: reporterId, blockedId: blockedUser.id },
          });
        }
      }

      return { report, tagReport: hiddenResult ?? tagReport, blockRecord };
    });

    // 🔑 Phần đang thiếu — invalidate cache pet detail sau khi hide
    if (petId && isHideRequested) {
      await this.redisService.del(`pet:detail:${petId}`);
    }

    return result;
  }
}