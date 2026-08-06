import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto, RescheduleAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentStatus } from '@prisma/client';
import { AppointmentService } from './appointment.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Get('shelter/:shelterId/available-slots')
  getAvailableSlots(
    @Param('shelterId') shelterId: string,
    @Query('date') date: string,
  ) {
    return this.appointmentService.getAvailableSlots(shelterId, date);
  }

  @Get('application/:applicationId')
  getByApplication(@Param('applicationId') applicationId: string) {
    return this.appointmentService.findByApplicationId(applicationId);
  }

  @Get('my-appointments')
  getMyAppointments(@Request() req) {
    return this.appointmentService.findByUser(req.user.id);
  }

  @Get('shelter/:shelterId')
  getShelterAppointments(
    @Param('shelterId') shelterId: string,
    @Query('status') status?: AppointmentStatus,
  ) {
    return this.appointmentService.findByShelter(shelterId, status);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateAppointmentDto) {
    return this.appointmentService.create(req.user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentService.updateStatus(id, dto);
  }

  @Patch(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentService.reschedule(id, dto);
  }
}