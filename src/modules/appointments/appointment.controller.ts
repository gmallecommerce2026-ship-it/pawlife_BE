import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { DelegateBookingDto } from './dto/delegate-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { AppointmentsService } from './appointment.service';
import { UpdateAppointmentStatusDto } from './dto/update-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { SetMeetLinkDto } from './dto/set-meet-link.dto';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) { }

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

  // Endpoint FE đang gọi thật (InterviewInformationModal.handleCancel)
  @Patch(':id/cancel')
  cancel(@User() user: any, @Param('id') id: string, @Body() dto: CancelAppointmentDto) {
    return this.service.cancel(user.shelterId ?? user.id, user.shelterId ? 'SHELTER' : 'USER', id, dto);
  }

  @Patch(':id/meet-link')
  setMeetLink(@User('shelterId') shelterId: string, @Param('id') id: string, @Body() dto: SetMeetLinkDto) {
    return this.service.setMeetLink(shelterId, id, dto);
  }

  @Patch('applications/:applicationId/delegate')
  delegate(@User('shelterId') shelterId: string, @Param('applicationId') applicationId: string, @Body() dto: DelegateBookingDto) {
    return this.service.delegateBooking(shelterId, applicationId, dto);
  }
  @Get('me/upcoming-interview')
  getUpcomingInterview(@User('id') userId: string) {
    return this.service.getUpcomingInterviewForUser(userId);
  }
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
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