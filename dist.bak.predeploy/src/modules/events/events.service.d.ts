import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../../database/redis/redis.service';
export declare class EventsService {
    private readonly prisma;
    private readonly notificationsService;
    private readonly redisService;
    constructor(prisma: PrismaService, notificationsService: NotificationsService, redisService: RedisService);
    getUpcomingEvents(limit: number): Promise<any>;
    getEventDetail(eventId: string, userId?: string): Promise<{
        success: boolean;
        data: {
            isInterested: boolean;
            images: {
                id: string;
                url: string;
                createdAt: Date;
                eventId: string;
            }[];
            organizer: {
                id: string;
                name: string;
                avatarUrl: string | null;
            } | null;
            id: string;
            title: string;
            category: string | null;
            description: string | null;
            bannerUrl: string | null;
            startDate: Date;
            endDate: Date | null;
            locationName: string;
            address: string | null;
            latitude: number | null;
            longitude: number | null;
            interestedCount: number;
            organizerId: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    toggleInterest(eventId: string, userId: string): Promise<{
        success: boolean;
        message: string;
        isInterested: boolean;
    }>;
    getInterestedEvents(userId: string): Promise<{
        success: boolean;
        data: ({
            organizer: {
                id: string;
                name: string;
                avatarUrl: string | null;
            } | null;
        } & {
            id: string;
            title: string;
            category: string | null;
            description: string | null;
            bannerUrl: string | null;
            startDate: Date;
            endDate: Date | null;
            locationName: string;
            address: string | null;
            latitude: number | null;
            longitude: number | null;
            interestedCount: number;
            organizerId: string | null;
            createdAt: Date;
            updatedAt: Date;
        })[];
    }>;
    searchEvents(params: {
        search?: string;
        limit?: number;
    }): Promise<any>;
}
