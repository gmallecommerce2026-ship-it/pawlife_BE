import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  // 1. ĐẶT ROUTE TĨNH LÊN TRƯỚC
  @Get('my-applications')
  async getMyApplications(@User('id') userId: string) {
    console.log("getting my applications!");
    const data = await this.applicationsService.getMyApplications(userId);
    return { success: true, data };
  }

  // 2. ĐẶT ROUTE ĐỘNG (CÓ PARAM :id) XUỐNG CUỐI CÙNG
  @Get(':id')
  async getApplicationById(
    @User('id') userId: string,
    @Param('id') applicationId: string,
  ) {
    console.log(`Getting application detail for id: ${applicationId}`);
    const data = await this.applicationsService.getApplicationById(userId, applicationId);
    return { success: true, data };
  }
}