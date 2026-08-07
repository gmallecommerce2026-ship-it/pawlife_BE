import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAdoptionApplicationDto, CreateAppointmentDto } from './dto/adoption-application.dto';

@Injectable()
export class AdoptionApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Lấy hồ sơ mẫu của người dùng
  async getMyApplicationProfile(userId: string) {
    const profile = await this.prisma.adoptionApplication.findFirst({
      where: { userId },
      include: {
        requests: {
          include: {
            pet: {
              include: { images: true, shelter: true },
            },
            appointments: { orderBy: { scheduledAt: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return profile || null;
  }

  // 2. Tạo mới hoặc Cập nhật hồ sơ (Upsert)
  async upsertApplicationProfile(userId: string, dto: UpsertAdoptionApplicationDto) {
    const existing = await this.prisma.adoptionApplication.findFirst({
      where: { userId },
    });

    if (existing) {
      return this.prisma.adoptionApplication.update({
        where: { id: existing.id },
        data: { ...dto },
      });
    }

    return this.prisma.adoptionApplication.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  // 3. Lấy danh sách các đơn nhận nuôi thú cưng của người dùng
  async getMyAdoptionRequests(userId: string) {
    return this.prisma.adoptionRequest.findMany({
      where: { application: { userId } },
      include: {
        pet: {
          include: { images: { take: 1 }, shelter: true },
        },
        appointments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 4. Hủy đơn nhận nuôi
  async cancelAdoptionRequest(userId: string, requestId: string) {
    const request = await this.prisma.adoptionRequest.findFirst({
      where: { id: requestId, application: { userId } },
    });

    if (!request) {
      throw new NotFoundException('Không tìm thấy đơn yêu cầu');
    }

    return this.prisma.adoptionRequest.update({
      where: { id: requestId },
      data: { status: 'CLOSED', rejectionReason: 'Người dùng tự hủy đơn' },
    });
  }

  // 5. Đặt lịch hẹn phỏng vấn/gặp gỡ
  async createAppointment(userId: string, dto: CreateAppointmentDto) {
    const request = await this.prisma.adoptionRequest.findFirst({
      where: { id: dto.requestId, application: { userId } },
    });

    if (!request) {
      throw new NotFoundException('Đơn nhận nuôi không hợp lệ');
    }

    return this.prisma.appointment.create({
      data: {
        requestId: dto.requestId,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
        status: 'SCHEDULED',
      },
    });
  }
}