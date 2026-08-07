import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service'; // Hoặc DatabaseService của bạn
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto, RescheduleAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class AppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    // Inject trực tiếp NotificationsService & NotificationsGateway (do NotificationsModule là @Global)
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // 1. Đặt lịch hẹn mới (Adopter tạo -> Gửi Realtime + Lưu Thông báo cho Shelter)
  async create(userId: string, dto: CreateAppointmentDto) {
    const application = await this.prisma.adoptionApplication.findUnique({
      where: { id: dto.applicationId },
      include: { pet: true, appointment: true, shelter: true },
    });

    if (!application) throw new NotFoundException('Không tìm thấy đơn nhận nuôi');
    if (application.userId !== userId) throw new ForbiddenException('Bạn không có quyền đặt lịch cho đơn này');
    if (application.appointment) throw new BadRequestException('Đơn nhận nuôi này đã có lịch hẹn');

    const appointmentDate = new Date(dto.appointmentDate);

    // Kiểm tra trùng slot
    const existingSlot = await this.prisma.appointment.findFirst({
      where: {
        shelterId: application.shelterId,
        appointmentDate,
        startTime: dto.startTime,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
    });

    if (existingSlot) {
      throw new BadRequestException('Khung giờ này đã được đặt, vui lòng chọn giờ khác');
    }

    // Lưu cuộc hẹn vào DB
    const appointment = await this.prisma.appointment.create({
      data: {
        applicationId: dto.applicationId,
        userId,
        shelterId: application.shelterId,
        petId: application.petId,
        appointmentDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        type: dto.type || 'IN_PERSON',
        notes: dto.notes,
        location: application.pet?.shelterAddress || 'Tại trạm cứu hộ',
        status: AppointmentStatus.PENDING,
      },
      include: {
        pet: { select: { name: true } },
        user: { select: { name: true } },
        shelter: { select: { ownerId: true } }, // Hoặc userId của người quản lý trạm
      },
    });

    // ───────────────────────────────────────────────────────────
    // TÍCH HỢP NOTIFICATION & REALTIME
    // ───────────────────────────────────────────────────────────
    const shelterOwnerId = appointment.shelter.ownerId || appointment.shelterId;
    const notiTitle = 'Yêu cầu lịch hẹn mới';
    const notiContent = `${appointment.user.name} vừa đặt lịch hẹn phỏng vấn cho bé ${appointment.pet.name}`;

    // A. Lưu thông báo vào CSDL
    const notification = await this.notificationsService.create({
      userId: shelterOwnerId,
      title: notiTitle,
      content: notiContent,
      type: 'APPOINTMENT',
    });

    // B. Gửi Realtime Socket tới Shelter
    // (Tùy theo tên hàm trong NotificationsGateway của bạn, VD: sendToUser hoặc emit)
    if (this.notificationsGateway.server) {
      this.notificationsGateway.server
        .to(`user_${shelterOwnerId}`)
        .emit('notification', {
          notification,
          appointmentId: appointment.id,
          applicationId: appointment.applicationId,
        });
    }

    return appointment;
  }

  // 2. Cập nhật trạng thái lịch hẹn (Shelter Duyệt/Từ chối HOẶC Adopter Hủy)
  async updateStatus(id: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        pet: { select: { name: true } },
        shelter: { select: { name: true, ownerId: true } },
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

    // ───────────────────────────────────────────────────────────
    // TÍCH HỢP NOTIFICATION & REALTIME NGƯỢC LẠI
    // ───────────────────────────────────────────────────────────
    // Nếu Shelter cập nhật -> Gửi cho Adopter (userId)
    // Nếu Adopter hủy -> Gửi cho Shelter (shelterOwnerId)
    const targetUserId = updated.userId;

    const notiTitle = 'Cập nhật lịch hẹn phỏng vấn';
    const statusTextMap = {
      CONFIRMED: 'đã được Trạm cứu hộ XÁC NHẬN',
      REJECTED: 'đã bị TRẠM CỨU HỘ TỪ CHỐI',
      CANCELLED: 'đã BỊ HỦY',
      COMPLETED: 'đã HOÀN THÀNH',
    };

    const notiContent = `Lịch hẹn phỏng vấn bé ${appointment.pet.name} ${
      statusTextMap[dto.status] || 'được cập nhật'
    }`;

    // A. Lưu thông báo vào CSDL
    const notification = await this.notificationsService.create({
      userId: targetUserId,
      title: notiTitle,
      content: notiContent,
      type: 'APPOINTMENT',
    });

    // B. Gửi Socket Realtime tới Adopter
    if (this.notificationsGateway.server) {
      this.notificationsGateway.server
        .to(`user_${targetUserId}`)
        .emit('appointment_status_changed', {
          notification,
          appointmentId: updated.id,
          applicationId: updated.applicationId,
          status: updated.status,
        });
    }

    return updated;
  }
}