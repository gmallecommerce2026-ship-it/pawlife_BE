"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const notifications_gateway_1 = require("./notifications.gateway");
const client_1 = require("@prisma/client");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    prisma;
    notificationsGateway;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(prisma, notificationsGateway) {
        this.prisma = prisma;
        this.notificationsGateway = notificationsGateway;
    }
    async createAndSendNotification(data) {
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
    async sendPushNotification(userId, payload) {
        try {
            await this.createAndSendNotification({
                userId: userId,
                type: client_1.NotificationType.TAG_SCANNED,
                title: payload.title,
                body: payload.body,
                referenceId: payload.referenceId,
                metadata: payload.data || {},
            });
            this.logger.log(`[Push Notification] Đã gửi thông báo tới user: ${userId}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Lỗi gửi Push Notification:`, error);
            return false;
        }
    }
    async getUserNotifications(userId, query) {
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
    async deleteNotification(userId, notificationId) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId, userId },
        });
        if (!notification) {
            throw new common_1.NotFoundException('Không tìm thấy thông báo hoặc bạn không có quyền xóa');
        }
        await this.prisma.notification.delete({
            where: { id: notificationId },
        });
        return { success: true, message: 'Đã xóa thông báo thành công' };
    }
    async getNotificationDetail(userId, notificationId) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId, userId },
        });
        if (!notification) {
            throw new common_1.NotFoundException('Không tìm thấy thông báo');
        }
        let detailData = null;
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
    async notifyOwner(report) {
        try {
            const ownerId = report.tag?.pet?.ownerId;
            const petName = report.tag?.pet?.name || 'thú cưng';
            if (!ownerId) {
                this.logger.warn(`[notifyOwner] Không tìm thấy ownerId cho report: ${report.id}`);
                return;
            }
            const isPrecise = report.radius <= 5;
            const title = '📍 Vị trí mới của thú cưng!';
            const body = isPrecise
                ? `Ai đó vừa tìm thấy ${petName} tại vị trí chính xác của họ.`
                : `Ai đó vừa chia sẻ khu vực nghi vấn của ${petName} trong bán kính ${report.radius}m.`;
            await this.sendPushNotification(ownerId, {
                title,
                body,
                referenceId: report.id,
                data: {
                    type: 'TAG_SCANNED',
                    reportId: report.id,
                    petName: petName,
                }
            });
            this.logger.log(`[notifyOwner] Đã gửi thông báo cho chủ sở hữu ${ownerId} về report ${report.id}`);
        }
        catch (error) {
            this.logger.error(`[notifyOwner] Lỗi khi xử lý thông báo chủ sở hữu:`, error);
        }
    }
    async markAsRead(userId, notificationId) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }
    async markAllAsRead(userId) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_gateway_1.NotificationsGateway])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map