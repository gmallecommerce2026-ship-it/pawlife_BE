import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, AppointmentStatus, AppointmentType } from '@prisma/client';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { DelegateBookingDto } from './dto/delegate-booking.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { SetMeetLinkDto } from './dto/set-meet-link.dto';

type ActorRole = 'SHELTER' | 'USER';

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
];

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly notifications: NotificationsService,
  ) { }

  private async getApplicationWithGuard(applicationId: string) {
    const app = await this.prisma.adoptionApplication.findUnique({
      where: { id: applicationId },
      include: { pet: { include: { shelter: true } } },
    });
    if (!app) throw new NotFoundException('Không tìm thấy đơn nhận nuôi.');
    return app;
  }

  private assertOwnership(appt: { shelterId: string; userId: string }, actorId: string, role: ActorRole) {
    if (role === 'SHELTER' && appt.shelterId !== actorId) throw new ForbiddenException();
    if (role === 'USER' && appt.userId !== actorId) throw new ForbiddenException();
  }

  private async pushRealtime(appointment: any, event: string) {
    await this.gateway.notifyUserSmartly(appointment.userId, event, appointment);
    this.gateway.server.to(`shelter_${appointment.shelterId}`).emit(event, appointment);
  }

  private assertNotInPast(dateStr: string, startTime: string) {
    const [h, m] = startTime.split(':').map(Number);
    const target = new Date(`${dateStr}T00:00:00`);
    target.setHours(h ?? 0, m ?? 0, 0, 0);
    if (target.getTime() < Date.now()) {
      throw new BadRequestException('Không thể đặt lịch cho thời điểm trong quá khứ.');
    }
  }

  /** Đọc giờ mở cửa thật của shelter, fallback 9h-17h nếu chưa cấu hình. */
  private resolveOpeningHours(shelter: { openingHours: any }, date: Date) {
    const DEFAULT = { open: '09:00', close: '17:00' };
    const oh = shelter?.openingHours as any;
    if (!oh) return DEFAULT;

    // hỗ trợ 2 dạng: { open, close } áp cho mọi ngày, hoặc { mon: {...}, tue: {...} }
    if (oh.open && oh.close) return oh;

    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const key = dayKeys[date.getDay()];
    return oh[key] ?? null; // null nghĩa là shelter đóng cửa ngày đó
  }

  async createOrUpsert(actorId: string, actorRole: ActorRole, dto: CreateAppointmentDto) {
    const app = await this.getApplicationWithGuard(dto.applicationId);
    const shelterId = app.pet.shelterId!;

    if (actorRole === 'SHELTER' && shelterId !== actorId) throw new ForbiddenException();

    const existing = await this.prisma.appointment.findUnique({ where: { applicationId: dto.applicationId } });

    if (actorRole === 'USER') {
      if (app.userId !== actorId) throw new ForbiddenException();
      if (existing && !existing.bookingDelegated) {
        throw new ForbiddenException('Bạn chưa được cấp quyền đặt lịch cho đơn này.');
      }
    }

    this.assertNotInPast(dto.appointmentDate, dto.startTime);

    // Chống double-book: kiểm tra trong transaction trước khi tạo/sửa
    const appointment = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          shelterId,
          appointmentDate: new Date(dto.appointmentDate),
          startTime: dto.startTime,
          status: { in: ACTIVE_STATUSES },
          NOT: existing ? { id: existing.id } : undefined,
        },
      });
      if (conflict) throw new ConflictException('Khung giờ này vừa được đặt, vui lòng chọn giờ khác.');

      return tx.appointment.upsert({
        where: { applicationId: dto.applicationId },
        create: {
          applicationId: dto.applicationId,
          userId: app.userId,
          petId: app.petId,
          shelterId,
          appointmentDate: new Date(dto.appointmentDate),
          startTime: dto.startTime,
          endTime: dto.endTime,
          type: dto.type ?? AppointmentType.IN_PERSON,
          location: dto.location,
          notes: dto.notes,
          status: AppointmentStatus.PENDING,
          createdBy: actorId,
        },
        update: {
          appointmentDate: new Date(dto.appointmentDate),
          startTime: dto.startTime,
          endTime: dto.endTime,
          type: dto.type ?? AppointmentType.IN_PERSON,
          location: dto.location,
          notes: dto.notes,
          status: AppointmentStatus.RESCHEDULED,
          meetLink: null, // đổi lịch thì link Meet cũ (nếu có) không còn hợp lệ
        },
      });
    });

    await this.prisma.adoptionApplication.update({
      where: { id: dto.applicationId },
      data: { status: 'INTERVIEW_SCHEDULED' },
    });

    const event = actorRole === 'SHELTER' ? 'appointment_created' : 'appointment_booked_by_user';

    if (actorRole === 'USER') {
      // báo cho shelter: cần vào set meet link / xác nhận
      await this.notifications.createAndSendNotification({
        userId: app.userId, // tuỳ hệ thống notify shelter theo user quản lý, service transfer xử lý tương tự
        title: '📅 Lịch phỏng vấn đã được đặt',
        body: `Bạn đã đặt lịch phỏng vấn cho ${app.pet.name}.`,
        type: NotificationType.SYSTEM,
        referenceId: appointment.id,
        metadata: { uiAction: 'open_interview_detail', applicationId: dto.applicationId },
      });
    } else {
      await this.notifications.createAndSendNotification({
        userId: app.userId,
        title: '📅 Trạm cứu hộ đã lên lịch phỏng vấn',
        body: `Lịch phỏng vấn cho ${app.pet.name} đã được xếp.`,
        type: NotificationType.SYSTEM,
        referenceId: appointment.id,
        metadata: { uiAction: 'open_interview_detail', applicationId: dto.applicationId },
      });
    }

    await this.pushRealtime(appointment, event);
    return appointment;
  }
  async getUpcomingInterviewForUser(userId: string) {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        userId,
        type: AppointmentType.ONLINE,
        status: { in: ACTIVE_STATUSES },
        appointmentDate: { gte: todayStart, lte: todayEnd },
      },
      include: {
        pet: { select: { name: true } },
        shelter: { select: { name: true, avatarUrl: true } },
      },
    });

    const WINDOW_MS = 10 * 60 * 1000;

    const candidate = appointments.find((appt) => {
      const [sh, sm] = appt.startTime.split(':').map(Number);
      const start = new Date(appt.appointmentDate);
      start.setHours(sh || 0, sm || 0, 0, 0);

      const [eh, em] = appt.endTime.split(':').map(Number);
      const end = new Date(appt.appointmentDate);
      end.setHours(eh || 0, em || 0, 0, 0);

      const startsWithinWindow = start.getTime() - now.getTime() <= WINDOW_MS;
      const notEndedYet = end.getTime() > now.getTime();
      return startsWithinWindow && notEndedYet;
    });

    if (!candidate) return null;

    const [sh, sm] = candidate.startTime.split(':').map(Number);
    const start = new Date(candidate.appointmentDate);
    start.setHours(sh || 0, sm || 0, 0, 0);

    return {
      id: candidate.id,
      petName: candidate.pet.name,
      shelterName: candidate.shelter.name,
      shelterAvatar: candidate.shelter.avatarUrl,
      startAt: start.toISOString(), // FE tự tính countdown từ mốc này, không hardcode "10 phút" nữa
      meetLink: candidate.meetLink,
    };
  }
  async reschedule(actorId: string, actorRole: ActorRole, appointmentId: string, dto: RescheduleAppointmentDto) {
    const existing = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!existing) throw new NotFoundException();
    this.assertOwnership(existing, actorId, actorRole);

    if (dto.appointmentDate && dto.startTime) {
      this.assertNotInPast(dto.appointmentDate, dto.startTime);

      const conflict = await this.prisma.appointment.findFirst({
        where: {
          shelterId: existing.shelterId,
          appointmentDate: new Date(dto.appointmentDate),
          startTime: dto.startTime,
          status: { in: ACTIVE_STATUSES },
          NOT: { id: existing.id },
        },
      });
      if (conflict) throw new ConflictException('Khung giờ này vừa được đặt, vui lòng chọn giờ khác.');
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(dto.appointmentDate && { appointmentDate: new Date(dto.appointmentDate) }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime && { endTime: dto.endTime }),
        ...(dto.type && { type: dto.type }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        status: AppointmentStatus.RESCHEDULED,
        meetLink: null,
      },
    });

    await this.notifications.createAndSendNotification({
      userId: existing.userId,
      title: '🔁 Lịch phỏng vấn đã được đổi',
      body: 'Vui lòng kiểm tra lại thời gian phỏng vấn mới.',
      type: NotificationType.SYSTEM,
      referenceId: updated.id,
      metadata: { uiAction: 'open_interview_detail', applicationId: existing.applicationId },
    });

    await this.pushRealtime(updated, 'appointment_updated');
    return updated;
  }

  async updateStatus(actorId: string, actorRole: ActorRole, appointmentId: string, dto: UpdateAppointmentStatusDto) {
    const existing = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!existing) throw new NotFoundException();
    this.assertOwnership(existing, actorId, actorRole);

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: dto.status, notes: dto.cancellationReason ?? existing.notes },
    });

    await this.pushRealtime(updated, dto.status === AppointmentStatus.CANCELLED ? 'appointment_cancelled' : 'appointment_updated');
    return updated;
  }

  async cancel(actorId: string, actorRole: ActorRole, appointmentId: string, dto: CancelAppointmentDto) {
    const existing = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!existing) throw new NotFoundException();
    this.assertOwnership(existing, actorId, actorRole);

    if (['CANCELLED', 'COMPLETED', 'REJECTED'].includes(existing.status)) {
      throw new BadRequestException('Lịch hẹn này không thể hủy.');
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELLED, cancellationReason: dto.cancellationReason },
    });

    await this.notifications.createAndSendNotification({
      userId: existing.userId,
      title: '❌ Lịch phỏng vấn đã bị hủy',
      body: dto.cancellationReason || 'Lịch phỏng vấn đã được hủy.',
      type: NotificationType.SYSTEM,
      referenceId: updated.id,
      metadata: { uiAction: 'open_interview_detail', applicationId: existing.applicationId },
    });

    await this.pushRealtime(updated, 'appointment_cancelled');
    return updated;
  }

  /** Shelter cập nhật link Google Meet thật sau khi tạo phòng họp. */
  async setMeetLink(shelterId: string, appointmentId: string, dto: SetMeetLinkDto) {
    const existing = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!existing) throw new NotFoundException();
    if (existing.shelterId !== shelterId) throw new ForbiddenException();
    if (existing.type !== AppointmentType.ONLINE) {
      throw new BadRequestException('Chỉ lịch phỏng vấn Online mới có link Meet.');
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { meetLink: dto.meetLink },
    });

    await this.notifications.createAndSendNotification({
      userId: existing.userId,
      title: '🔗 Link Google Meet đã sẵn sàng',
      body: 'Trạm cứu hộ đã thêm link phỏng vấn online cho bạn.',
      type: NotificationType.SYSTEM,
      referenceId: updated.id,
      metadata: { uiAction: 'open_interview_detail', applicationId: existing.applicationId },
    });

    await this.pushRealtime(updated, 'appointment_meet_link_updated');
    return updated;
  }

  async delegateBooking(shelterId: string, applicationId: string, dto: DelegateBookingDto) {
    const app = await this.getApplicationWithGuard(applicationId);
    if (app.pet.shelterId !== shelterId) throw new ForbiddenException();

    const appointment = await this.prisma.appointment.upsert({
      where: { applicationId },
      create: {
        applicationId,
        userId: app.userId,
        petId: app.petId,
        shelterId,
        appointmentDate: new Date(),
        startTime: '00:00',
        endTime: '00:00',
        type: AppointmentType.IN_PERSON,
        status: AppointmentStatus.PENDING,
        bookingDelegated: dto.delegated,
        createdBy: shelterId,
      },
      update: { bookingDelegated: dto.delegated },
    });

    await this.notifications.createAndSendNotification({
      userId: app.userId,
      title: '📅 Bạn có thể tự chọn lịch phỏng vấn',
      body: `Trạm cứu hộ đã cho phép bạn tự đặt lịch phỏng vấn cho ${app.pet.name}.`,
      type: NotificationType.SYSTEM,
      referenceId: applicationId,
      metadata: { uiAction: 'open_booking_modal', applicationId },
    });

    await this.gateway.notifyUserSmartly(app.userId, 'booking_delegated', { applicationId, delegated: dto.delegated });
    return appointment;
  }

  async getById(appointmentId: string) {
    const appt = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt) throw new NotFoundException();
    return appt;
  }

  async getByApplication(applicationId: string) {
    return this.prisma.appointment.findUnique({ where: { applicationId } });
  }

  async getAvailableSlots(shelterId: string, date: string) {
    if (!date) throw new BadRequestException('Thiếu tham số date.');

    const shelter = await this.prisma.shelter.findUnique({ where: { id: shelterId } });
    if (!shelter) throw new NotFoundException('Không tìm thấy trạm cứu hộ.');

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const hours = this.resolveOpeningHours(shelter, dayStart);
    if (!hours) return []; // shelter đóng cửa ngày này

    const booked = await this.prisma.appointment.findMany({
      where: {
        shelterId,
        appointmentDate: { gte: dayStart, lte: dayEnd },
        status: { in: ACTIVE_STATUSES },
      },
      select: { startTime: true },
    });
    const bookedSet = new Set(booked.map((b) => b.startTime));

    const [openH] = hours.open.split(':').map(Number);
    const [closeH] = hours.close.split(':').map(Number);

    const isToday = dayStart.toDateString() === new Date().toDateString();
    const currentHour = new Date().getHours();

    const slots: { time: string; available: boolean }[] = [];
    for (let h = openH; h < closeH; h++) {
      const time = `${h.toString().padStart(2, '0')}:00`;
      const isPast = isToday && h <= currentHour;
      slots.push({ time, available: !bookedSet.has(time) && !isPast });
    }
    return slots;
  }
}