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
import { Role } from '@prisma/client';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ShelterGuard } from 'src/common/guards/shelter.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User } from '../../common/decorators/user.decorator';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) { }

  // ==========================================
  // ENDPOINTS CHO NGƯỜI DÙNG (ADOPTER) — chỉ cần JwtAuthGuard
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
  // FIX BẢO MẬT: các route dưới đây trước đây chỉ có JwtAuthGuard — bất kỳ
  // user nào đăng nhập (kể cả adopter) cũng gọi được để sửa status/notes/tags
  // của đơn thuộc shelter khác. Giờ thêm RolesGuard + ShelterGuard + kiểm tra
  // quyền sở hữu thật sự trong service (giống ShelterDashboardService.moveApplication).
  // ==========================================

  @Get('shelter/:shelterId')
  @UseGuards(RolesGuard, ShelterGuard)
  @Roles(Role.SHELTER)
  async getShelterApplications(
    @User('shelterId') requesterShelterId: string,
    @Param('shelterId') shelterId: string,
    @Query('status') status?: string,
  ) {
    // Chặn shelter A xem đơn của shelter B qua path param
    if (requesterShelterId !== shelterId) {
      throw new BadRequestException('Bạn không có quyền xem đơn của trạm này.');
    }
    const data = await this.applicationsService.getShelterApplications(
      shelterId,
      status,
    );
    return { success: true, data };
  }

  @Post(':id/notes')
  @UseGuards(RolesGuard, ShelterGuard)
  @Roles(Role.SHELTER)
  async addNote(
    @User('id') authorId: string,
    @User('shelterId') shelterId: string,
    @Param('id') applicationId: string,
    @Body('content') content: string,
  ) {
    if (!content) {
      throw new BadRequestException('Note content is required.');
    }
    const data = await this.applicationsService.addNote(
      shelterId,
      applicationId,
      authorId,
      content,
    );
    return { success: true, data };
  }

  @Post(':id/tags')
  @UseGuards(RolesGuard, ShelterGuard)
  @Roles(Role.SHELTER)
  async addTag(
    @User('shelterId') shelterId: string,
    @Param('id') applicationId: string,
    @Body('tagId') tagId?: string,
    @Body('name') name?: string,
  ) {
    const data = await this.applicationsService.addTagToApplication(
      shelterId,
      applicationId,
      tagId,
      name,
    );
    return { success: true, data };
  }

  @Delete(':id/tags/:tagId')
  @UseGuards(RolesGuard, ShelterGuard)
  @Roles(Role.SHELTER)
  async removeTag(
    @User('shelterId') shelterId: string,
    @Param('id') applicationId: string,
    @Param('tagId') tagId: string,
  ) {
    await this.applicationsService.removeTagFromApplication(
      shelterId,
      applicationId,
      tagId,
    );
    return { success: true, message: 'Tag removed successfully' };
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard, ShelterGuard)
  @Roles(Role.SHELTER)
  async updateStatus(
    @User('shelterId') shelterId: string,
    @Param('id') applicationId: string,
    @Body('status') status: string,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    const data = await this.applicationsService.updateApplicationStatus(
      shelterId,
      applicationId,
      status,
      rejectionReason,
    );
    return { success: true, data };
  }

  @Post(':id/appointments')
  @UseGuards(RolesGuard, ShelterGuard)
  @Roles(Role.SHELTER)
  async scheduleAppointment(
    @User('shelterId') shelterId: string,
    @Param('id') applicationId: string,
    @Body() dto: any,
  ) {
    const data = await this.applicationsService.scheduleAppointment(
      shelterId,
      applicationId,
      dto,
    );
    return { success: true, data };
  }
}