// src/modules/tags/tags.controller.ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}
  
  @Get('reports/:id')
  async getTagReportDetail(@Param('id') id: string) {
    return this.tagsService.getTagReportDetail(id);
  }

  @Get(':tagId/scan')
  async scanTag(@Param('tagId') tagId: string) {
    return this.tagsService.scanTag(tagId);
  }

  @Post('report')
  async createReport(@Body() createTagReportDto: CreateTagReportDto) {
    return this.tagsService.createTagReport(createTagReportDto);
  }

  @Patch('report/:id/resolve')
  async resolveReport(@Param('id') id: string) {
    return this.tagsService.resolveTagReport(id);
  }
}