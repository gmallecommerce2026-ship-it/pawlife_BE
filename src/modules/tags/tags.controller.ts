// src/modules/tags/tags.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get(':tagId/scan')
  async scanTag(@Param('tagId') tagId: string) {
    return this.tagsService.scanTag(tagId);
  }

  @Post('report')
  async createReport(@Body() createTagReportDto: CreateTagReportDto) {
    return this.tagsService.createTagReport(createTagReportDto);
  }
}