import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto, RescheduleAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';

@Injectable()
export class AppointmentService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy các slot giờ rảnh của Shelter theo ngày
  async getAvailableSlots(shelterId: string, dateStr: string) {
    const targetDate = new Date(dateStr);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        shelterId,
        appointmentDate: targetDate,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      select: { startTime: true },
    });

    const bookedSlots = new Set(existingAppointments.map((a) => a.startTime));
    const defaultSlots = ['08:30', '09:30', '10:30', '14:00', '15:00', '16:00'];

    return defaultSlots.map((slot) => ({
      time: slot,
      available: !bookedSlots.has(slot),
    }));
  }

  // Đặt lịch hẹn mới (Adopter)
  async create(userId: string, dto: CreateAppointmentDto) {
    const application = await this.prisma.adoptionApplication.findUnique({
      where: { id: dto.applicationId },
      include: { pet: true, appointment: true },
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

    return this.prisma.appointment.create({
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
        shelter: { select: { id: true, name: true, phone: true, address: true } },
        pet: { select: { id: true, name: true, avatar: true } },
      },
    });
  }

  // Lấy thông tin lịch hẹn theo applicationId
  async findByApplicationId(applicationId: string) {
    return this.prisma.appointment.findUnique({
      where: { applicationId },
      include: {
        shelter: { select: { id: true, name: true, phone: true, address: true } },
        pet: { select: { id: true, name: true, avatar: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
  }

  // Danh sách lịch hẹn cho phía Shelter
  async findByShelter(shelterId: string, status?: AppointmentStatus) {
    return this.prisma.appointment.findMany({
      where: {
        shelterId,
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        pet: { select: { id: true, name: true, avatar: true } },
        application: { select: { id: true, status: true } },
      },
      orderBy: { appointmentDate: 'asc' },
    });
  }

  // Danh sách lịch hẹn của User
  async findByUser(userId: string) {
    return this.prisma.appointment.findMany({
      where: { userId },
      include: {
        shelter: { select: { id: true, name: true, phone: true, address: true } },
        pet: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { appointmentDate: 'desc' },
    });
  }

  // Cập nhật trạng thái lịch hẹn (Xác nhận/Từ chối bởi Shelter HOẶC Hủy bởi Adopter)
  async updateStatus(id: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn');

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status,
        cancellationReason: dto.cancellationReason,
        location: dto.location || appointment.location,
        notes: dto.notes || appointment.notes,
      },
    });
  }

  // Đổi lịch hẹn
  async reschedule(id: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn');

    const appointmentDate = new Date(dto.appointmentDate);

    const existingSlot = await this.prisma.appointment.findFirst({
      where: {
        shelterId: appointment.shelterId,
        appointmentDate,
        startTime: dto.startTime,
        id: { not: id },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
    });

    if (existingSlot) throw new BadRequestException('Khung giờ mới này đã có người đặt');

    return this.prisma.appointment.update({
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
  }
}