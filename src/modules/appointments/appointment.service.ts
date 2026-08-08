// appointments.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, AppointmentStatus, AppointmentType } from '@prisma/client';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { DelegateBookingDto } from './dto/delegate-booking.dto';

type ActorRole = 'SHELTER' | 'USER';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  private async getApplicationWithGuard(applicationId: string) {
    const app = await this.prisma.adoptionApplication.findUnique({
      where: { id: applicationId },
      include: { pet: true },
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

  async createOrUpsert(actorId: string, actorRole: ActorRole, dto: CreateAppointmentDto) {
    const app = await this.getApplicationWithGuard(dto.applicationId);

    if (actorRole === 'SHELTER' && app.pet.shelterId !== actorId) throw new ForbiddenException();

    const existing = await this.prisma.appointment.findUnique({ where: { applicationId: dto.applicationId } });

    if (actorRole === 'USER') {
      if (app.userId !== actorId) throw new ForbiddenException();
      if (existing && !existing.bookingDelegated) {
        throw new ForbiddenException('Bạn chưa được cấp quyền đặt lịch cho đơn này.');
      }
    }

    const appointment = await this.prisma.appointment.upsert({
      where: { applicationId: dto.applicationId },
      create: {
        applicationId: dto.applicationId,
        userId: app.userId,
        petId: app.petId,
        shelterId: app.pet.shelterId!,
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
      },
    });

    await this.prisma.adoptionApplication.update({
      where: { id: dto.applicationId },
      data: { status: 'INTERVIEW_SCHEDULED' },
    });

    await this.pushRealtime(appointment, actorRole === 'SHELTER' ? 'appointment_created' : 'appointment_booked_by_user');
    return appointment;
  }

  async reschedule(actorId: string, actorRole: ActorRole, appointmentId: string, dto: RescheduleAppointmentDto) {
    const existing = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!existing) throw new NotFoundException();
    this.assertOwnership(existing, actorId, actorRole);

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
      },
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

  async getByApplication(applicationId: string) {
    return this.prisma.appointment.findUnique({ where: { applicationId } });
  }

  async getAvailableSlots(shelterId: string, date: string) {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const booked = await this.prisma.appointment.findMany({
      where: {
        shelterId,
        appointmentDate: { gte: dayStart, lte: dayEnd },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED] },
      },
      select: { startTime: true },
    });
    const bookedSet = new Set(booked.map((b) => b.startTime));

    const slots: { time: string; available: boolean }[] = [];
    for (let h = 9; h < 17; h++) {
      const time = `${h.toString().padStart(2, '0')}:00`;
      slots.push({ time, available: !bookedSet.has(time) });
    }
    return slots;
  }
}