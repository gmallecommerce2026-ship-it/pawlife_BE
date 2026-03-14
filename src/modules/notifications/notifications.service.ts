import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GetNotificationsDto, CreateNotificationDto } from './dto/notification.dto';
import { NotificationsGateway } from './notifications.gateway'; // Đảm bảo bạn đã tạo file này

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway, // Inject Gateway để bắn socket
  ) {}

  // ----------------------------------------------------------------------
  // HÀM MỚI: Tạo và gửi thông báo Real-time (Sử dụng bởi các module khác)
  // ----------------------------------------------------------------------
  async createAndSendNotification(data: CreateNotificationDto) {
    // 1. Lưu vào Database
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

    // 2. Bắn sự kiện socket realtime tới đúng user
    this.notificationsGateway.sendNotificationToUser(data.userId, notification);

    return notification;
  }

  // Lấy danh sách thông báo
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

  // Lấy chi tiết thông báo (Xử lý tập trung tại đây)
  async getNotificationDetail(userId: string, notificationId: string) {
    // 1. Lấy thông báo gốc
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    let detailData: any = null;

    // 2. Tùy thuộc vào type mà query bảng tương ứng bằng referenceId
    if (notification.referenceId) {
      switch (notification.type) {
        case 'TAG':
          detailData = await this.prisma.tagReport.findUnique({
            where: { id: notification.referenceId },
            include: {
              tag: {
                include: { pet: true },
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
          if (notification.referenceId) {
            // Bỏ comment nếu bạn có model Blog
            // detailData = await this.prisma.blog.findUnique({
            //   where: { id: notification.referenceId },
            // });
          } else {
            detailData = notification.metadata || {
              version: "1.2.0",
              releaseNotes: "Cập nhật hiệu năng và vá lỗi hệ thống."
            };
          }
          break;

        default:
          detailData = notification.metadata || null;
          break;
      }
    }

    // Đánh dấu đã đọc
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

  // Đánh dấu 1 thông báo là đã đọc
  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  // Đánh dấu tất cả là đã đọc
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}