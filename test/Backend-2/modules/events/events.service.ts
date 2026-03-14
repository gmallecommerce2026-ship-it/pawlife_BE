import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUpcomingEvents(limit: number) {
    const events = await this.prisma.event.findMany({
      where: {
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: 'asc' },
      take: limit,
      include: {
        // Lấy thêm thông tin Organizer (Shelter) để hiển thị
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
    // Kiểm tra xem user đã bấm "Interesting" trước đó chưa
    const existingInterest = await this.prisma.eventInterest.findUnique({
      where: {
        userId_eventId: { userId, eventId },
      },
    });

    // Dùng Transaction để đảm bảo tính đồng bộ khi thay đổi dữ liệu đếm
    if (existingInterest) {
      // Đã bấm -> Hủy bấm (Unlike)
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
      // Chưa bấm -> Bấm quan tâm (Like)
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

    // Lọc theo tiêu đề sự kiện, tên địa điểm (locationName) hoặc địa chỉ (address)
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