// src/modules/applications/applications.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) { }

  // ==========================================
  // ENDPOINTS CHO NGƯỜI DÙNG (ADOPTER)
  // ==========================================

  @Post()
  async createApplication(
    @User('id') userId: string,
    @Body() createApplicationDto: CreateApplicationDto,
  ) {
    const data = await this.applicationsService.createApplication(
      userId,
      createApplicationDto,
    );
    return { success: true, data };
  }

  @Get('my-applications')
  async getMyApplications(@User('id') userId: string) {
    const data = await this.applicationsService.getMyApplications(userId);
    return { success: true, data };
  }

  @Get(':id')
  async getApplicationById(
    @User('id') userId: string,
    @Param('id') applicationId: string,
  ) {
    const data = await this.applicationsService.getApplicationById(
      userId,
      applicationId,
    );
    return { success: true, data };
  }

  @Patch(':id/verification-photos')
  async updateVerificationPhotos(
    @User('id') userId: string,
    @Param('id') applicationId: string,
    @Body('photos') photos: string[],
  ) {
    if (!photos || photos.length === 0) {
      throw new BadRequestException(
        'Please provide at least one verification photo.',
      );
    }
    const data = await this.applicationsService.updateVerificationPhotos(
      userId,
      applicationId,
      photos,
    );
    return {
      success: true,
      message: 'Verification photo submitted successfully',
      data,
    };
  }

  @Patch(':id/withdraw')
  async withdrawApplication(
    @User('id') userId: string,
    @Param('id') applicationId: string,
  ) {
    const data = await this.applicationsService.withdrawApplication(
      userId,
      applicationId,
    );
    return {
      success: true,
      message: 'Application withdrawn successfully',
      data,
    };
  }

  // ==========================================
  // ENDPOINTS CHO TRẠM CỨU HỘ (SHELTER)
  // ==========================================

  @Get('shelter/:shelterId')
  async getShelterApplications(
    @Param('shelterId') shelterId: string,
    @Query('status') status?: string,
  ) {
    const data = await this.applicationsService.getShelterApplications(
      shelterId,
      status,
    );
    return { success: true, data };
  }

  @Post(':id/notes')
  async addNote(
    @User('id') authorId: string,
    @Param('id') applicationId: string,
    @Body('content') content: string,
  ) {
    if (!content) {
      throw new BadRequestException('Note content is required.');
    }
    const data = await this.applicationsService.addNote(
      applicationId,
      authorId,
      content,
    );
    return { success: true, data };
  }

  @Post(':id/tags')
  async addTag(
    @Param('id') applicationId: string,
    @Body('tagId') tagId?: string,
    @Body('name') name?: string,
  ) {
    const data = await this.applicationsService.addTagToApplication(
      applicationId,
      tagId,
      name,
    );
    return { success: true, data };
  }

  @Delete(':id/tags/:tagId')
  async removeTag(
    @Param('id') applicationId: string,
    @Param('tagId') tagId: string,
  ) {
    await this.applicationsService.removeTagFromApplication(
      applicationId,
      tagId,
    );
    return { success: true, message: 'Tag removed successfully' };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') applicationId: string,
    @Body('status') status: string,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    const data = await this.applicationsService.updateApplicationStatus(
      applicationId,
      status,
      rejectionReason,
    );
    return { success: true, data };
  }

  @Post(':id/appointments')
  async scheduleAppointment(
    @Param('id') applicationId: string,
    @Body() dto: any,
  ) {
    const data = await this.applicationsService.scheduleAppointment(
      applicationId,
      dto,
    );
    return { success: true, data };
  }
}