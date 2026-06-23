import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../../database/redis/redis.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService
  ) {}

  async getUpcomingEvents(limit: number) {
    const cacheKey = `events:upcoming:limit_${limit}`;

    const cachedData = await this.redisService.get<any>(cacheKey);
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
        // FIX: Changed from shelter to organizer
        organizer: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    const result = { success: true, data: events };

    await this.redisService.set(cacheKey, result, 3600);

    return result;
  }

  async getEventDetail(eventId: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        // FIX: Changed from shelter to organizer
        organizer: {
          select: { id: true, name: true, avatarUrl: true },
        },
        images: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
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

  async toggleInterest(eventId: string, userId: string) {
    const existingInterest = await this.prisma.eventInterest.findUnique({
      where: {
        userId_eventId: { userId, eventId },
      },
    });

    if (existingInterest) {
      // Unlike
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
    } else {
      // Like
      await this.prisma.$transaction([
        this.prisma.eventInterest.create({
          data: { userId, eventId },
        }),
        this.prisma.event.update({
          where: { id: eventId },
          data: { interestedCount: { increment: 1 } },
        }),
      ]);

      return { success: true, message: 'Interested', isInterested: true };
    }
  }

  async getInterestedEvents(userId: string) {
    const interests = await this.prisma.eventInterest.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            // FIX: Changed from shelter to organizer
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

  async searchEvents(params: { search?: string; limit?: number }) {
    const { search, limit = 20 } = params;

    const cacheKey = `events:search:limit_${limit}:search_${search || 'all'}`;

    const cachedData = await this.redisService.get<any>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const whereCondition: Prisma.EventWhereInput = {};

    if (search) {
      // 1. Dùng Raw SQL để qua mặt giới hạn của Prisma trên MySQL. 
      // Lệnh LIKE trong MySQL tự động ép kiểu JSON thành String để tìm kiếm rất mượt.
      const matchedEvents = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM Event
        WHERE LOWER(title) LIKE LOWER(${'%' + search + '%'})
           OR LOWER(locationName) LIKE LOWER(${'%' + search + '%'})
           OR LOWER(address) LIKE LOWER(${'%' + search + '%'})
      `;

      const eventIds = matchedEvents.map((e) => e.id);

      // Nếu có search mà không tìm ra ID nào -> Trả về mảng rỗng luôn cho tối ưu
      if (eventIds.length === 0) {
        return { success: true, data: [] };
      }

      // 2. Gán mảng id tìm được vào điều kiện where
      whereCondition.id = { in: eventIds };
    }

    // 3. Chạy findMany bình thường để giữ nguyên được các include (relations)
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
}