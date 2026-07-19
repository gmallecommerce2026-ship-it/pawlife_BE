import { EventsService } from './events.service';
import type { Request, Response } from 'express';
export declare class EventsController {
    private readonly eventsService;
    constructor(eventsService: EventsService);
    getUpcomingEvents(limit: number): Promise<any>;
    getEventDetailOrPreview(id: string, req: Request, res: Response, userId?: string): Promise<{
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
    } | undefined>;
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
    } | {
        success: boolean;
        message: string;
    }>;
    getEventDetail(id: string, userId?: string): Promise<{
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
    searchEvents(search?: string, limit?: number): Promise<any>;
}
