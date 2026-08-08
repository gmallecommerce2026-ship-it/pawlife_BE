import { Controller, Get, Put, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AdoptionApplicationService } from './adoption-application.service';
import { UpsertAdoptionApplicationDto, CreateAppointmentDto } from './dto/adoption-application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('adoption-applications')
@UseGuards(JwtAuthGuard)
export class AdoptionApplicationController {
  constructor(private readonly service: AdoptionApplicationService) {}

  @Get('me')
  getMyProfile(@Request() req) {
    return this.service.getMyApplicationProfile(req.user.id);
  }

  @Put('me')
  upsertProfile(@Request() req, @Body() dto: UpsertAdoptionApplicationDto) {
    return this.service.upsertApplicationProfile(req.user.id, dto);
  }

  @Get('my-requests')
  getMyRequests(@Request() req) {
    return this.service.getMyAdoptionRequests(req.user.id);
  }

  @Patch('my-requests/:id/cancel')
  cancelRequest(@Request() req, @Param('id') id: string) {
    return this.service.cancelAdoptionRequest(req.user.id, id);
  }

  @Post('appointments')
  createAppointment(@Request() req, @Body() dto: CreateAppointmentDto) {
    return this.service.createAppointment(req.user.id, dto);
  }
}