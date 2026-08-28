// src/modules/applications/applications.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { RedisService } from '../../database/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppointmentType, AppointmentStatus, ApplicationStatus, Role, NotificationType, ApplicationNoteType, DocumentCategory } from '@prisma/client';
import { ScheduleAppointmentDto } from './dto/schedule-appointment.dto';
import { GoogleMeetService } from '../google-meet/google-meet.service';
import { renderInterviewConfirmationEmail } from './templates/interview-confirmation.template';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleMeetService: GoogleMeetService,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
    private readonly mailerService: MailerService,
  ) { }

  // FIX BẢO MẬT: helper dùng chung để xác nhận đơn thuộc đúng shelter đang
  // gọi API — bắt buộc gọi trước mọi thao tác ghi (notes/tags/status/appointments)
  // ở phần "LUỒNG SHELTER" bên dưới.
  private async assertOwnsApplication(shelterId: string, applicationId: string) {
    const application = await this.prisma.adoptionApplication.findUnique({
      where: { id: applicationId },
      include: {
        pet: { include: { shelter: true } },
        user: { select: { id: true, email: true, name: true, avatarUrl: true } }, // thêm dòng này
      },
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
    items: { key: string; label: string; description: string; category: DocumentCategory }[],
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
            category: d.category,
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

  async getShelterApplications(
    shelterId: string,
    status?: string,
    noteTypes?: string[], // 🆕
  ) {
    const applications = await this.prisma.adoptionApplication.findMany({
      where: {
        pet: { shelterId },
        ...(status ? { status: status as any } : {}),
        ...(noteTypes && noteTypes.length > 0
          ? { notes: { some: { type: { in: noteTypes as any } } } }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
        pet: {
          select: {
            id: true, name: true, breed: true, gender: true, dob: true,
            images: { select: { url: true }, take: 1 },
            shelter: { select: { address: true } },
          },
        },
        notes: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        tags: { include: { tag: true } },
        appointment: true,
        documents: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return applications;
  }

  async addNote(shelterId: string, applicationId: string, authorId: string, content: string, type: ApplicationNoteType) {
    await this.assertOwnsApplication(shelterId, applicationId);

    return this.prisma.applicationNote.create({
      data: {
        applicationId,
        authorId,
        content,
        type,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }
  async updateNote(
    shelterId: string,
    applicationId: string,
    noteId: string,
    content: string,
    type: ApplicationNoteType,
  ) {
    await this.assertOwnsApplication(shelterId, applicationId);

    const note = await this.prisma.applicationNote.findFirst({
      where: { id: noteId, applicationId },
    });
    if (!note) throw new NotFoundException('Không tìm thấy ghi chú.');

    return this.prisma.applicationNote.update({
      where: { id: noteId },
      data: { content, type },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async deleteNote(shelterId: string, applicationId: string, noteId: string) {
    await this.assertOwnsApplication(shelterId, applicationId);

    const note = await this.prisma.applicationNote.findFirst({
      where: { id: noteId, applicationId },
    });
    if (!note) throw new NotFoundException('Không tìm thấy ghi chú.');

    await this.prisma.applicationNote.delete({ where: { id: noteId } });
    return { success: true };
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
    const application = await this.assertOwnsApplication(shelterId, applicationId);

    const updated = await this.prisma.adoptionApplication.update({
      where: { id: applicationId },
      data: {
        status,
        ...(rejectionReason ? { reviewNote: rejectionReason } : {}),
      },
    });

    // 🆕 Khi đơn được đánh dấu hoàn tất nhận nuôi -> chuyển quyền sở hữu pet
    // sang applicant, để "Current Pet" trong Applicant Profile nhận diện đúng
    if (status === 'ADOPTION_COMPLETED') {
      await this.prisma.pet.update({
        where: { id: application.petId },
        data: {
          ownerId: application.userId,
          status: 'ADOPTED',
          adoptedAt: new Date(),
        },
      });
      // Xoá cache pet detail vì owner/status vừa đổi
      await this.redisService.del(`pet:detail:${application.petId}`);
    }

    await this.redisService.del(`pet:detail:${updated.petId}`);
    return updated;
  }
  async generateQuickMeetLink() {
    try {
      const event = await this.googleMeetService.createMeetEvent({
        title: 'Phỏng vấn nhận nuôi',
        description: 'Phòng họp phỏng vấn nhận nuôi thú cưng',
        startAt: new Date(Date.now() + 30 * 60 * 1000),
        endAt: new Date(Date.now() + 90 * 60 * 1000),
      });
      return { meetLink: event.meetLink };
    } catch (err: any) {
      this.logger.warn(`Tạo Google Meet tự động thất bại (Client Secret sai): ${err?.message || err}`);
      // Fallback an toàn: Trả về link Google Meet để Frontend không bị lỗi 500 hay rỗng input
      return { meetLink: 'https://meet.google.com/new' };
    }
  }
  async getPostAdoptionRecords(shelterId: string) {
    const applications = await this.prisma.adoptionApplication.findMany({
      where: {
        pet: { shelterId },
        status: 'ADOPTION_COMPLETED',
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            breed: true,
            gender: true,
            adoptedAt: true,
            images: { select: { url: true }, take: 1 },
          },
        },
        user: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return applications.map((a) => ({
      id: a.id,
      petId: a.petId,
      petName: a.pet.name,
      petImage: a.pet.images[0]?.url ?? null,
      petGender: a.pet.gender,
      breed: a.pet.breed, // Json song ngữ {vi,en} — FE tự resolve locale
      adopterName: a.fullName || a.user.name || 'N/A',
      // adoptedAt được set chính xác lúc chuyển ADOPTION_COMPLETED trong updateApplicationStatus
      adoptionDate: a.pet.adoptedAt ?? a.updatedAt,
      nextFollowUpDate: a.nextFollowUpDate,
    }));
  }

  async updateNextFollowUpDate(
    shelterId: string,
    applicationId: string,
    nextFollowUpDate: Date | null,
  ) {
    const application = await this.assertOwnsApplication(shelterId, applicationId);

    if (application.status !== 'ADOPTION_COMPLETED') {
      throw new BadRequestException(
        'Chỉ có thể đặt lịch tái khám cho đơn đã hoàn tất nhận nuôi.',
      );
    }

    return this.prisma.adoptionApplication.update({
      where: { id: applicationId },
      data: { nextFollowUpDate },
    });
  }
  async getApplicantProfile(shelterId: string, applicationId: string) {
    // Xác nhận đơn này thuộc shelter đang gọi API, đồng thời lấy userId của applicant
    const baseApp = await this.assertOwnsApplication(shelterId, applicationId);
    const userId = baseApp.userId;

    // Toàn bộ đơn của applicant này — CHỈ trong phạm vi shelter hiện tại (không lộ chéo shelter)
    const applications = await this.prisma.adoptionApplication.findMany({
      where: { userId, pet: { shelterId } },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            status: true,
            images: { select: { url: true }, take: 1 },
            shelter: { select: { id: true, name: true } },
          },
        },
        appointment: { select: { appointmentDate: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeApplications = applications.filter(
      (a) => !['CLOSED', 'ADOPTION_COMPLETED'].includes(a.status),
    );
    const adoptionHistory = applications.filter(
      (a) => a.status === 'ADOPTION_COMPLETED',
    );

    // Pet mà applicant đang sở hữu, đến từ chính shelter này
    const currentPets = await this.prisma.pet.findMany({
      where: { ownerId: userId, shelterId },
      select: {
        id: true,
        name: true,
        status: true,
        images: { select: { url: true }, take: 1 },
        qrVerificationStatus: true,
        idSetByShelter: true,
      },
    });

    // Note trải trên mọi đơn của applicant này tại shelter hiện tại
    const notes = await this.prisma.applicationNote.findMany({
      where: { application: { userId, pet: { shelterId } } },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, email: true, avatarUrl: true },
    });

    const mapAppSummary = (a: (typeof applications)[number]) => ({
      id: a.id,
      status: a.status,
      createdAt: a.createdAt,
      pet: {
        id: a.pet.id,
        name: a.pet.name,
        avatarUrl: a.pet.images?.[0]?.url ?? null,
      },
      shelterName: a.pet.shelter?.name ?? null,
    });

    return {
      applicant: {
        id: user!.id,
        fullName: baseApp.fullName || user!.name || 'N/A',
        phone: baseApp.phone || user!.phone || '',
        email: user!.email,
        avatarUrl: user!.avatarUrl,
      },
      stats: {
        activeApplications: activeApplications.length,
        successfulAdoptions: adoptionHistory.length,
        totalApplications: applications.length,
      },
      activeApplications: activeApplications.map(mapAppSummary),
      adoptionHistory: adoptionHistory.map(mapAppSummary),
      currentPets: currentPets.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        avatarUrl: p.images?.[0]?.url ?? null,
        qrVerificationStatus: p.qrVerificationStatus,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        content: n.content,
        type: n.type,
        createdAt: n.createdAt,
        author: n.author,
      })),
    };
  }
  async scheduleAppointment(shelterId: string, applicationId: string, dto: ScheduleAppointmentDto) {
    const app = await this.assertOwnsApplication(shelterId, applicationId);

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      throw new BadRequestException('Thời gian hẹn không hợp lệ.');
    }

    const duration = dto.durationMinutes ?? 60;
    const endsAt = new Date(scheduledAt.getTime() + duration * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const toHHmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const existing = await this.prisma.appointment.findUnique({ where: { applicationId } });

    let meetLink: string | null = null;
    let googleEventId: string | null = existing?.googleEventId ?? null;

    // 👇 MỚI: gom email hợp lệ từ danh sách thành viên
    const attendeeEmails = (dto.members || [])
      .map((m) => m.email?.trim())
      .filter((e): e is string => !!e && /\S+@\S+\.\S+/.test(e));

    if (dto.format === 'Online') {
      // 👇 BỎ nhánh "dùng lại link FE gửi lên" — luôn tạo/cập nhật thật theo giờ hẹn + email thành viên
      try {
        const result = googleEventId
          ? await this.googleMeetService.updateMeetEvent(googleEventId, {
            title: dto.title,
            description: `Phỏng vấn nhận nuôi ${app.pet.name} — đơn #${applicationId}`,
            startAt: scheduledAt,
            endAt: endsAt,
            attendeeEmails, // 👈 mới
          })
          : await this.googleMeetService.createMeetEvent({
            title: dto.title,
            description: `Phỏng vấn nhận nuôi ${app.pet.name} — đơn #${applicationId}`,
            startAt: scheduledAt,
            endAt: endsAt,
            attendeeEmails, // 👈 mới
          });
        meetLink = result.meetLink;
        googleEventId = result.eventId;
      } catch (err) {
        this.logger.warn(`Tạo/cập nhật Google Meet thất bại cho đơn ${applicationId}`, err as Error);
        meetLink = existing?.meetLink || null; // fallback: giữ link cũ nếu có, không dùng dto.meetingLink nữa
      }
    } else if (googleEventId) {
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
            status: dto.completed ? AppointmentStatus.COMPLETED : AppointmentStatus.PENDING,
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
            status: dto.completed ? AppointmentStatus.COMPLETED : AppointmentStatus.PENDING, // đổi lịch -> chờ xác nhận lại
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

      if (!app.pet.shelter) {
        this.logger.warn(`Đơn ${applicationId} có pet không gắn shelter — bỏ qua gửi email xác nhận.`);
        await this.redisService.del(`pet:detail:${app.petId}`);
        return appointment;
      }

      const { subject, html } = renderInterviewConfirmationEmail({
        adopterName: app.fullName || app.user.name || 'Người nhận nuôi',
        petName: app.pet.name,
        shelterName: app.pet.shelter.name,
        appointmentDate: scheduledAt.toLocaleDateString('vi-VN'),
        appointmentTime: toHHmm(scheduledAt),
        isOnline: dto.format === 'Online',
        shelterAddress: dto.location || app.pet.shelter.address,
        googleMeetLink: meetLink || undefined,
        shelterPhone: app.pet.shelter.contactInfo,
        shelterEmail: app.pet.shelter.emailAddress || undefined,
      });

      if (app.user.email) {
        this.mailerService
          .sendMail({ to: app.user.email, subject, html })
          .catch((err) =>
            this.logger.warn(`Gửi email xác nhận phỏng vấn thất bại cho ${app.user.email}`, err),
          );
      }

      // Gửi cho từng thành viên trạm có email được phân công
      for (const email of attendeeEmails) {
        this.mailerService
          .sendMail({ to: email, subject: `[Nội bộ] ${subject}`, html })
          .catch((err) => this.logger.warn(`Gửi email nội bộ thất bại cho ${email}`, err));
      }


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