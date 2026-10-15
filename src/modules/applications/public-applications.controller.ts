import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Public()
@Controller('public/applications')
export class PublicApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  async create(@Body() dto: CreateApplicationDto) {
    const data = await this.applicationsService.createPublicApplication(dto);
    return { success: true, data };
  }
}