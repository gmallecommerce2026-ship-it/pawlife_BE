// src/modules/applications/applications.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { RedisService } from '../../database/redis/redis.service';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  // ==========================================
  // 1. LUỒNG NGƯỜI DÙNG (ADOPTER)
  // ==========================================

  /**
   * Tạo đơn nhận nuôi mới (Giới hạn tối đa 5 đơn đang xử lý)
   */
  async createApplication(userId: string, data: CreateApplicationDto) {
    const activeApplicationsCount = await this.prisma.adoptionApplication.count({
      where: {
        userId,
        status: {
          notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'],
        },
      },
    });

    if (activeApplicationsCount >= 5) {
      throw new BadRequestException({
        message:
          'You have 5 pending applications. Please wait for the results or close your old applications before submitting a new one.',
        i18n: { key: 'error.application_limit_reached', params: { limit: 5 } },
      });
    }

    // Kiểm tra đơn đã từng tạo cho pet này chưa
    const existingApp = await this.prisma.adoptionApplication.findFirst({
      where: {
        userId,
        petId: data.petId,
      },
    });

    if (existingApp) {
      if (existingApp.status !== 'CANCELLED' && existingApp.status !== 'REJECTED') {
        throw new BadRequestException({
          message: 'You have already submitted an application for this pet.',
          i18n: { key: 'error.application_already_submitted' },
        });
      }

      // Nếu đơn cũ đã bị Hủy/Từ chối -> Cập nhật tái sử dụng bản ghi cũ
      const updated = await this.prisma.adoptionApplication.update({
        where: { id: existingApp.id },
        data: {
          ...data,
          status: 'PENDING',
        },
      });
      await this.redisService.del(`pet:detail:${data.petId}`);
      return updated;
    }

    // Chưa có đơn -> Tạo mới
    const created = await this.prisma.adoptionApplication.create({
      data: {
        userId,
        ...data,
        status: 'PENDING',
      },
    });
    await this.redisService.del(`pet:detail:${data.petId}`);
    return created;
  }

  /**
   * Lấy danh sách đơn nhận nuôi của tôi
   */
  async getMyApplications(userId: string) {
    return this.prisma.adoptionApplication.findMany({
      where: { userId },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            breed: true,
            dob: true,
            avatarUrl: true,
            shelter: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        appointments: true,
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Lấy chi tiết 1 đơn nhận nuôi theo ID
   */
  async getApplicationById(userId: string, applicationId: string) {
    const application = await this.prisma.adoptionApplication.findFirst({
      where: {
        id: applicationId,
        userId: userId,
      },
      include: {
        pet: {
          include: {
            shelter: {
              select: { id: true, name: true, avatarUrl: true, phone: true },
            },
          },
        },
        appointments: true,
        notes: {
          include: {
            author: { select: { id: true, fullName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!application) {
      throw new NotFoundException({
        message: 'This adoption application was not found!',
        i18n: { key: 'error.application_not_found' },
      });
    }

    return application;
  }

  /**
   * Cập nhật ảnh bổ sung xác minh
   */
  async updateVerificationPhotos(
    userId: string,
    applicationId: string,
    photos: string[],
  ) {
    const application = await this.prisma.adoptionApplication.findFirst({
      where: { id: applicationId, userId },
    });

    if (!application) {
      throw new NotFoundException({
        message: 'This adoption application was not found!',
        i18n: { key: 'error.application_not_found' },
      });
    }

    const updated = await this.prisma.adoptionApplication.update({
      where: { id: applicationId },
      data: {
        status: 'PENDING',
      },
    });
    await this.redisService.del(`pet:detail:${application.petId}`);
    return updated;
  }

  /**
   * Rút/Hủy đơn nhận nuôi
   */
  async withdrawApplication(userId: string, applicationId: string) {
    const application = await this.prisma.adoptionApplication.findFirst({
      where: { id: applicationId, userId },
    });

    if (!application) {
      throw new NotFoundException({
        message: 'This adoption application was not found!',
        i18n: { key: 'error.application_not_found' },
      });
    }

    if (
      application.status === 'CANCELLED' ||
      application.status === 'COMPLETED' ||
      application.status === 'REJECTED'
    ) {
      throw new BadRequestException({
        message: 'The application cannot be withdrawn in this status!',
        i18n: { key: 'error.application_cannot_withdraw' },
      });
    }

    const updated = await this.prisma.adoptionApplication.update({
      where: { id: applicationId },
      data: { status: 'CANCELLED' },
    });
    await this.redisService.del(`pet:detail:${application.petId}`);
    return updated;
  }

  // ==========================================
  // 2. LUỒNG TRẠM CỨU HỘ (SHELTER / ADMIN)
  // ==========================================

  /**
   * Lấy danh sách đơn dành cho Trạm cứu hộ
   */
  async getShelterApplications(shelterId: string, status?: string) {
    return this.prisma.adoptionApplication.findMany({
      where: {
        pet: { shelterId },
        ...(status ? { status: status as any } : {}),
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, avatarUrl: true, phone: true },
        },
        pet: {
          select: { id: true, name: true, breed: true, avatarUrl: true, gender: true },
        },
        notes: {
          include: {
            author: { select: { id: true, fullName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        tags: {
          include: { tag: true },
        },
        appointments: true,
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Thêm ghi chú nội bộ cho đơn
   */
  async addNote(applicationId: string, authorId: string, content: string) {
    return this.prisma.applicationNote.create({
      data: {
        applicationId,
        authorId,
        content,
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
  }

  /**
   * Gán Tag cho đơn nhận nuôi
   */
  async addTagToApplication(applicationId: string, tagId: string) {
    return this.prisma.applicationTagOnApplication.upsert({
      where: {
        applicationId_tagId: { applicationId, tagId },
      },
      create: { applicationId, tagId },
      update: {},
      include: { tag: true },
    });
  }

  /**
   * Bỏ Tag khỏi đơn nhận nuôi
   */
  async removeTagFromApplication(applicationId: string, tagId: string) {
    return this.prisma.applicationTagOnApplication.delete({
      where: {
        applicationId_tagId: { applicationId, tagId },
      },
    });
  }

  /**
   * Cập nhật trạng thái đơn (Phê duyệt, Từ chối, Yêu cầu bổ sung)
   */
  async updateApplicationStatus(
    applicationId: string,
    status: any,
    rejectionReason?: string,
  ) {
    const updated = await this.prisma.adoptionApplication.update({
      where: { id: applicationId },
      data: {
        status,
        ...(rejectionReason ? { rejectionReason } : {}),
      },
    });
    await this.redisService.del(`pet:detail:${updated.petId}`);
    return updated;
  }

  /**
   * Đặt lịch hẹn phỏng vấn
   */
  async scheduleAppointment(applicationId: string, dto: any) {
    return this.prisma.appointment.create({
      data: {
        applicationId,
        title: dto.title,
        type: dto.format === 'Online' ? 'ONLINE' : 'OFFLINE',
        location: dto.location || dto.link,
        scheduledAt: new Date(dto.dateSlot),
        status: 'PENDING',
      },
    });
  }
}