import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlaceReactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import {
  GeoLangDto, LangQueryDto, LimitGeoDto, ListReviewsDto, ReportReviewDto, SearchPlacesDto, UpsertReviewDto,
} from './dto/pawly-place.dto';
import {
  boundingBox, formatDistance, formatPrice, getOpenStatus, haversineKm, Lang, loc, normLang,
  OpeningHours, pick, timeAgo, toStringArray, uniq, weeklyHours,
} from './utils/pawly-place.utils';

const cardInclude = Prisma.validator<Prisma.PlaceInclude>()({
  category: true,
  amenities: { include: { amenity: true } },
});
type PlaceCardRow = Prisma.PlaceGetPayload<{ include: typeof cardInclude }>;

const reviewInclude = Prisma.validator<Prisma.PlaceReviewInclude>()({
  user: { select: { id: true, name: true, avatarUrl: true } },
});
type ReviewRow = Prisma.PlaceReviewGetPayload<{ include: typeof reviewInclude }>;

const REACTIONS = [
  { type: PlaceReactionType.HUUICH, key: 'huuich', labelVi: 'Hữu ích', labelEn: 'Helpful' },
  { type: PlaceReactionType.CAMON, key: 'camon', labelVi: 'Cảm ơn', labelEn: 'Thanks' },
  { type: PlaceReactionType.HUHU, key: 'huhu', labelVi: 'Huhu', labelEn: 'Huhu' },
] as const;

const err = {
  placeNotFound: () => new NotFoundException({ message: 'Place not found.', i18n: { key: 'error.place_not_found' } }),
  reviewNotFound: () => new NotFoundException({ message: 'Review not found.', i18n: { key: 'error.review_not_found' } }),
  reviewEmpty: () => new BadRequestException({ message: 'Please enter your experience or attach photos.', i18n: { key: 'error.review_empty' } }),
};

const GENDER_SYMBOL: Record<string, string> = { MALE: '♂', FEMALE: '♀', UNKNOWN: '' };

@Injectable()
export class PawlyPlacesService {
  private readonly CONFIG_TTL = 300;

  constructor(private prisma: PrismaService, private redis: RedisService) { }

  // =====================================================================
  // CONFIG: filter chips + categories
  // =====================================================================
  async getConfig(dto: LangQueryDto) {
    const lang = normLang(dto.lang);
    const cacheKey = `pawly-places:config:v2:${lang}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const [categories, filters, amenities] = await Promise.all([
      this.prisma.placeCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.placeAmenity.findMany({ where: { isFilter: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.placeAmenity.findMany({ where: { showInDetail: true }, orderBy: { sortOrder: 'asc' } }),
    ]);


    const result = {
      categories: categories.map((c) => ({
        id: c.id, key: c.key, name: loc(c.nameVi, c.nameEn, lang), icon: c.icon,
      })),
      filters: filters.map((f) => ({ key: f.key, label: loc(f.labelVi, f.labelEn, lang) })),
      amenities: amenities.map((a) => ({
        key: a.key, label: loc(a.labelVi, a.labelEn, lang), isFilter: a.isFilter,
      })),
    };
    await this.redis.set(cacheKey, result, this.CONFIG_TTL);
    return result;
  }

  // =====================================================================
  // SEARCH / NEARBY (dùng cho cả map pin lẫn danh sách bottom sheet)
  // =====================================================================
  async search(dto: SearchPlacesDto) {
    const lang = normLang(dto.lang);
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const radiusKm = dto.radius ?? 20;
    const kw = dto.q?.trim();
    const hasGeo = dto.lat != null && dto.lng != null;

    const and: Prisma.PlaceWhereInput[] = [{ isActive: true }];
    if (kw) {
      and.push({
        OR: [{ name: { contains: kw } }, { address: { contains: kw } }, { city: { contains: kw } }],
      });
    }
    if (dto.category) and.push({ category: { key: dto.category } });
    for (const key of dto.filters ?? []) {
      and.push({ amenities: { some: { amenity: { key } } } });
    }
    // Có từ khoá thì tìm toàn quốc (chỉ sort theo khoảng cách); không có thì giới hạn bán kính
    if (hasGeo && !kw) {
      const b = boundingBox(dto.lat!, dto.lng!, radiusKm);
      and.push({
        latitude: { gte: b.minLat, lte: b.maxLat },
        longitude: { gte: b.minLng, lte: b.maxLng },
      });
    }

    const places = await this.prisma.place.findMany({
      where: { AND: and },
      include: cardInclude,
      take: 300, // đủ cho MVP; khi >10k quán chuyển sang Redis GEO (đã có addLocation/getNearby)
    });

    let rows = places.map((p) => ({ p, dist: this.distanceOf(p, dto.lat, dto.lng) }));
    if (hasGeo && !kw) rows = rows.filter((r) => r.dist! <= radiusKm);
    rows.sort((a, b) => (hasGeo ? a.dist! - b.dist! : b.p.rating - a.p.rating));

    const total = rows.length;
    const items = rows.slice((page - 1) * limit, page * limit).map((r) => this.toCard(r.p, r.dist, lang));
    return { items, page, limit, total, hasMore: page * limit < total };
  }

  // =====================================================================
  // DETAIL
  // =====================================================================
  async getDetail(id: string, dto: GeoLangDto, userId: string | null) {
    const lang = normLang(dto.lang);

    const place = await this.prisma.place.findFirst({
      where: { id, isActive: true },
      include: {
        category: true,
        amenities: { include: { amenity: true } },
        workingPets: {
          where: { isWorking: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            pet: {
              include: { shelter: true, images: { orderBy: { createdAt: 'asc' }, take: 1 } },
            },
          },
        },
        menuSections: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              where: { isFeatured: true, isAvailable: true },
              orderBy: { sortOrder: 'asc' },
              take: 6,
            },
          },
        },
      },
    });
    if (!place) throw err.placeNotFound();

    const [summary, myRow] = await Promise.all([
      this.getRatingSummary(id),
      userId
        ? this.prisma.placeReview.findUnique({
          where: { placeId_userId: { placeId: id, userId } },
          include: reviewInclude,
        })
        : Promise.resolve(null),
    ]);
    const myReview = myRow ? (await this.decorateReviews([myRow], userId, lang))[0] : null;

    // Ghi lịch sử "Xem gần đây" (không chặn response)
    if (userId) {
      this.prisma.recentPlaceView
        .upsert({
          where: { userId_placeId: { userId, placeId: id } },
          create: { userId, placeId: id },
          update: { viewedAt: new Date() },
        })
        .catch(() => undefined);
    }

    const status = getOpenStatus(place.openingHours as OpeningHours | null, lang);
    const hero = place.heroImage;
    const galleryImages = uniq([hero, ...toStringArray(place.galleryImages)]);
    const dist = this.distanceOf(place, dto.lat, dto.lng);
    const amenitiesSorted = [...place.amenities].sort((a, b) => a.amenity.sortOrder - b.amenity.sortOrder);

    return {
      id: place.id,
      name: place.name,
      category: { key: place.category.key, name: loc(place.category.nameVi, place.category.nameEn, lang) },
      categoryText: pick(place.categoryText, lang) || loc(place.category.nameVi, place.category.nameEn, lang),
      intro: pick(place.intro, lang),
      heroImage: hero,
      galleryImages,
      imagesCount: galleryImages.length,
      rating: place.rating,
      reviewsCount: place.reviewsCount,
      address: place.address,
      city: place.city,
      latitude: place.latitude,
      longitude: place.longitude,
      phone: place.phone,
      website: place.website ?? null,
      distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
      distanceLabel: dist != null ? formatDistance(dist) : null,
      openStatus: { isOpen: status.isOpen, label: status.label, detail: status.detail },
      openingHours: weeklyHours(place.openingHours as OpeningHours | null, lang),
      amenities: amenitiesSorted
        .filter((a) => a.amenity.showInDetail)
        .map((a) => ({ key: a.amenity.key, label: loc(a.amenity.labelVi, a.amenity.labelEn, lang) })),
      workingPets: place.workingPets.map((wp) => {
        const pet = wp.pet;
        return {
          id: pet.id,
          workingId: wp.id,
          name: pet.name,
          gender: pet.gender ? GENDER_SYMBOL[pet.gender] ?? '' : '',
          shelterId: pet.shelterId,
          shelter: pet.shelter?.name ?? '',
          breed: pick(pet.breed, lang) || null,
          color: pick(pet.color, lang) || null,
          weight: pet.weight ? `${pet.weight} kg` : null,
          pawlifeId: pet.idSetByShelter ?? null,
          intro: pick(wp.intro, lang) || pick(pet.description, lang) || null,
          image: pet.images[0]?.url ?? null,
          isSponsored: wp.isSponsored,
        };
      }),
      menuPreview: place.menuSections
        .flatMap((s) => s.items)
        .slice(0, 6)
        .map((it) => this.toMenuItem(it)),
      reviewSummary: summary,
      myReview,
    };
  }

  // =====================================================================
  // MENU (overlay full menu)
  // =====================================================================
  async getMenu(placeId: string, dto: LangQueryDto) {
    const lang = normLang(dto.lang);
    await this.ensurePlace(placeId);
    const sections = await this.prisma.placeMenuSection.findMany({
      where: { placeId },
      orderBy: { sortOrder: 'asc' },
      include: { items: { where: { isAvailable: true }, orderBy: { sortOrder: 'asc' } } },
    });
    return {
      sections: sections
        .filter((s) => s.items.length > 0)
        .map((s) => ({ id: s.id, title: pick(s.title, lang), items: s.items.map((it) => this.toMenuItem(it)) })),
    };
  }

  // =====================================================================
  // REVIEWS
  // =====================================================================
  async getReviews(placeId: string, dto: ListReviewsDto, userId: string | null) {
    const lang = normLang(dto.lang);
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    await this.ensurePlace(placeId);

    // Ẩn review của người mà viewer đã block (yêu cầu của Apple)
    let blockedIds: string[] = [];
    if (userId) {
      const blocks = await this.prisma.userBlock.findMany({
        where: { blockerId: userId }, select: { blockedId: true },
      });
      blockedIds = blocks.map((b) => b.blockedId);
    }

    const where: Prisma.PlaceReviewWhereInput = {
      placeId,
      ...(dto.rating ? { rating: dto.rating } : {}),
      ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
    };

    const [total, rows, summary] = await Promise.all([
      this.prisma.placeReview.count({ where }),
      this.prisma.placeReview.findMany({
        where, include: reviewInclude, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.getRatingSummary(placeId),
    ]);

    return {
      items: await this.decorateReviews(rows, userId, lang),
      page, limit, total, hasMore: page * limit < total,
      summary,
    };
  }

  async upsertReview(placeId: string, userId: string, dto: UpsertReviewDto) {
    const lang = normLang(dto.lang);
    await this.ensurePlace(placeId);

    const content = (dto.content ?? '').trim();
    const images = dto.images ?? [];
    if (!content && images.length === 0) {
      throw err.reviewEmpty();
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const review = await tx.placeReview.upsert({
        where: { placeId_userId: { placeId, userId } },
        create: { placeId, userId, rating: dto.rating, content, images },
        update: { rating: dto.rating, content, images },
        include: reviewInclude,
      });
      await this.recomputeRating(tx, placeId);
      return review;
    });

    const [review] = await this.decorateReviews([row], userId, lang);
    const summary = await this.getRatingSummary(placeId);
    return { review, summary };
  }

  async deleteMyReview(placeId: string, userId: string) {
    const existing = await this.prisma.placeReview.findUnique({
      where: { placeId_userId: { placeId, userId } }, select: { id: true },
    });
    if (!existing) throw err.reviewNotFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.placeReview.delete({ where: { id: existing.id } });
      await this.recomputeRating(tx, placeId);
    });
    return { success: true, summary: await this.getRatingSummary(placeId) };
  }

  async toggleReaction(reviewId: string, userId: string, key: 'huuich' | 'camon' | 'huhu') {
    const meta = REACTIONS.find((r) => r.key === key)!;
    const review = await this.prisma.placeReview.findUnique({ where: { id: reviewId }, select: { id: true } });
    if (!review) throw err.reviewNotFound();

    const where = { reviewId_userId_type: { reviewId, userId, type: meta.type } };
    const existing = await this.prisma.placeReviewReaction.findUnique({ where });
    if (existing) {
      await this.prisma.placeReviewReaction.delete({ where });
    } else {
      await this.prisma.placeReviewReaction
        .create({ data: { reviewId, userId, type: meta.type } })
        .catch((e) => { if (e?.code !== 'P2002') throw e; }); // double-tap race
    }
    const count = await this.prisma.placeReviewReaction.count({ where: { reviewId, type: meta.type } });
    return { type: key, isReacted: !existing, count };
  }

  async reportReview(reviewId: string, reporterId: string, dto: ReportReviewDto) {
    const review = await this.prisma.placeReview.findUnique({ where: { id: reviewId }, select: { id: true } });
    if (!review) throw err.reviewNotFound();
    await this.prisma.placeReviewReport.upsert({
      where: { reviewId_reporterId: { reviewId, reporterId } },
      create: { reviewId, reporterId, reason: dto.reason, details: dto.details },
      update: { reason: dto.reason, details: dto.details },
    });
    return { success: true, message: 'Report submitted successfully', i18n: { key: 'success.review_reported' } };
  }

  // =====================================================================
  // RECENT + FRIENDS WORKING
  // =====================================================================
  async getRecent(userId: string, dto: LimitGeoDto) {
    const lang = normLang(dto.lang);
    const rows = await this.prisma.recentPlaceView.findMany({
      where: { userId, place: { isActive: true } },
      orderBy: { viewedAt: 'desc' },
      take: dto.limit ?? 10,
      include: { place: true },
    });
    return rows.map((r) => {
      const dist = this.distanceOf(r.place, dto.lat, dto.lng);
      return {
        id: r.place.id,
        name: r.place.name,
        address: r.place.address,
        image: r.place.heroImage,
        distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
        distanceLabel: dist != null ? formatDistance(dist) : null,
        viewedAt: r.viewedAt,
      };
    });
  }

  async clearRecent(userId: string) {
    await this.prisma.recentPlaceView.deleteMany({ where: { userId } });
    return { success: true };
  }

  async getFriendsWorking(dto: LimitGeoDto) {
    const lang = normLang(dto.lang);
    const rows = await this.prisma.placeWorkingPet.findMany({
      where: { isWorking: true, place: { isActive: true } },
      include: {
        place: true,
        pet: { include: { shelter: true, images: { orderBy: { createdAt: 'asc' }, take: 1 } } },
      },
      take: 100,
    });

    const mapped = rows.map((r) => ({ r, dist: this.distanceOf(r.place, dto.lat, dto.lng) }));
    mapped.sort((a, b) =>
      dto.lat != null && dto.lng != null ? a.dist! - b.dist! : b.r.place.rating - a.r.place.rating,
    );

    return mapped.slice(0, dto.limit ?? 10).map(({ r, dist }) => ({
      id: r.id,
      placeId: r.placeId,
      image: r.place.heroImage,
      title: r.place.name,
      rating: r.place.rating,
      reviewsCount: r.place.reviewsCount,
      distanceLabel: dist != null ? formatDistance(dist) : null,
      user: {
        petId: r.petId,
        avatar: r.pet.images[0]?.url ?? null,
        name: loc(`${r.pet.name} đang đi làm`, `${r.pet.name} is working`, lang),
        subtitle: r.pet.shelter?.name ?? '',
        isOnline: r.isWorking,
      },
    }));
  }

  // =====================================================================
  // HELPERS
  // =====================================================================
  private distanceOf(p: { latitude: number; longitude: number }, lat?: number, lng?: number): number | null {
    if (lat == null || lng == null) return null;
    return haversineKm(lat, lng, p.latitude, p.longitude);
  }

  private async ensurePlace(id: string) {
    const c = await this.prisma.place.count({ where: { id, isActive: true } });
    if (!c) throw err.placeNotFound();
  }

  private toCard(p: PlaceCardRow, dist: number | null, lang: Lang) {
    const status = getOpenStatus(p.openingHours as OpeningHours | null, lang);
    return {
      id: p.id,
      name: p.name,
      category: { key: p.category.key, name: loc(p.category.nameVi, p.category.nameEn, lang), icon: p.category.icon },
      latitude: p.latitude,
      longitude: p.longitude,
      rating: p.rating,
      reviewsCount: p.reviewsCount,
      location: p.city,
      address: p.address,
      isOpen: status.isOpen,
      openLabel: status.label,
      tags: [...p.amenities]
        .filter((a) => a.amenity.isFilter)
        .sort((a, b) => a.amenity.sortOrder - b.amenity.sortOrder)
        .map((a) => loc(a.amenity.labelVi, a.amenity.labelEn, lang)),
      images: uniq([p.heroImage, ...toStringArray(p.galleryImages)]).slice(0, 3),
      distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
      distanceLabel: dist != null ? formatDistance(dist) : null,
    };
  }

  private toMenuItem(it: { id: string; name: string; subtext: string | null; price: number; image: string | null }) {
    return { id: it.id, name: it.name, subtext: it.subtext ?? '', price: it.price, priceLabel: formatPrice(it.price), image: it.image };
  }

  private async getRatingSummary(placeId: string) {
    const grouped = await this.prisma.placeReview.groupBy({
      by: ['rating'], where: { placeId }, _count: { _all: true },
    });
    const total = grouped.reduce((s, g) => s + g._count._all, 0);
    const sum = grouped.reduce((s, g) => s + g.rating * g._count._all, 0);
    return {
      average: total ? Math.round((sum / total) * 10) / 10 : 0,
      total,
      distribution: [5, 4, 3, 2, 1].map((star) => {
        const count = grouped.find((g) => g.rating === star)?._count._all ?? 0;
        return { star, count, percentage: total ? (count / total) * 100 : 0 };
      }),
    };
  }

  private async recomputeRating(tx: Prisma.TransactionClient, placeId: string) {
    const agg = await tx.placeReview.aggregate({
      where: { placeId }, _avg: { rating: true }, _count: { _all: true },
    });
    await tx.place.update({
      where: { id: placeId },
      data: {
        rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
        reviewsCount: agg._count._all,
      },
    });
  }

  /** Chuyển row DB → đúng shape ReviewCard ở FE (reactions: type/labelVi/labelEn/count/isReacted) */
  private async decorateReviews(rows: ReviewRow[], userId: string | null, lang: Lang) {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const grouped = (await this.prisma.placeReviewReaction.groupBy({
      by: ['reviewId', 'type'],
      where: { reviewId: { in: ids } },
      _count: { _all: true },
    })) as unknown as { reviewId: string; type: PlaceReactionType; _count: { _all: number } }[];

    const mine = userId
      ? await this.prisma.placeReviewReaction.findMany({
        where: { reviewId: { in: ids }, userId }, select: { reviewId: true, type: true },
      })
      : [];

    const countMap = new Map(grouped.map((g) => [`${g.reviewId}:${g.type}`, g._count._all]));
    const mineSet = new Set(mine.map((m) => `${m.reviewId}:${m.type}`));

    return rows.map((r) => ({
      id: r.id,
      placeId: r.placeId,
      userId: r.userId,
      isMine: !!userId && r.userId === userId,
      name: r.user.name || loc('Người dùng PawLife', 'PawLife user', lang),
      avatar: r.user.avatarUrl ?? null,
      rating: r.rating,
      date: timeAgo(r.createdAt, lang),
      createdAt: r.createdAt,
      content: r.content,
      images: toStringArray(r.images),
      reactions: REACTIONS.map((rx) => ({
        type: rx.key,
        labelVi: rx.labelVi,
        labelEn: rx.labelEn,
        count: countMap.get(`${r.id}:${rx.type}`) ?? 0,
        isReacted: mineSet.has(`${r.id}:${rx.type}`),
      })),
    }));
  }
}