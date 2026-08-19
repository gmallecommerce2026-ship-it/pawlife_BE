// src/modules/applications/applications.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { RedisService } from '../../database/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role, NotificationType } from '@prisma/client';
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
  ) { }

  // FIX BẢO MẬT: helper dùng chung để xác nhận đơn thuộc đúng shelter đang
  // gọi API — bắt buộc gọi trước mọi thao tác ghi (notes/tags/status/appointments)
  // ở phần "LUỒNG SHELTER" bên dưới.
  private async assertOwnsApplication(shelterId: string, applicationId: string) {
    const application = await this.prisma.adoptionApplication.findUnique({
      where: { id: applicationId },
      include: { pet: true },
    });
    if (!application) throw new NotFoundException('Không tìm thấy đơn.');
    if (application.pet.shelterId !== shelterId) {
      throw new ForbiddenException('Bạn không có quyền với đơn này.');
    }
    return application;
  }

  // ==========================================
  // 1. LUỒNG NGƯỜI DÙNG (ADOPTER) — không đổi
  // ==========================================

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

    const existingApp = await this.prisma.adoptionApplication.findFirst({
      where: {
        userId,
        petId: data.petId,
      },
    });

    const applicationPayload = {
      petId: data.petId,
      fullName: data.fullName,
      phone: data.phone || data.zalo,
      zalo: data.zalo,
      adoptFor: data.adoptFor,
      location: data.location,
      housing: data.housing,
      children: data.children,
      cage: data.cage,
      petExperience: data.petExperience,
      prevPetHistory: data.prevPetHistory || '',
      employmentStatus: data.employmentStatus,
      adoptionReason: data.adoptionReason,
      commitments: data.commitments,
      status: 'SUBMITTED' as const,
    };

    if (existingApp) {
      if (
        existingApp.status !== 'CLOSED' &&
        existingApp.status !== 'ADOPTION_COMPLETED'
      ) {
        throw new BadRequestException({
          message: 'You have already submitted an application for this pet.',
          i18n: { key: 'error.application_already_submitted' },
        });
      }

      const updated = await this.prisma.adoptionApplication.update({
        where: { id: existingApp.id },
        data: {
          ...applicationPayload,
          createdAt: new Date(),
        },
      });

      if (data.otherQuestion && data.otherQuestion.trim()) {
        await this.prisma.applicationNote.create({
          data: {
            applicationId: updated.id,
            authorId: userId,
            content: `Câu hỏi từ người nhận nuôi: ${data.otherQuestion.trim()}`,
          },
        }).catch(() => { });
      }

      await this.redisService.del(`pet:detail:${data.petId}`);
      return updated;
    }

    const created = await this.prisma.adoptionApplication.create({
      data: {
        userId,
        ...applicationPayload,
      },
    });

    if (data.otherQuestion && data.otherQuestion.trim()) {
      await this.prisma.applicationNote.create({
        data: {
          applicationId: created.id,
          authorId: userId,
          content: `Câu hỏi từ người nhận nuôi: ${data.otherQuestion.trim()}`,
        },
      }).catch(() => { });
    }

    await this.redisService.del(`pet:detail:${data.petId}`);
    return created;
  }

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
            images: {
              select: { url: true },
              take: 1,
            },
            shelter: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        appointment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async getApplicationDocuments(
    currentUser: { id: string; role: Role; shelterId?: string },
    applicationId: string,
  ) {
    const application = await this.prisma.adoptionApplication.findUnique({
      where: { id: applicationId },
      include: { pet: true },
    });
    if (!application) throw new NotFoundException('Không tìm thấy đơn.');

    const isOwnerAdopter = application.userId === currentUser.id;
    const isOwnerShelter =
      currentUser.role === Role.SHELTER &&
      application.pet.shelterId === currentUser.shelterId;

    if (!isOwnerAdopter && !isOwnerShelter) {
      throw new ForbiddenException('Bạn không có quyền xem tài liệu của đơn này.');
    }

    return this.prisma.applicationDocument.findMany({
      where: { applicationId },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async requestDocuments(
    shelterId: string,
    applicationId: string,
    staffId: string,
    items: { key: string; label: string; description: string }[],
  ) {
    const application = await this.assertOwnsApplication(shelterId, applicationId);

    const existing = await this.prisma.applicationDocument.findMany({
      where: { applicationId },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((d) => d.key));
    const newItems = items.filter((d) => !existingKeys.has(d.key));

    if (newItems.length === 0) {
      throw new BadRequestException('Các tài liệu này đã được yêu cầu trước đó.');
    }

    const created = await this.prisma.$transaction(
      newItems.map((d) =>
        this.prisma.applicationDocument.create({
          data: {
            applicationId,
            key: d.key,
            label: d.label,
            description: d.description,
            status: 'PENDING_SUBMISSION',
            requestedById: staffId,
          },
        }),
      ),
    );

    if (application.status !== 'NEED_MORE_INFO') {
      await this.prisma.adoptionApplication.update({
        where: { id: applicationId },
        data: { status: 'NEED_MORE_INFO' },
      });
    }

    await this.notificationsService.createAndSendNotification({
      userId: application.userId,
      title: '📄 Cần bổ sung tài liệu',
      body: `Trạm cứu hộ cần bạn bổ sung ${newItems.length} tài liệu cho đơn nhận nuôi ${application.pet.name}.`,
      type: NotificationType.SYSTEM,
      referenceId: application.petId,
      metadata: { applicationId, documentIds: created.map((d) => d.id) },
    });

    await this.redisService.del(`pet:detail:${application.petId}`);
    return created;
  }
  async simulateSubmitDocument(shelterId: string, applicationId: string, docId: string) {
    await this.assertOwnsApplication(shelterId, applicationId);

    const doc = await this.prisma.applicationDocument.findFirst({
      where: { id: docId, applicationId },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    if (doc.status === 'ACCEPTED') {
      throw new BadRequestException('Tài liệu này đã được chấp nhận.');
    }

    return this.prisma.applicationDocument.update({
      where: { id: docId },
      data: {
        status: 'PENDING_REVIEW',
        fileUrl: doc.fileUrl || 'https://placeholder.pawlife.vn/simulated-document.pdf',
        fileName: doc.fileName || 'simulated-document.pdf',
        submittedAt: new Date(),
        rejectionReason: null,
      },
    });
  }
  async submitDocument(
    userId: string,
    applicationId: string,
    docId: string,
    dto: { fileUrl: string; fileName?: string; fileSizeLabel?: string },
  ) {
    const application = await this.prisma.adoptionApplication.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) throw new NotFoundException('Không tìm thấy đơn.');

    const doc = await this.prisma.applicationDocument.findFirst({
      where: { id: docId, applicationId },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu được yêu cầu.');
    if (doc.status === 'ACCEPTED') {
      throw new BadRequestException('Tài liệu này đã được chấp nhận, không thể nộp lại.');
    }

    return this.prisma.applicationDocument.update({
      where: { id: docId },
      data: {
        status: 'PENDING_REVIEW',
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        fileSizeLabel: dto.fileSizeLabel,
        submittedAt: new Date(),
        rejectionReason: null, // nộp lại sau khi bị reject -> xoá lý do cũ
      },
    });
  }

  async reviewDocument(
    shelterId: string,
    applicationId: string,
    docId: string,
    staffId: string,
    dto: { status: 'ACCEPTED' | 'REJECTED'; reason?: string },
  ) {
    const application = await this.assertOwnsApplication(shelterId, applicationId);

    const doc = await this.prisma.applicationDocument.findFirst({
      where: { id: docId, applicationId },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    if (doc.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('Tài liệu này chưa được nộp hoặc đã được duyệt.');
    }

    const updated = await this.prisma.applicationDocument.update({
      where: { id: docId },
      data: {
        status: dto.status,
        rejectionReason: dto.status === 'REJECTED' ? dto.reason ?? null : null,
        reviewedAt: new Date(),
        reviewedById: staffId,
      },
    });

    await this.notificationsService.createAndSendNotification({
      userId: application.userId,
      title: dto.status === 'ACCEPTED' ? '✅ Tài liệu đã được chấp nhận' : '⚠️ Tài liệu bị từ chối',
      body:
        dto.status === 'ACCEPTED'
          ? `Tài liệu "${doc.label}" đã được chấp nhận.`
          : `Tài liệu "${doc.label}" bị từ chối${dto.reason ? `: ${dto.reason}` : '.'}`,
      type: NotificationType.SYSTEM,
      referenceId: application.petId,
      metadata: { applicationId, documentId: docId, status: dto.status },
    });

    return updated;
  }

  async removeDocument(shelterId: string, applicationId: string, docId: string) {
    await this.assertOwnsApplication(shelterId, applicationId);

    const doc = await this.prisma.applicationDocument.findFirst({
      where: { id: docId, applicationId },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');

    await this.prisma.applicationDocument.delete({ where: { id: docId } });
    return { success: true };
  }
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
  // Mọi method dưới đây giờ nhận thêm `shelterId` và gọi
  // assertOwnsApplication() trước khi ghi dữ liệu — FIX lỗ hổng cho phép
  // sửa đơn của shelter khác.
  // ==========================================

  async getShelterApplications(shelterId: string, status?: string) {
    const applications = await this.prisma.adoptionApplication.findMany({
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
            dob: true,
            images: { select: { url: true }, take: 1 },
            shelter: { select: { address: true } },
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
        documents: true, // NEW — để FE tự tính số đã duyệt/tổng, hiển thị badge trên Kanban card
      },
      orderBy: { createdAt: 'desc' },
    });

    return applications;
  }

  async addNote(shelterId: string, applicationId: string, authorId: string, content: string) {
    await this.assertOwnsApplication(shelterId, applicationId);

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

  async addTagToApplication(shelterId: string, applicationId: string, tagId?: string, name?: string) {
    await this.assertOwnsApplication(shelterId, applicationId);

    let resolvedTagId = tagId;

    if (!resolvedTagId && name) {
      let tag = await this.prisma.applicationTag.findFirst({ where: { name } });
      if (!tag) {
        tag = await this.prisma.applicationTag.create({ data: { name } });
      }
      resolvedTagId = tag.id;
    }

    if (!resolvedTagId) {
      throw new BadRequestException('Cần cung cấp tagId hoặc name.');
    }

    return this.prisma.applicationTagOnApplication.upsert({
      where: {
        applicationId_tagId: { applicationId, tagId: resolvedTagId },
      },
      create: { applicationId, tagId: resolvedTagId },
      update: {},
      include: { tag: true },
    });
  }

  async removeTagFromApplication(shelterId: string, applicationId: string, tagId: string) {
    await this.assertOwnsApplication(shelterId, applicationId);

    return this.prisma.applicationTagOnApplication.delete({
      where: {
        applicationId_tagId: { applicationId, tagId },
      },
    });
  }

  async updateApplicationStatus(
    shelterId: string,
    applicationId: string,
    status: any,
    rejectionReason?: string,
  ) {
    await this.assertOwnsApplication(shelterId, applicationId);

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

  async scheduleAppointment(shelterId: string, applicationId: string, dto: ScheduleAppointmentDto) {
    const app = await this.assertOwnsApplication(shelterId, applicationId); // đã include user ở bước trước

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      throw new BadRequestException('Thời gian hẹn không hợp lệ.');
    }

    const duration = dto.durationMinutes ?? 60;
    const endsAt = new Date(scheduledAt.getTime() + duration * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const toHHmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    // applicationId là @unique -> lấy record cũ (nếu có) để biết đang cần TẠO MỚI hay CẬP NHẬT event Meet
    const existing = await this.prisma.appointment.findUnique({ where: { applicationId } });

    let meetLink: string | null = null;
    let googleEventId: string | null = existing?.googleEventId ?? null;

    if (dto.format === 'Online') {
      const attendeeEmails = [app.user?.email, ...dto.members.map((m) => m.email)]
        .filter((e): e is string => !!e);

      try {
        const result = googleEventId
          ? await this.googleMeetService.updateMeetEvent(googleEventId, {
            title: dto.title,
            description: `Phỏng vấn nhận nuôi ${app.pet.name} — đơn #${applicationId}`,
            startAt: scheduledAt,
            endAt: endsAt,
            attendeeEmails,
          })
          : await this.googleMeetService.createMeetEvent({
            title: dto.title,
            description: `Phỏng vấn nhận nuôi ${app.pet.name} — đơn #${applicationId}`,
            startAt: scheduledAt,
            endAt: endsAt,
            attendeeEmails,
          });
        meetLink = result.meetLink;
        googleEventId = result.eventId;
      } catch (err) {
        this.logger.warn(`Tạo/cập nhật Google Meet thất bại cho đơn ${applicationId}`, err as Error);
        meetLink = dto.meetingLink || existing?.meetLink || null; // fallback nếu staff có dán tay
      }
    } else if (googleEventId) {
      // Đổi từ Online -> Offline: dọn event Meet cũ cho sạch calendar
      await this.googleMeetService.cancelMeetEvent(googleEventId).catch(() => { });
      googleEventId = null;
    }

    try {
      const [appointment] = await this.prisma.$transaction([
        this.prisma.appointment.upsert({
          where: { applicationId },
          create: {
            applicationId,
            userId: app.userId,
            shelterId: app.pet.shelterId!,
            petId: app.petId,
            title: dto.title,
            appointmentDate: scheduledAt,
            startTime: toHHmm(scheduledAt),
            endTime: toHHmm(endsAt),
            type: dto.format === 'Online' ? AppointmentType.ONLINE : AppointmentType.IN_PERSON,
            status: AppointmentStatus.PENDING,
            location: dto.format === 'Offline' ? dto.location : null,
            meetLink,
            googleEventId,
            members: dto.members as any,
            reminderMinutesBefore: dto.reminderMinutesBefore ?? 10,
            createdBy: shelterId,
          },
          update: {
            title: dto.title,
            appointmentDate: scheduledAt,
            startTime: toHHmm(scheduledAt),
            endTime: toHHmm(endsAt),
            type: dto.format === 'Online' ? AppointmentType.ONLINE : AppointmentType.IN_PERSON,
            status: AppointmentStatus.PENDING, // đổi lịch -> chờ xác nhận lại
            location: dto.format === 'Offline' ? dto.location : null,
            meetLink,
            googleEventId,
            members: dto.members as any,
            reminderMinutesBefore: dto.reminderMinutesBefore ?? 10,
            reminderSentAt: null, // reset để cron tính lại mốc nhắc mới
          },
        }),
        this.prisma.adoptionApplication.update({
          where: { id: applicationId },
          data: {
            status: ApplicationStatus.INTERVIEW_SCHEDULED,
            ...(dto.reviewNote ? { reviewNote: dto.reviewNote } : {}),
          },
        }),
      ]);

      await this.notificationsService.createAndSendNotification({
        userId: app.userId,
        title: '📅 Lịch phỏng vấn nhận nuôi',
        body: `Trạm đã đặt lịch phỏng vấn cho đơn nhận nuôi ${app.pet.name} vào ${scheduledAt.toLocaleString('vi-VN')}.`,
        type: NotificationType.SYSTEM,
        referenceId: app.petId,
        metadata: { applicationId, appointmentId: appointment.id },
      });

      await this.redisService.del(`pet:detail:${app.petId}`);
      return appointment;
    } catch (err: any) {
      if (err.code === 'P2002' && err.meta?.target?.includes?.('uniq_shelter_slot')) {
        throw new BadRequestException('Khung giờ này trạm đã có lịch hẹn khác, vui lòng chọn giờ khác.');
      }
      throw err;
    }
  }
}