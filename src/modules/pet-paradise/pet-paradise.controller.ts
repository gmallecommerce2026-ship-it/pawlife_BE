import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { PetParadiseService } from './pet-paradise.service';
import { CreateReviewDto, ToggleReactionDto, ReportReviewDto } from './dto/paradise.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
// Giả định JwtAuthGuard đã có sẵn trong project của bạn
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('pet-paradise')
export class PetParadiseController {
    constructor(private readonly paradiseService: PetParadiseService) { }

    @Get(':id')
    async getDetail(@Param('id') id: string) {
        return this.paradiseService.getDetail(id);
    }
    @Post(':id/sync-google')
    async syncGoogle(@Param('id') id: string) {
        const paradise: any = await this.paradiseService.getDetail(id);
        if (paradise.googlePlaceId) {
            await this.paradiseService.syncGoogleReviews(paradise.id, paradise.googlePlaceId);
            return { success: true, message: 'Đã đồng bộ đánh giá mới nhất từ Google Maps!' };
        }
        return { success: false, message: 'Địa điểm này chưa có googlePlaceId' };
    }
    @Get(':id/related')
    async getRelated(@Param('id') id: string) {
        return this.paradiseService.getRelatedParadises(id);
    }
    @Get(':id/reviews')
    async getReviews(@Param('id') id: string, @Query('userId') userId?: string) {
        return this.paradiseService.getReviews(id, userId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('reviews')
    async createReview(@Body() dto: CreateReviewDto, @Req() req: any) {
        const userId = req.user?.id || 'demo_user_id';
        return this.paradiseService.createReview(userId, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('reviews/:reviewId/reaction')
    async toggleReaction(
        @Param('reviewId') reviewId: string,
        @Body() dto: ToggleReactionDto,
        @Req() req: any,
    ) {
        const userId = req.user?.id || 'demo_user_id';
        return this.paradiseService.toggleReaction(reviewId, userId, dto.type);
    }

    @UseGuards(JwtAuthGuard)
    @Post('reviews/:reviewId/report')
    async reportReview(
        @Param('reviewId') reviewId: string,
        @Body() dto: ReportReviewDto,
        @Req() req: any,
    ) {
        const reporterId = req.user?.id || 'demo_user_id';
        return this.paradiseService.reportReview(reviewId, reporterId, dto);
    }
}