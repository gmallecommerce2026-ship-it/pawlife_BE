import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GetNotificationsDto, CreateNotificationDto } from './dto/notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType } from '@prisma/client';

export interface PushNotificationPayload {
  title: string;
  body: string;
  referenceId?: string;
  data?: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) { }

  async createAndSendNotification(data: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        type: data.type,
        referenceId: data.referenceId,
        metadata: data.metadata || {},
        isRead: false,
      },
    });

    this.notificationsGateway.sendNotificationToUser(data.userId, notification);
    return notification;
  }

  /**
   * type cho phép truyền vào để không bị "khoá cứng" vào TAG_SCANNED như trước.
   * Mặc định vẫn là TAG_SCANNED để không phá vỡ những nơi đang gọi hàm này mà
   * không truyền type (giữ tương thích ngược).
   */
  async sendPushNotification(
    userId: string,
    payload: PushNotificationPayload,
    type: NotificationType = NotificationType.TAG_SCANNED,
  ) {
    try {
      await this.createAndSendNotification({
        userId: userId,
        type,
        title: payload.title,
        body: payload.body,
        referenceId: payload.referenceId,
        metadata: payload.data || {},
      } as unknown as CreateNotificationDto);

      this.logger.log(`[Push Notification] Sent notification to user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending Push Notification:`, error);
      return false;
    }
  }

  async getUserNotifications(userId: string, query: GetNotificationsDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      unreadCount,
    };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found or you do not have permission to delete it');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true, message: 'Notification deleted successfully' };
  }

  async getNotificationDetail(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    let detailData: any = null;

    if (notification.referenceId) {
      switch (notification.type) {
        case 'TAG_SCANNED':
          detailData = await this.prisma.tagReport.findUnique({
            where: { id: notification.referenceId },
            include: {
              tag: {
                include: { pet: { include: { owner: true, images: true } } },
              },
            },
          });
          break;

        case 'EVENT':
          detailData = await this.prisma.event.findUnique({
            where: { id: notification.referenceId },
            include: { organizer: true },
          });
          break;

        case 'SECURITY':
        case 'PASSWORD':
          detailData = notification.metadata || {
            actionRequired: "Please check your login history. If there is anything unusual, change your password immediately.",
            suggestedRoute: "/account-security"
          };
          break;

        case 'FEATURE':
        case 'SYSTEM':
          detailData = notification.metadata || {
            version: "1.2.0",
            releaseNotes: "Performance updates and system bug fixes."
          };
          break;

        default:
          detailData = notification.metadata || null;
          break;
      }
    }

    if (!notification.isRead) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
      notification.isRead = true;
    }

    return {
      ...notification,
      detail: detailData,
    };
  }

  async notifyOwner(report: any) {
    try {
      const ownerId = report.tag?.pet?.ownerId;
      const petName = report.tag?.pet?.name || 'pet';

      if (!ownerId) {
        this.logger.warn(`[notifyOwner] ownerId not found for report: ${report.id}`);
        return;
      }

      // Ép kiểu number an toàn — report.radius có thể là Prisma.Decimal hoặc string từ DB
      const safeRadius = Number(report.radius) || 0;
      const isPrecise = safeRadius <= 5;

      // Fallback text tiếng Anh — dùng cho push notification (tray noti) và cho các
      // client cũ chưa hỗ trợ đọc metadata.i18n
      const titleFallback = '📍 New location of the pet!';
      const bodyFallback = isPrecise
        ? `Someone just found ${petName} at their exact location.`
        : `Someone just shared a suspected area for ${petName} within a ${safeRadius}m radius.`;

      // Key dịch tương ứng + params động — FE sẽ dùng để render song ngữ theo
      // ngôn ngữ hiện tại của người dùng tại THỜI ĐIỂM HIỂN THỊ
      const titleKey = 'notification.tag_scanned_title';
      const bodyKey = isPrecise
        ? 'notification.tag_scanned_precise'
        : 'notification.tag_scanned_radius';

      await this.sendPushNotification(
        ownerId,
        {
          title: titleFallback,
          body: bodyFallback,
          referenceId: report.id,
          data: {
            type: 'TAG_SCANNED',
            reportId: report.id,
            i18n: {
              titleKey,
              bodyKey,
              params: { petName, radius: safeRadius },
            },
          },
        },
        NotificationType.TAG_SCANNED,
      );

      this.logger.log(`[notifyOwner] Sent notification to owner ${ownerId} about report ${report.id}`);
    } catch (error) {
      this.logger.error(`[notifyOwner] Error processing owner notification:`, error);
    }
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}