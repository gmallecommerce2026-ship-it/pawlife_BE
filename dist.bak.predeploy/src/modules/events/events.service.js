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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const client_1 = require("@prisma/client");
const notifications_service_1 = require("../notifications/notifications.service");
const redis_service_1 = require("../../database/redis/redis.service");
let EventsService = class EventsService {
    prisma;
    notificationsService;
    redisService;
    constructor(prisma, notificationsService, redisService) {
        this.prisma = prisma;
        this.notificationsService = notificationsService;
        this.redisService = redisService;
    }
    async getUpcomingEvents(limit) {
        const cacheKey = `events:upcoming:limit_${limit}`;
        const cachedData = await this.redisService.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }
        const events = await this.prisma.event.findMany({
            where: {
                startDate: { gte: new Date() },
            },
            orderBy: { startDate: 'asc' },
            take: limit,
            include: {
                organizer: {
                    select: { id: true, name: true, avatarUrl: true },
                },
            },
        });
        const result = { success: true, data: events };
        await this.redisService.set(cacheKey, result, 3600);
        return result;
    }
    async getEventDetail(eventId, userId) {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            include: {
                organizer: {
                    select: { id: true, name: true, avatarUrl: true },
                },
                images: true,
            },
        });
        if (!event) {
            throw new common_1.NotFoundException('Không tìm thấy sự kiện');
        }
        let isInterested = false;
        if (userId) {
            const interest = await this.prisma.eventInterest.findUnique({
                where: {
                    userId_eventId: { userId, eventId },
                },
            });
            isInterested = !!interest;
        }
        return { success: true, data: { ...event, isInterested } };
    }
    async toggleInterest(eventId, userId) {
        const existingInterest = await this.prisma.eventInterest.findUnique({
            where: {
                userId_eventId: { userId, eventId },
            },
        });
        if (existingInterest) {
            await this.prisma.$transaction([
                this.prisma.eventInterest.delete({
                    where: { id: existingInterest.id },
                }),
                this.prisma.event.update({
                    where: { id: eventId },
                    data: { interestedCount: { decrement: 1 } },
                }),
            ]);
            return { success: true, message: 'Uninterested', isInterested: false };
        }
        else {
            await this.prisma.$transaction([
                this.prisma.eventInterest.create({
                    data: { userId, eventId },
                }),
                this.prisma.event.update({
                    where: { id: eventId },
                    data: { interestedCount: { increment: 1 } },
                }),
            ]);
            const event = await this.prisma.event.findUnique({ where: { id: eventId } });
            if (event) {
                await this.notificationsService.createAndSendNotification({
                    userId: userId,
                    title: '📅 Quan tâm sự kiện',
                    body: `Bạn đã đăng ký quan tâm sự kiện "${event.title}". Chúng tôi sẽ nhắc bạn khi sự kiện sắp bắt đầu!`,
                    type: client_1.NotificationType.EVENT,
                    referenceId: eventId,
                });
            }
            return { success: true, message: 'Interested', isInterested: true };
        }
    }
    async getInterestedEvents(userId) {
        const interests = await this.prisma.eventInterest.findMany({
            where: { userId },
            include: {
                event: {
                    include: {
                        organizer: {
                            select: { id: true, name: true, avatarUrl: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const events = interests.map(interest => interest.event);
        return { success: true, data: events };
    }
    async searchEvents(params) {
        const { search, limit = 20 } = params;
        const cacheKey = `events:search:limit_${limit}:search_${search || 'all'}`;
        const cachedData = await this.redisService.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }
        const whereCondition = {};
        if (search) {
            whereCondition.OR = [
                { title: { contains: search } },
                { locationName: { contains: search } },
                { address: { contains: search } },
            ];
        }
        const events = await this.prisma.event.findMany({
            where: whereCondition,
            take: limit,
            include: {
                organizer: {
                    select: { id: true, name: true, avatarUrl: true },
                },
                images: true,
            },
            orderBy: { startDate: 'asc' },
        });
        const result = { success: true, data: events };
        await this.redisService.set(cacheKey, result, 3600);
        return result;
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        redis_service_1.RedisService])
], EventsService);
//# sourceMappingURL=events.service.js.map