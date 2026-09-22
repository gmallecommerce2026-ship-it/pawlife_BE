// tags.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';
import { ReportTagReportItemDto } from './dto/report-tag-report-item.dto'; // ← ADD
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) { }


  @Get('nearby')
  async getNearbyLostPets(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius = '5',
  ) {
    return this.tagsService.getNearbyLostPets(Number(lat), Number(lng), Number(radius));
  }

  // ✅ Import đã có, route này hoạt động đúng
  @Post('report-feedback')
  @UseGuards(JwtAuthGuard)
  async reportTagReportItem(@Body() dto: ReportTagReportItemDto, @Request() req: any) {
    return this.tagsService.reportTagReportItem(dto, req.user.id);
  }

  @Get('reports/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async getTagReportDetail(@Param('id') id: string, @Request() req: any) {
    return this.tagsService.getTagReportDetail(id, req.user?.id ?? null);
  }

  @Get(':tagId/scan')
  async scanTag(@Param('tagId') tagId: string) {
    return this.tagsService.scanTag(tagId);
  }

  @Post('report')
  @UseGuards(OptionalJwtAuthGuard)
  async createReport(@Body() dto: CreateTagReportDto, @Request() req: any) {
    return this.tagsService.createTagReport(dto, req.user?.id ?? null);
  }

  @Post('report/:id/hide-and-block')
  @UseGuards(JwtAuthGuard)
  async hideAndBlock(@Param('id') id: string, @Request() req: any) {
    return this.tagsService.hideAndBlockScanner(id, req.user.id);
  }



  @Patch('report/:id/resolve')
  async resolveReport(@Param('id') id: string) {
    return this.tagsService.resolveTagReport(id);
  }

}