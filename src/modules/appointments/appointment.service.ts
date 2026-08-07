import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto, RescheduleAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentStatus, NotificationType } from '@prisma/client';

@Injectable()
export class AppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // Trạm không có "ownerId" — người quản lý là các User có shelterId trỏ tới trạm này
  private async getShelterUserIds(shelterId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { shelterId },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async notifyUsers(
    userIds: string[],
    title: string,
    body: string,
    event: string,
    payload: Record<string, any>,
  ) {
    for (const uid of userIds) {
      const notification = await this.notificationsService.createAndSendNotification({
        userId: uid,
        title,
        body,
        type: NotificationType.SYSTEM,
        referenceId: payload.appointmentId,
        metadata: payload,
      } as any);

      if (this.notificationsGateway.server) {
        this.notificationsGateway.server.to(`user_${uid}`).emit(event, {
          notification,
          ...payload,
        });
      }
    }
  }

  // 1. Đặt lịch hẹn mới
  async create(userId: string, dto: CreateAppointmentDto) {
    const application = await this.prisma.adoptionApplication.findUnique({
      where: { id: dto.applicationId },
      include: { pet: { include: { shelter: true } }, appointment: true },
    });

    if (!application) throw new NotFoundException('Không tìm thấy đơn nhận nuôi');
    if (application.userId !== userId) throw new ForbiddenException('Bạn không có quyền đặt lịch cho đơn này');
    if (application.appointment) throw new BadRequestException('Đơn nhận nuôi này đã có lịch hẹn');

    const shelterId = application.pet?.shelterId;
    if (!shelterId) throw new BadRequestException('Pet này chưa thuộc trạm cứu hộ nào, không thể đặt lịch');

    const appointmentDate = new Date(dto.appointmentDate);

    const existingSlot = await this.prisma.appointment.findFirst({
      where: {
        shelterId,
        appointmentDate,
        startTime: dto.startTime,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
    });
    if (existingSlot) {
      throw new BadRequestException('Khung giờ này đã được đặt, vui lòng chọn giờ khác');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        applicationId: dto.applicationId,
        userId,
        shelterId,
        petId: application.petId,
        appointmentDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        type: dto.type || 'IN_PERSON',
        notes: dto.notes,
        location: application.pet?.shelter?.address || application.pet?.contactAddress || 'Tại trạm cứu hộ',
        status: AppointmentStatus.PENDING,
      },
      include: {
        pet: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    const shelterUserIds = await this.getShelterUserIds(shelterId);
    await this.notifyUsers(
      shelterUserIds,
      'Yêu cầu lịch hẹn mới',
      `${appointment.user?.name ?? 'Người dùng'} vừa đặt lịch hẹn phỏng vấn cho bé ${appointment.pet?.name ?? ''}`,
      'notification',
      { appointmentId: appointment.id, applicationId: appointment.applicationId },
    );

    return appointment;
  }

  // 2. Cập nhật trạng thái lịch hẹn
  async updateStatus(id: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        pet: { select: { name: true } },
        shelter: { select: { name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn');

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status,
        cancellationReason: dto.cancellationReason,
        location: dto.location || appointment.location,
        notes: dto.notes || appointment.notes,
      },
    });

    const statusTextMap: Record<string, string> = {
      CONFIRMED: 'đã được Trạm cứu hộ XÁC NHẬN',
      REJECTED: 'đã bị TRẠM CỨU HỘ TỪ CHỐI',
      CANCELLED: 'đã BỊ HỦY',
      COMPLETED: 'đã HOÀN THÀNH',
    };

    await this.notifyUsers(
      [updated.userId],
      'Cập nhật lịch hẹn phỏng vấn',
      `Lịch hẹn phỏng vấn bé ${appointment.pet?.name ?? ''} ${statusTextMap[dto.status] || 'được cập nhật'}`,
      'appointment_status_changed',
      { appointmentId: updated.id, applicationId: updated.applicationId, status: updated.status },
    );

    return updated;
  }

  // 3. Đổi lịch hẹn
  async reschedule(id: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn');

    const appointmentDate = new Date(dto.appointmentDate);

    const existingSlot = await this.prisma.appointment.findFirst({
      where: {
        id: { not: id },
        shelterId: appointment.shelterId,
        appointmentDate,
        startTime: dto.startTime,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
    });
    if (existingSlot) {
      throw new BadRequestException('Khung giờ này đã được đặt, vui lòng chọn giờ khác');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        appointmentDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        type: dto.type || appointment.type,
        notes: dto.notes || appointment.notes,
        status: AppointmentStatus.RESCHEDULED,
      },
    });

    const shelterUserIds = await this.getShelterUserIds(updated.shelterId);
    await this.notifyUsers(
      [...shelterUserIds, updated.userId],
      'Lịch hẹn đã được đổi giờ',
      'Một lịch hẹn phỏng vấn vừa được đổi sang thời gian mới.',
      'appointment_rescheduled',
      { appointmentId: updated.id, applicationId: updated.applicationId },
    );

    return updated;
  }

  // 4. Xem chi tiết lịch hẹn theo đơn nhận nuôi
  async findByApplicationId(applicationId: string) {
    return this.prisma.appointment.findUnique({
      where: { applicationId },
      include: {
        pet: { select: { id: true, name: true } },
        shelter: { select: { id: true, name: true, address: true } },
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  // 5. Danh sách lịch hẹn của 1 user (adopter)
  async findByUser(userId: string) {
    return this.prisma.appointment.findMany({
      where: { userId },
      orderBy: { appointmentDate: 'desc' },
      include: {
        pet: { select: { id: true, name: true } },
        shelter: { select: { id: true, name: true, address: true } },
      },
    });
  }

  // 6. Danh sách lịch hẹn của 1 shelter
  async findByShelter(shelterId: string, status?: AppointmentStatus) {
    return this.prisma.appointment.findMany({
      where: { shelterId, ...(status ? { status } : {}) },
      orderBy: { appointmentDate: 'asc' },
      include: {
        pet: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      },
    });
  }

  // 7. Khung giờ còn trống trong ngày
  async getAvailableSlots(shelterId: string, date: string) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const bookedAppointments = await this.prisma.appointment.findMany({
      where: {
        shelterId,
        appointmentDate: { gte: dayStart, lte: dayEnd },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      select: { startTime: true },
    });

    // Khung giờ làm việc mặc định 08:00–17:00, mỗi slot 1 giờ (nghỉ trưa 12:00–13:00)
    const allSlots = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
    const bookedStartTimes = new Set(bookedAppointments.map((a) => a.startTime));

    return allSlots
      .filter((slot) => !bookedStartTimes.has(slot))
      .map((slot) => ({ startTime: slot }));
  }
}