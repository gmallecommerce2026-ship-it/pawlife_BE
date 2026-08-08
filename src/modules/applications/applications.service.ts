// src/modules/applications/applications.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { RedisService } from '../../database/redis/redis.service';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) { }

  // ==========================================
  // 1. LUỒNG NGƯỜI DÙNG (ADOPTER)
  // ==========================================

  /**
   * Tạo đơn nhận nuôi mới (Giới hạn tối đa 5 đơn chưa đóng)
   */
  async createApplication(userId: string, data: CreateApplicationDto) {
    const activeApplicationsCount = await this.prisma.adoptionApplication.count({
      where: {
        userId,
        status: {
          notIn: ['CLOSED', 'ADOPTION_COMPLETED'],
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

    // TÌM TẤT CẢ CÁC ĐƠN BẤT KỂ TRẠNG THÁI
    const existingApp = await this.prisma.adoptionApplication.findFirst({
      where: {
        userId,
        petId: data.petId,
      },
    });

    if (existingApp) {
      // Nếu đơn đang mở -> Chặn lại
      if (
        existingApp.status !== 'CLOSED' &&
        existingApp.status !== 'ADOPTION_COMPLETED'
      ) {
        throw new BadRequestException({
          message: 'You have already submitted an application for this pet.',
          i18n: { key: 'error.application_already_submitted' },
        });
      }

      // Nếu đơn cũ đã bị CLOSED / ADOPTION_COMPLETED -> Tái sử dụng (Update)
      const updated = await this.prisma.adoptionApplication.update({
        where: { id: existingApp.id },
        data: {
          ...data,
          status: 'SUBMITTED',
        },
      });
      await this.redisService.del(`pet:detail:${data.petId}`);
      return updated;
    }

    // Nếu chưa từng có đơn nào -> Tạo mới
    const created = await this.prisma.adoptionApplication.create({
      data: {
        userId,
        ...data,
        status: 'SUBMITTED',
      },
    });
    await this.redisService.del(`pet:detail:${data.petId}`);
    return created;
  }

  /**
   * Lấy danh sách đơn của tôi
   */
  async getMyApplications(shelterId: string, query: { status?: string; statuses?: string; petId?: string }) {
    const where: any = { pet: { shelterId } };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }
    if (query.statuses) {
      where.status = { in: query.statuses.split(',') };
    }
    if (query.petId) where.petId = query.petId;

    return this.prisma.adoptionApplication.findMany({
      where,
      include: {
        pet: { include: { images: { take: 1, orderBy: { createdAt: 'asc' } } } },
        user: { select: { id: true, name: true, avatarUrl: true, email: true, phone: true } },
        notes: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lấy chi tiết đơn ứng tuyển theo ID
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
            images: { orderBy: { createdAt: 'asc' } },
            shelter: {
              select: { id: true, name: true, avatarUrl: true, contactInfo: true },
            },
          },
        },
        appointment: true,
        notes: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
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
   * Cập nhật ảnh xác minh bổ sung
   */
  async updateVerificationPhotos(
    userId: string,
    applicationId: string,
    photos: string[],
  ) {
    const application = await this.prisma.adoptionApplication.findFirst({
      where: {
        id: applicationId,
        userId: userId,
      },
    });

    if (!application) {
      throw new NotFoundException({
        message: 'This adoption application was not found!',
        i18n: { key: 'error.application_not_found' },
      });
    }

    if (application.status !== 'NEED_MORE_INFO') {
      throw new BadRequestException({
        message: 'The application currently requires no additional information.',
        i18n: { key: 'error.application_no_info_needed' },
      });
    }

    const updated = await this.prisma.adoptionApplication.update({
      where: { id: applicationId },
      data: {
        verificationPhotos: photos,
        status: 'PENDING',
      },
    });
    await this.redisService.del(`pet:detail:${application.petId}`);
    return updated;
  }

  /**
   * Rút đơn nhận nuôi
   */
  async withdrawApplication(userId: string, applicationId: string) {
    const application = await this.prisma.adoptionApplication.findFirst({
      where: {
        id: applicationId,
        userId: userId,
      },
    });

    if (!application) {
      throw new NotFoundException({
        message: 'This adoption application was not found!',
        i18n: { key: 'error.application_not_found' },
      });
    }

    if (
      application.status === 'CLOSED' ||
      application.status === 'ADOPTION_COMPLETED'
    ) {
      throw new BadRequestException({
        message: 'The application cannot be withdrawn in this status!',
        i18n: { key: 'error.application_cannot_withdraw' },
      });
    }

    const updated = await this.prisma.adoptionApplication.update({
      where: { id: applicationId },
      data: { status: 'CLOSED' },
    });
    await this.redisService.del(`pet:detail:${application.petId}`);
    return updated;
  }

  // ==========================================
  // 2. LUỒNG TRẠM CỨU HỘ (SHELTER / ADMIN)
  // ==========================================

  /**
   * Lấy danh sách đơn dành cho Shelter
   */
  async getShelterApplications(shelterId: string, status?: string) {
    return this.prisma.adoptionApplication.findMany({
      where: {
        pet: { shelterId },
        ...(status ? { status: status as any } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, phone: true },
        },
        pet: {
          select: {
            id: true,
            name: true,
            breed: true,
            gender: true,
            images: { select: { url: true }, take: 1 },
          },
        },
        notes: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        tags: {
          include: { tag: true },
        },
        appointment: true,
      },
      orderBy: { createdAt: 'desc' },
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
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  /**
   * Gán Tag cho đơn
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
   * Gỡ Tag khỏi đơn
   */
  async removeTagFromApplication(applicationId: string, tagId: string) {
    return this.prisma.applicationTagOnApplication.delete({
      where: {
        applicationId_tagId: { applicationId, tagId },
      },
    });
  }

  /**
   * Cập nhật trạng thái đơn
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
        ...(rejectionReason ? { reviewNote: rejectionReason } : {}),
      },
    });
    await this.redisService.del(`pet:detail:${updated.petId}`);
    return updated;
  }

  /**
   * Đặt lịch hẹn phỏng vấn
   */
  async scheduleAppointment(applicationId: string, dto: any) {
    const app = await this.prisma.adoptionApplication.findUnique({
      where: { id: applicationId },
      include: { pet: true },
    });

    if (!app) {
      throw new NotFoundException('Adoption application not found');
    }

    return this.prisma.appointment.create({
      data: {
        applicationId,
        userId: app.userId,
        petId: app.petId,
        shelterId: app.pet.shelterId!,
        appointmentDate: new Date(dto.dateSlot || dto.appointmentDate),
        startTime: dto.startTime || '09:00',
        endTime: dto.endTime || '10:00',
        type: dto.format === 'Online' ? 'ONLINE' : 'IN_PERSON',
        location: dto.location || dto.link,
        status: 'PENDING',
      },
    });
  }
}