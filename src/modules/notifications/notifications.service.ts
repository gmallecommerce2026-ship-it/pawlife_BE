import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GetNotificationsDto, CreateNotificationDto } from './dto/notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType } from '@prisma/client'; // Import từ Prisma Schema

// Định nghĩa Interface cho Push Notification
export interface PushNotificationPayload {
  title: string;
  body: string;
  referenceId?: string; // Bổ sung để liên kết với TagReport, Event...
  data?: any;           // Chứa url deeplink hoặc metadata khác
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // ----------------------------------------------------------------------
  // 1. Hàm tạo In-App Notification & Bắn Realtime Socket
  // ----------------------------------------------------------------------
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

    // Bắn sự kiện socket realtime tới đúng user đang mở App
    this.notificationsGateway.sendNotificationToUser(data.userId, notification);

    return notification;
  }

  // ----------------------------------------------------------------------
  // 2. Hàm gửi Push Notification (Màn hình khóa OS) - Sửa lỗi TS2339
  // ----------------------------------------------------------------------
  async sendPushNotification(userId: string, payload: PushNotificationPayload) {
    try {
      // 2.1 Tái sử dụng hàm In-App để lưu vào DB và bắn Socket
      // Lưu ý: Ép kiểu as any hoặc cấu trúc lại cho khớp với CreateNotificationDto của bạn
      await this.createAndSendNotification({
        userId: userId,
        type: NotificationType.TAG_SCANNED, 
        title: payload.title,
        body: payload.body,
        referenceId: payload.referenceId, // Quan trọng: Truyền ID của TagReport vào đây
        metadata: payload.data || {},
      } as unknown as CreateNotificationDto); 

      // 2.2 Tích hợp gửi ra màn hình khóa (FCM / Expo Server SDK)
      // const sessions = await this.prisma.deviceSession.findMany({ where: { userId } });
      // TODO: Map qua danh sách push tokens và gửi bằng Expo

      this.logger.log(`[Push Notification] Đã gửi thông báo tới user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Lỗi gửi Push Notification:`, error);
      return false; // Không throw error để tránh làm sập luồng code gọi nó
    }
  }

  // ----------------------------------------------------------------------
  // 3. Lấy danh sách thông báo
  // ----------------------------------------------------------------------
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

  // ----------------------------------------------------------------------
  // 4. Lấy chi tiết thông báo
  // ----------------------------------------------------------------------
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
            include: { shelter: true },
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

  // ----------------------------------------------------------------------
  // 5. Cập nhật trạng thái đọc
  // ----------------------------------------------------------------------
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