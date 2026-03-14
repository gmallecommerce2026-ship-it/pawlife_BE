import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService // Inject NotificationsService
  ) {}

  async getUpcomingEvents(limit: number) {
    const events = await this.prisma.event.findMany({
      where: {
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: 'asc' },
      take: limit,
      include: {
        shelter: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    return { success: true, data: events };
  }

  async getEventDetail(eventId: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        shelter: {
          select: { id: true, name: true, avatarUrl: true },
        },
        images: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Không tìm thấy sự kiện');
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

      // Lấy thông tin event để lấy title
      const event = await this.prisma.event.findUnique({ where: { id: eventId } });

      // Bắn thông báo realtime cho user
      if (event) {
        await this.notificationsService.createAndSendNotification({
          userId: userId,
          title: '📅 Quan tâm sự kiện',
          body: `Bạn đã đăng ký quan tâm sự kiện "${event.title}". Chúng tôi sẽ nhắc bạn khi sự kiện sắp bắt đầu!`,
          type: NotificationType.EVENT,
          referenceId: eventId,
        });
      }

      return { success: true, message: 'Interested', isInterested: true };
    }
  }

  async getInterestedEvents(userId: string) {
    const interests = await this.prisma.eventInterest.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            shelter: {
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

    const whereCondition: Prisma.EventWhereInput = {};

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
        shelter: {
          select: { id: true, name: true, avatarUrl: true },
        },
        images: true,
      },
      orderBy: { startDate: 'asc' },
    });

    return { success: true, data: events };
  }
}