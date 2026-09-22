import { NotificationsService } from './notifications.service';
import { GetNotificationsDto } from './dto/notification.dto';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    getMine(userId: string, query: GetNotificationsDto): Promise<{
        data: {
            id: string;
            type: import(".prisma/client").$Enums.NotificationType;
            title: string;
            body: string;
            emoji: string | null;
            isRead: boolean;
            referenceId: string | null;
            metadata: import(".prisma/client").Prisma.JsonValue | null;
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
    getDetail(userId: string, id: string): Promise<{
        detail: any;
        id: string;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        body: string;
        emoji: string | null;
        isRead: boolean;
        referenceId: string | null;
        metadata: import(".prisma/client").Prisma.JsonValue | null;
        createdAt: Date;
        userId: string;
    }>;
    markAsRead(userId: string, id: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    markAllAsRead(userId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    deleteNotification(userId: string, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
