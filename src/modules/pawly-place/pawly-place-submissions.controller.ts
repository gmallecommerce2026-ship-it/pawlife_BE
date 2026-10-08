import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { PawlyPlaceSubmissionsService } from './pawly-place-submissions.service';
import { PlaceModeratorGuard } from './guards/place-moderator.guard';
import { CreatePlaceSubmissionDto, ListSubmissionsDto, RejectSubmissionDto } from './dto/place-submission.dto';

/**
 * Dùng prefix riêng 'pawly-place-submissions' (KHÔNG nhét vào 'pawly-places')
 * để không bao giờ đụng route động ':id' của PawlyPlacesController.
 *
 *  POST /pawly-place-submissions                    → user gửi yêu cầu
 *  GET  /pawly-place-submissions/admin              → admin xem danh sách (?status=PENDING&lang=vi)
 *  POST /pawly-place-submissions/admin/:id/approve  → duyệt (tạo Place)
 *  POST /pawly-place-submissions/admin/:id/reject   → từ chối { reason }
 */
@Controller('pawly-place-submissions')
export class PawlyPlaceSubmissionsController {
  constructor(private readonly service: PawlyPlaceSubmissionsService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePlaceSubmissionDto, @Request() req: any) {
    return this.service.create(req.user.id, dto);
  }

  // ⚠️ Route tĩnh 'admin' khai báo trước mọi route động

  @Get('admin')
  @UseGuards(JwtAuthGuard, PlaceModeratorGuard)
  list(@Query() q: ListSubmissionsDto) {
    return this.service.list(q);
  }

  @Post('admin/:id/approve')
  @UseGuards(JwtAuthGuard, PlaceModeratorGuard)
  approve(@Param('id') id: string, @Request() req: any) {
    return this.service.approve(id, req.user.id);
  }

  @Post('admin/:id/reject')
  @UseGuards(JwtAuthGuard, PlaceModeratorGuard)
  reject(@Param('id') id: string, @Body() dto: RejectSubmissionDto, @Request() req: any) {
    return this.service.reject(id, req.user.id, dto.reason);
  }
}