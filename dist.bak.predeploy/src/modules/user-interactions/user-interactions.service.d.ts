import { PrismaService } from '../../database/prisma/prisma.service';
import { SwipeAction } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
export declare class ShareLocationDto {
    petId: string;
    lat: number;
    lng: number;
    radius: number;
    scannedBy?: string;
    phoneNumber?: string;
    message?: string;
}
export declare class UserInteractionsService {
    private readonly prisma;
    private readonly notificationsService;
    constructor(prisma: PrismaService, notificationsService: NotificationsService);
    shareLocation(dto: ShareLocationDto): Promise<{
        id: string;
        tagId: string;
        userId: string | null;
        scannedBy: string | null;
        phoneNumber: string | null;
        latitude: number | null;
        longitude: number | null;
        radius: number | null;
        message: string | null;
        images: import("@prisma/client").Prisma.JsonValue | null;
        status: import("@prisma/client").$Enums.TagReportStatus;
        scannedAt: Date;
    }>;
    private getPetOwnerId;
    swipePet(userId: string, petId: string, action: SwipeAction): Promise<{
        id: string;
        action: import("@prisma/client").$Enums.SwipeAction;
        createdAt: Date;
        userId: string;
        petId: string;
    }>;
    toggleFavorite(userId: string, petId: string): Promise<{
        favorited: boolean;
    }>;
    toggleFollowShelter(userId: string, shelterId: string): Promise<{
        followed: boolean;
    }>;
}
