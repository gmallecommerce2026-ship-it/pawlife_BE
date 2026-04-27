// src/modules/tags/tags.controller.ts
import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';
import { PrismaService } from 'src/database/prisma/prisma.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService, private prisma: PrismaService) {}
  @Get('reports/:id')
  async getTagReportDetail(@Param('id') id: string) {
    const report = await this.prisma.tagReport.findUnique({
      where: { id },
      include: {
        tag: {
          include: {
            pet: {
              include: {
                owner: true,
                images: true,
              }
            }
          }
        }
      }
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
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