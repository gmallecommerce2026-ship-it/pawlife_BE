// src/modules/applications/applications.controller.ts
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { CreateApplicationDto } from './dto/create-application.dto';
import { BadRequestException } from '@nestjs/common';
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

  @Patch(':id/verification-photos')
  async updateVerificationPhotos(
    @User('id') userId: string,
    @Param('id') applicationId: string,
    @Body('photos') photos: string[], // Nhận mảng chuỗi URLs từ frontend
  ) {
    if (!photos || photos.length === 0) {
      throw new BadRequestException('Please provide at least one verification photo.');
    }
    const data = await this.applicationsService.updateVerificationPhotos(userId, applicationId, photos);
    return { success: true, message: 'Verification photo submitted successfully', data };
  }

  @Patch(':id/withdraw')
  async withdrawApplication(
    @User('id') userId: string,
    @Param('id') applicationId: string,
  ) {
    const data = await this.applicationsService.withdrawApplication(userId, applicationId);
    return { success: true, message: 'Application withdrawn successfully', data };
  }
}