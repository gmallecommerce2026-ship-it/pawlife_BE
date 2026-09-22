import { PrismaService } from '../../database/prisma/prisma.service';
import { GetNotificationsDto, CreateNotificationDto } from './dto/notification.dto';
import { NotificationsGateway } from './notifications.gateway';
export interface PushNotificationPayload {
    title: string;
    body: string;
    referenceId?: string;
    data?: any;
}
export declare class NotificationsService {
    private readonly prisma;
    private readonly notificationsGateway;
    private readonly logger;
    constructor(prisma: PrismaService, notificationsGateway: NotificationsGateway);
    createAndSendNotification(data: CreateNotificationDto): Promise<{
        id: string;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        body: string;
        emoji: string | null;
        isRead: boolean;
        referenceId: string | null;
        metadata: import("@prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        userId: string;
    }>;
    sendPushNotification(userId: string, payload: PushNotificationPayload): Promise<boolean>;
    getUserNotifications(userId: string, query: GetNotificationsDto): Promise<{
        data: {
            id: string;
            type: import("@prisma/client").$Enums.NotificationType;
            title: string;
            body: string;
            emoji: string | null;
            isRead: boolean;
            referenceId: string | null;
            metadata: import("@prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            userId: string;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
        unreadCount: number;
    }>;
    deleteNotification(userId: string, notificationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getNotificationDetail(userId: string, notificationId: string): Promise<{
        detail: any;
        id: string;
        type: import("@prisma/client").$Enums.NotificationType;
        title: string;
        body: string;
        emoji: string | null;
        isRead: boolean;
        referenceId: string | null;
        metadata: import("@prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        userId: string;
    }>;
    notifyOwner(report: any): Promise<void>;
    markAsRead(userId: string, notificationId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    markAllAsRead(userId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
}
