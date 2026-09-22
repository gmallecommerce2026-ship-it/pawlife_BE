// src/modules/tags/tags.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TagStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';
import { ReportTagReportItemDto } from './dto/report-tag-report-item.dto'
import { RedisService } from '../../database/redis/redis.service'; // IMPORT REDIS

function seededRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function generateFakePointInRadius(
  lat: number,
  lng: number,
  radiusMeters: number,
  seed: string,
): { lat: number; lng: number } {
  const safeRadius = Math.max(radiusMeters, 500);
  const r1 = seededRandom(seed + '_A');
  const r2 = seededRandom(seed + '_B');
  const angle = 2 * Math.PI * r1;
  const distance = safeRadius * Math.sqrt(r2);
  const latOffset = (distance * Math.cos(angle)) / 111_320;
  const lngOffset = (distance * Math.sin(angle)) / (111_320 * Math.cos(lat * (Math.PI / 180)));
  return { lat: lat + latOffset, lng: lng + lngOffset };
}

@Injectable()
export class TagsService {
  private readonly LOST_TAGS_KEY = 'tags:locations:lost'; // Key saved in Redis

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private redisService: RedisService // INJECT REDIS
  ) { }

  async getTagReportDetail(id: string, currentUserId?: string) {
    const report = await this.prisma.tagReport.findUnique({
      where: { id },
      include: {
        tag: { include: { pet: { include: { owner: true, images: true } } } },
      },
    });

    if (!report) throw new NotFoundException('Tag scan report not found.');

    const ownerId = report.tag?.pet?.ownerId ?? null;
    const isOwner = !!(currentUserId && currentUserId === ownerId);
    const isMainScanner = !!(currentUserId && currentUserId === report.userId);

    // ✅ FIX: Lấy danh sách userId mà owner đã block
    let blockedUserIds: string[] = [];
    if (ownerId) {
      const blocks = await this.prisma.userBlock.findMany({
        where: { blockerId: ownerId },
        select: { blockedId: true },
      });
      blockedUserIds = blocks.map((b) => b.blockedId);
    }

    const scanHistory = await this.prisma.tagReport.findMany({
      where: {
        tagId: report.tagId,
        id: { not: report.id },
        isHidden: false,
        // ✅ Loại bỏ scan của những userId bị block
        ...(blockedUserIds.length > 0 && {
          NOT: { userId: { in: blockedUserIds } },
        }),
      },
      orderBy: { scannedAt: 'desc' },
    });

    // ... phần còn lại giữ nguyên
    const radius = report.radius || 0;
    let finalLat = report.latitude;
    let finalLng = report.longitude;
    let isExactLocation = !!isMainScanner;

    if (!isExactLocation && radius > 0 && report.latitude && report.longitude) {
      const fakePoint = generateFakePointInRadius(
        report.latitude, report.longitude, radius, `scan_${report.id}`
      );
      finalLat = fakePoint.lat;
      finalLng = fakePoint.lng;
    }

    const processedScanHistory = scanHistory.map((hist) => {
      const isHistScanner = !!(currentUserId && currentUserId === hist.userId);
      if (isHistScanner || !hist.radius || !hist.latitude || !hist.longitude) {
        return { ...hist, isEstimated: false };
      }
      const fakeHistPoint = generateFakePointInRadius(
        hist.latitude, hist.longitude, hist.radius, `scan_${hist.id}`
      );
      return { ...hist, latitude: fakeHistPoint.lat, longitude: fakeHistPoint.lng, isEstimated: true };
    });

    return {
      ...report,
      latitude: finalLat,
      longitude: finalLng,
      radius,
      isExactLocation,
      isOwner,
      isHidden: report.isHidden,
      scanHistory: processedScanHistory,
    };
  }

  async hideAndBlockScanner(reportId: string, currentUserId: string) {
    return this.reportTagReportItem(
      {
        tagReportId: reportId,
        reason: 'manual_hide_and_block',
        isHideRequested: true,
        isBlockRequested: true,
      },
      currentUserId,
    );
  }


  async reportTagReportItem(dto: ReportTagReportItemDto, currentUserId: string) {
    const { tagReportId, reason, details, isHideRequested, isBlockRequested } = dto;

    const report = await this.prisma.tagReport.findUnique({
      where: { id: tagReportId },
      include: { tag: { include: { pet: true } } },
    });

    if (!report) throw new NotFoundException('Tag scan report not found.');

    const isOwner = report.tag?.pet?.ownerId === currentUserId;

    if ((isHideRequested || isBlockRequested) && !isOwner) {
      throw new ForbiddenException('Only the pet owner can hide or block this content.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contentReport.create({
        data: {
          reporterId: currentUserId,
          targetTagReportId: tagReportId,
          reason,
          details,
        },
      });

      if (isHideRequested) {
        await tx.tagReport.update({
          where: { id: tagReportId },
          data: { isHidden: true, hiddenAt: new Date() },
        });
      }

      if (isBlockRequested && report.userId && report.userId !== currentUserId) {
        // Tạo UserBlock record
        await tx.userBlock.upsert({
          where: {
            blockerId_blockedId: { blockerId: currentUserId, blockedId: report.userId },
          },
          create: { blockerId: currentUserId, blockedId: report.userId },
          update: {},
        });

        // BUG FIX 3: Backfill — ẩn TẤT CẢ scan cũ của scanner này trên tag này
        // Không chỉ ẩn report hiện tại, mà toàn bộ history của người bị block
        await tx.tagReport.updateMany({
          where: {
            userId: report.userId,
            tagId: report.tagId,   // chỉ ẩn trên tag của pet này, không ảnh hưởng tag khác
            isHidden: false,       // chỉ update những cái chưa bị ẩn
          },
          data: { isHidden: true, hiddenAt: new Date() },
        });
      }
    });

    if (report.tag?.pet?.id) {
      await this.redisService.del(`pet:detail:${report.tag.pet.id}`);
    }

    return { success: true, message: 'Đã gửi báo cáo thành công.' };
  }


  async createTagReport(data: CreateTagReportDto, currentUserId?: string) {
    const { tagId, ...reportData } = data;
    const lat = Number(reportData.lat ?? reportData.latitude);
    const lng = Number(reportData.lng ?? reportData.longitude);

    // BUG FIX 2: Guard nếu tag không tồn tại
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      include: { pet: { select: { ownerId: true, id: true } } },
    });

    if (!tag) throw new NotFoundException('Tag not found.');

    const ownerId = tag.pet?.ownerId ?? null;

    let isHiddenByBlock = false;
    if (currentUserId && ownerId && currentUserId !== ownerId) {
      const block = await this.prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: { blockerId: ownerId, blockedId: currentUserId },
        },
      });
      if (block) isHiddenByBlock = true;
    }

    const report = await this.prisma.tagReport.create({
      data: {
        tagId,
        userId: currentUserId,
        latitude: lat,
        longitude: lng,
        radius: reportData.radius,
        scannedBy: reportData.scannedBy,
        phoneNumber: reportData.phoneNumber,
        message: reportData.message,
        images: reportData.images,
        isHidden: isHiddenByBlock,
        hiddenAt: isHiddenByBlock ? new Date() : null,
      },
      include: { tag: { include: { pet: { include: { owner: true } } } } },
    });

    if (!isHiddenByBlock) {
      if (report.tag.status === TagStatus.LOST && lat && lng) {
        await this.redisService.addLocation(this.LOST_TAGS_KEY, lng, lat, tagId);
      }
      await this.notificationsService.notifyOwner(report);
    }

    return report;
  }


  async resolveTagReport(reportId: string) {
    const report = await this.prisma.tagReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Tag scan report not found.');

    // Remove location from Redis map once resolved
    await this.redisService.removeLocation(this.LOST_TAGS_KEY, report.tagId);

    return this.prisma.tagReport.update({
      where: { id: reportId },
      data: { status: 'RESOLVED' },
    });
  }

  // ---- NEW FEATURE: FIND LOST PETS NEARBY USING REDIS ----
  async getNearbyLostPets(lat: number, lng: number, radiusKm: number = 5) {
    const roundedLat = lat.toFixed(2);
    const roundedLng = lng.toFixed(2);
    const cacheKey = `tags:nearby:lat_${roundedLat}:lng_${roundedLng}:radius_${radiusKm}`;

    // 2. Check Cache
    const cachedData = await this.redisService.get<any>(cacheKey);
    if (cachedData) return cachedData;

    // 1. Get list of tag IDs within radius from Redis super fast
    const nearbyTagIds = await this.redisService.getNearby(this.LOST_TAGS_KEY, Number(lng), Number(lat), Number(radiusKm));

    if (!nearbyTagIds || nearbyTagIds.length === 0) return [];

    // 2. Query detailed info from Prisma using the retrieved ID array
    const tags = await this.prisma.tag.findMany({
      where: {
        id: { in: nearbyTagIds },
        status: TagStatus.LOST
      },
      include: {
        pet: {
          include: { images: true, owner: { select: { name: true, phone: true } } }
        }
      }
    });
    const result = tags.map(tag => ({
      tagId: tag.id,
      pet: tag.pet,
      // Can include distance if further calculation is needed
    }));
    await this.redisService.set(cacheKey, result, 600);
    // Format return data for React Native app
    return result;
  }

  async scanTag(tagId: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      include: { pet: { include: { owner: true, images: true } } },
    });

    if (!tag || !tag.pet) throw new NotFoundException('Collar or pet information not found.');

    const pet = tag.pet;
    const isLost = tag.status === TagStatus.LOST;

    // Parse lostPhotos an toàn — trong DB đang lưu dạng JSON string (JSON.stringify(photos || []))
    let lostPhotos: string[] = [];
    if (isLost && pet.lostPhotos) {
      try {
        const parsed = typeof pet.lostPhotos === 'string'
          ? JSON.parse(pet.lostPhotos)
          : pet.lostPhotos;
        if (Array.isArray(parsed)) {
          lostPhotos = parsed.filter((url: any) => typeof url === 'string' && url.trim() !== '');
        }
      } catch (e) {
        console.warn('[scanTag] Failed to parse lostPhotos for pet', pet.id, e);
      }
    }

    // Mảng ảnh gốc của pet (avatar/ảnh thường), để FE nối lostPhotos vào sau
    const originalImages = (pet.images || [])
      .map((img) => img.url)
      .filter((url) => typeof url === 'string' && url.trim() !== '');

    return {
      id: pet.id,
      name: pet.name,
      ownerId: pet.ownerId,
      breed: pet.breed || 'Not updated yet',
      gender: pet.gender || 'unknown',
      color: pet.color || 'Not updated yet',
      dob: pet.dob,
      status: isLost ? 'lost' : 'safe',
      image: originalImages.length > 0 ? originalImages[0] : 'https://via.placeholder.com/600',

      // ✅ THÊM MỚI: trả cả mảng ảnh gốc và ảnh báo lạc để FE ghép slide
      images: originalImages,
      lostPhotos: lostPhotos,

      owner: isLost ? {
        name: pet.lostContactName || pet.owner?.name || 'Anonymous user',
        phone: pet.lostContactPhone?.trim() ? pet.lostContactPhone : 'Phone number not provided',
        address: pet.lostContactAddress?.trim() ? pet.lostContactAddress : 'Address not updated yet',
        avatarUrl: pet.owner?.avatarUrl || null,
      } : null,

      note: pet.lostDetails || "Please contact me ASAP",
    };
  }
}