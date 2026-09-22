import { NotificationType } from '@prisma/client';
export declare class GetNotificationsDto {
    page?: number;
    limit?: number;
}
export declare class CreateNotificationDto {
    userId: string;
    title: string;
    body: string;
    type: NotificationType;
    referenceId?: string;
    metadata?: any;
}
