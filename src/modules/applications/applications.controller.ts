// src/modules/applications/applications.controller.ts
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  async createApplication(
    @User('id') userId: string,
    @Body() createApplicationDto: CreateApplicationDto,
  ) {
    const data = await this.applicationsService.createApplication(userId, createApplicationDto);
    return { success: true, data };
  }

  @Get('my-applications')
  async getMyApplications(@User('id') userId: string) {
    const data = await this.applicationsService.getMyApplications(userId);
    return { success: true, data };
  }

  // API ĐỂ LẤY CHI TIẾT
  @Get(':id')
  async getApplicationById(
    @User('id') userId: string,
    @Param('id') applicationId: string,
  ) {
    const data = await this.applicationsService.getApplicationById(userId, applicationId);
    return { success: true, data };
  }

  @Patch(':id/withdraw')
  async withdrawApplication(
    @User('id') userId: string,
    @Param('id') applicationId: string,
  ) {
    const data = await this.applicationsService.withdrawApplication(userId, applicationId);
    return { success: true, message: 'Đã thu hồi đơn đăng ký thành công', data };
  }
}