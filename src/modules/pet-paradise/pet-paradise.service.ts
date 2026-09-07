import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CreateReviewDto, ReactionTypeDto, ReportReviewDto } from './dto/paradise.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class PetParadiseService {
    private googleApiKey: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly redisService: RedisService,
        private readonly configService: ConfigService,
        private readonly notificationsGateway: NotificationsGateway,
    ) {
        this.googleApiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY') || '';
    }

    async getDetail(id: string): Promise<any> {
        const cacheKey = `paradise:detail:${id}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) return cached;

        const paradise = await this.prisma.petParadise.findUnique({
            where: { id },
        });

        if (!paradise) throw new NotFoundException('Pet Paradise not found');

        // Nếu có googlePlaceId và cần sync review từ Google Maps
        if (paradise.googlePlaceId && this.googleApiKey) {
            await this.syncGoogleReviews(paradise.id, paradise.googlePlaceId);
        }

        await this.redisService.set(cacheKey, paradise, 300);
        return paradise;
    }

    // Tích hợp Google Places Details API để kéo reviews thực
    async syncGoogleReviews(paradiseId: string, placeId: string) {
        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&language=vi&key=${this.googleApiKey}`;
            const res = await axios.get(url);
            const result = res.data?.result;

            if (result?.reviews && Array.isArray(result.reviews)) {
                for (const gr of result.reviews) {
                    const googleReviewId = `google_${gr.time}_${gr.author_name}`;
                    await this.prisma.petParadiseReview.upsert({
                        where: { googleReviewId },
                        update: {
                            content: gr.text,
                            rating: gr.rating,
                            dateText: gr.relative_time_description,
                        },
                        create: {
                            paradiseId,
                            googleReviewId,
                            authorName: gr.author_name,
                            authorAvatar: gr.profile_photo_url,
                            rating: gr.rating,
                            dateText: gr.relative_time_description,
                            content: gr.text,
                            images: [],
                            isFromGoogle: true,
                        },
                    });
                }
            }
        } catch (err) {
            console.error('Google Reviews sync error:', err);
        }
    }

    async getReviews(paradiseId: string, userId?: string) {
        const reviews = await this.prisma.petParadiseReview.findMany({
            where: { paradiseId },
            orderBy: { createdAt: 'desc' },
            include: {
                reactions: userId ? { where: { userId } } : false,
            },
        });

        return reviews.map((r) => {
            const userReactions = (r.reactions as any[]) || [];
            return {
                id: r.id,
                name: r.authorName,
                avatar: r.authorAvatar,
                rating: r.rating,
                date: r.dateText,
                content: r.content,
                images: (r.images as string[]) || [],
                reactions: [
                    {
                        type: 'huuich',
                        labelVi: 'Hữu ích',
                        labelEn: 'Helpful',
                        count: r.huuichCount,
                        isReacted: userReactions.some((rx) => rx.type === 'HUUICH'),
                    },
                    {
                        type: 'camon',
                        labelVi: 'Cảm ơn',
                        labelEn: 'Thanks',
                        count: r.camonCount,
                        isReacted: userReactions.some((rx) => rx.type === 'CAMON'),
                    },
                    {
                        type: 'huhu',
                        labelVi: 'Huhu',
                        labelEn: 'Huhu',
                        count: r.huhuCount,
                        isReacted: userReactions.some((rx) => rx.type === 'HUHU'),
                    },
                ],
            };
        });
    }

    async createReview(userId: string, dto: CreateReviewDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const review = await this.prisma.petParadiseReview.create({
            data: {
                paradiseId: dto.paradiseId,
                userId,
                authorName: user.name || 'PawLife User',
                authorAvatar: user.avatarUrl,
                rating: dto.rating,
                dateText: 'Vừa xong',
                content: dto.content || '',
                images: dto.images || [],
                isFromGoogle: false,
            },
        });

        // Realtime notification qua Socket.io
        this.notificationsGateway.server.emit(`paradise_${dto.paradiseId}_new_review`, review);

        return review;
    }

    async toggleReaction(reviewId: string, userId: string, type: ReactionTypeDto) {
        const review = await this.prisma.petParadiseReview.findUnique({ where: { id: reviewId } });
        if (!review) throw new NotFoundException('Review not found');

        const existingReaction = await this.prisma.petParadiseReviewReaction.findUnique({
            where: {
                reviewId_userId_type: { reviewId, userId, type },
            },
        });

        const countField =
            type === ReactionTypeDto.HUUICH
                ? 'huuichCount'
                : type === ReactionTypeDto.CAMON
                    ? 'camonCount'
                    : 'huhuCount';

        let isReacted = false;

        if (existingReaction) {
            await this.prisma.$transaction([
                this.prisma.petParadiseReviewReaction.delete({ where: { id: existingReaction.id } }),
                this.prisma.petParadiseReview.update({
                    where: { id: reviewId },
                    data: { [countField]: { decrement: 1 } },
                }),
            ]);
            isReacted = false;
        } else {
            await this.prisma.$transaction([
                this.prisma.petParadiseReviewReaction.create({
                    data: { reviewId, userId, type },
                }),
                this.prisma.petParadiseReview.update({
                    where: { id: reviewId },
                    data: { [countField]: { increment: 1 } },
                }),
            ]);
            isReacted = true;
        }

        const updated = await this.prisma.petParadiseReview.findUnique({ where: { id: reviewId } });

        // Realtime broadcast socket cho người dùng đang xem địa điểm này
        this.notificationsGateway.server.emit(`review_reaction_updated`, {
            reviewId,
            type: type.toLowerCase(),
            count: updated ? updated[countField] : 0,
            userId,
            isReacted,
        });

        return { success: true, isReacted, currentCount: updated ? updated[countField] : 0 };
    }
    async getRelatedParadises(excludeId: string, limit = 6) {
        const paradises = await this.prisma.petParadise.findMany({
            where: { id: { not: excludeId } },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        if (paradises.length === 0) return [];

        const ids = paradises.map((p) => p.id);

        // Tính rating trung bình + số lượng review thật từ bảng petParadiseReview
        const reviewAggregates = await this.prisma.petParadiseReview.groupBy({
            by: ['paradiseId'],
            where: { paradiseId: { in: ids } },
            _avg: { rating: true },
            _count: { _all: true },
        });

        const aggMap = new Map(
            reviewAggregates.map((a) => [
                a.paradiseId,
                { avgRating: a._avg.rating ?? 0, count: a._count._all },
            ]),
        );

        return paradises.map((p) => {
            const agg = aggMap.get(p.id) || { avgRating: 0, count: 0 };
            return {
                id: p.id,
                name: p.name,
                heroImage: (p as any).heroImage,
                introText: (p as any).introText,
                rating: Number(agg.avgRating.toFixed(1)),
                reviewsCount: agg.count,
            };
        });
    }
    
    async reportReview(reviewId: string, reporterId: string, dto: ReportReviewDto) {
        const report = await this.prisma.petParadiseReviewReport.create({
            data: {
                reviewId,
                reporterId,
                reason: dto.reason,
                details: dto.details,
            },
        });
        return { success: true, message: 'Báo cáo thành công', data: report };
    }
}