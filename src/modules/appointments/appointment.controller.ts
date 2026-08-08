// appointments.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { DelegateBookingDto } from './dto/delegate-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { AppointmentsService } from './appointment.service';
import { UpdateAppointmentStatusDto } from './dto/update-appointment.dto';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  create(@User() user: any, @Body() dto: CreateAppointmentDto) {
    return this.service.createOrUpsert(user.shelterId ?? user.id, user.shelterId ? 'SHELTER' : 'USER', dto);
  }

  @Patch(':id/reschedule')
  reschedule(@User() user: any, @Param('id') id: string, @Body() dto: RescheduleAppointmentDto) {
    return this.service.reschedule(user.shelterId ?? user.id, user.shelterId ? 'SHELTER' : 'USER', id, dto);
  }

  @Patch(':id/status')
  updateStatus(@User() user: any, @Param('id') id: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.service.updateStatus(user.shelterId ?? user.id, user.shelterId ? 'SHELTER' : 'USER', id, dto);
  }

  @Patch('applications/:applicationId/delegate')
  delegate(@User('shelterId') shelterId: string, @Param('applicationId') applicationId: string, @Body() dto: DelegateBookingDto) {
    return this.service.delegateBooking(shelterId, applicationId, dto);
  }

  @Get('application/:applicationId')
  getByApplication(@Param('applicationId') applicationId: string) {
    return this.service.getByApplication(applicationId);
  }

  @Get('shelter/:shelterId/available-slots')
  getSlots(@Param('shelterId') shelterId: string, @Query('date') date: string) {
    return this.service.getAvailableSlots(shelterId, date);
  }
}