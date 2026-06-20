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

  async sendPushNotification(userId: string, payload: PushNotificationPayload) {
    try {
      await this.createAndSendNotification({
        userId: userId,
        type: NotificationType.TAG_SCANNED,
        title: payload.title,
        body: payload.body,
        referenceId: payload.referenceId,
        metadata: payload.data || {},
      } as unknown as CreateNotificationDto);

      this.logger.log(`[Push Notification] Đã gửi thông báo tới user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Lỗi gửi Push Notification:`, error);
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
    // Tìm thông báo theo id và đảm bảo nó thuộc về user đang request
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo hoặc bạn không có quyền xóa');
    }

    // Thực hiện xóa
    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true, message: 'Đã xóa thông báo thành công' };
  }

  async getNotificationDetail(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
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
            // SỬA LỖI Ở ĐÂY: Dùng organizer thay cho shelter
            include: { organizer: true },
          });
          break;

        case 'SECURITY':
        case 'PASSWORD':
          detailData = notification.metadata || {
            actionRequired: "Vui lòng kiểm tra lại lịch sử đăng nhập. Nếu có bất thường, hãy đổi mật khẩu ngay.",
            suggestedRoute: "/account-security"
          };
          break;

        case 'FEATURE':
        case 'SYSTEM':
          detailData = notification.metadata || {
            version: "1.2.0",
            releaseNotes: "Cập nhật hiệu năng và vá lỗi hệ thống."
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
      const petName = report.tag?.pet?.name || 'thú cưng';

      if (!ownerId) {
        this.logger.warn(`[notifyOwner] Không tìm thấy ownerId cho report: ${report.id}`);
        return;
      }

      const isPrecise = report.radius <= 5;

      // Vẫn giữ text mặc định (fallback) cho DB/Push notification hệ thống cũ
      const titleFallback = '📍 Vị trí mới của thú cưng!';
      const bodyFallback = isPrecise
        ? `Ai đó vừa tìm thấy ${petName} tại vị trí chính xác của họ.`
        : `Ai đó vừa chia sẻ khu vực nghi vấn của ${petName} trong bán kính ${report.radius}m.`;

      // Khai báo Key dịch thuật tương ứng
      const titleKey = 'notification.tag_scanned_title';
      const bodyKey = isPrecise ? 'notification.tag_scanned_precise' : 'notification.tag_scanned_radius';

      await this.sendPushNotification(ownerId, {
        title: titleFallback,
        body: bodyFallback,
        referenceId: report.id,
        data: {
          type: 'TAG_SCANNED',
          reportId: report.id,
          // BỔ SUNG THÊM I18N DATA CHO FRONTEND
          i18n: {
            titleKey: titleKey,
            bodyKey: bodyKey,
            params: { petName, radius: report.radius }
          }
        }
      });

      this.logger.log(`[notifyOwner] Đã gửi thông báo cho chủ sở hữu ${ownerId} về report ${report.id}`);
    } catch (error) {
      this.logger.error(`[notifyOwner] Lỗi khi xử lý thông báo chủ sở hữu:`, error);
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