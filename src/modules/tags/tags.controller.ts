// src/modules/tags/tags.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) { }

  @Get('reports/:id')
  @UseGuards(OptionalJwtAuthGuard) // Optional: có token thì xác thực, không có thì vẫn pass
  async getTagReportDetail(@Param('id') id: string, @Request() req: any) {
    const currentUserId = req.user?.id ?? null;
    return this.tagsService.getTagReportDetail(id, currentUserId);
  }

  @Get(':tagId/scan')
  async scanTag(@Param('tagId') tagId: string) {
    return this.tagsService.scanTag(tagId);
  }

  @Post('report')
  @UseGuards(OptionalJwtAuthGuard)
  async createReport(
    @Body() createTagReportDto: CreateTagReportDto,
    @Request() req: any // 🌟 Hứng request
  ) {
    const currentUserId = req.user?.id ?? null; // Trích xuất ID
    return this.tagsService.createTagReport(createTagReportDto, currentUserId);
  }
  @Post('report/:id/hide-and-block')
  @UseGuards(JwtAuthGuard) // Bắt buộc phải đăng nhập
  async hideAndBlock(
    @Param('id') id: string,
    @Request() req: any
  ) {
    const currentUserId = req.user.id;
    const data = await this.tagsService.hideAndBlockScanner(id, currentUserId);
    return { success: true, data };
  }
  @Post('report-feedback')
  @UseGuards(JwtAuthGuard) // Bắt buộc đăng nhập — ContentReport.reporterId là field required trong schema
  async reportTagReportItem(
    @Body() dto: ReportTagReportItemDto,
    @Request() req: any,
  ) {
    return this.tagsService.reportTagReportItem(dto, req.user.id);
  }
  @Patch('report/:id/resolve')
  async resolveReport(@Param('id') id: string) {
    return this.tagsService.resolveTagReport(id);
  }

  @Get('nearby')
  async getNearbyLostPets(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius: string = '5'
  ) {
    return this.tagsService.getNearbyLostPets(Number(lat), Number(lng), Number(radius));
  }
}