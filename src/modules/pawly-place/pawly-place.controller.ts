import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { PawlyPlacesService } from './pawly-place.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import {
  GeoLangDto, LangQueryDto, LimitGeoDto, ListReviewsDto, ReactReviewDto, ReportReviewDto,
  SearchPlacesDto, UpsertReviewDto,
} from './dto/pawly-place.dto';

@Controller('pawly-places')
export class PawlyPlacesController {
  constructor(private readonly service: PawlyPlacesService) { }

  // ⚠️ Các route tĩnh phải khai báo TRƯỚC ':id'

  @Get('config') // filter chips + categories
  getConfig(@Query() q: LangQueryDto) {
    return this.service.getConfig(q);
  }

  @Get() // search / nearby / map pins / kết quả bottom sheet
  search(@Query() q: SearchPlacesDto) {
    return this.service.search(q);
  }

  @Get('friends-working') // "Bạn của PawLife đang làm tại"
  friendsWorking(@Query() q: LimitGeoDto) {
    return this.service.getFriendsWorking(q);
  }

  @Get('recent') // "Xem gần đây"
  @UseGuards(JwtAuthGuard)
  recent(@Query() q: LimitGeoDto, @Request() req: any) {
    return this.service.getRecent(req.user.id, q);
  }

  @Delete('recent')
  @UseGuards(JwtAuthGuard)
  clearRecent(@Request() req: any) {
    return this.service.clearRecent(req.user.id);
  }

  @Post('reviews/:reviewId/reactions') // toggle huuich | camon | huhu
  @UseGuards(JwtAuthGuard)
  react(@Param('reviewId') reviewId: string, @Body() dto: ReactReviewDto, @Request() req: any) {
    return this.service.toggleReaction(reviewId, req.user.id, dto.type);
  }

  @Post('reviews/:reviewId/report')
  @UseGuards(JwtAuthGuard)
  reportReview(@Param('reviewId') reviewId: string, @Body() dto: ReportReviewDto, @Request() req: any) {
    return this.service.reportReview(reviewId, req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  detail(@Param('id') id: string, @Query() q: GeoLangDto, @Request() req: any) {
    return this.service.getDetail(id, q, req.user?.id ?? null);
  }

  @Get(':id/menu')
  menu(@Param('id') id: string, @Query() q: LangQueryDto) {
    return this.service.getMenu(id, q);
  }

  @Get(':id/reviews')
  @UseGuards(OptionalJwtAuthGuard)
  reviews(@Param('id') id: string, @Query() q: ListReviewsDto, @Request() req: any) {
    return this.service.getReviews(id, q, req.user?.id ?? null);
  }

  @Post(':id/reviews') // tạo mới hoặc cập nhật review của chính mình
  @UseGuards(JwtAuthGuard)
  upsertReview(@Param('id') id: string, @Body() dto: UpsertReviewDto, @Request() req: any) {
    return this.service.upsertReview(id, req.user.id, dto);
  }

  @Delete(':id/reviews/mine')
  @UseGuards(JwtAuthGuard)
  deleteMyReview(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteMyReview(id, req.user.id);
  }
}