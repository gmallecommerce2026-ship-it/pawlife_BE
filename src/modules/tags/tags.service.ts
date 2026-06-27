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
        tag: { include: { pet: { include: { owner: true, images: true } } } }
      },
    });

    if (!report) throw new NotFoundException('Tag scan report not found.');

    const isOwner = currentUserId && currentUserId === report.tag?.pet?.ownerId;
    const isMainScanner = currentUserId && currentUserId === report.userId;

    // 🌟 KHÔNG 404 nữa dù report chính có isHidden = true.
    // Trang theo dõi của owner vẫn phải load được luôn, isHidden chỉ là
    // cờ để loại record đó khỏi danh sách hiển thị (xử lý ở dưới + ở FE)

    const scanHistory = await this.prisma.tagReport.findMany({
      where: {
        tagId: report.tagId,
        id: { not: report.id },
        isHidden: false, // ✅ chỉ ẩn khỏi list lịch sử, luôn áp dụng cho mọi người xem
      },
      orderBy: { scannedAt: 'desc' }
    });

    const radius = report.radius || 0;

    let finalLat = report.latitude;
    let finalLng = report.longitude;
    let isExactLocation = !!isMainScanner;

    if (!isExactLocation && radius > 0 && report.latitude && report.longitude) {
      const fakePoint = generateFakePointInRadius(report.latitude, report.longitude, radius, `scan_${report.id}`);
      finalLat = fakePoint.lat;
      finalLng = fakePoint.lng;
    }

    const processedScanHistory = scanHistory.map(hist => {
      const isHistScanner = currentUserId && currentUserId === hist.userId;
      const canViewHistExact = isHistScanner;

      if (canViewHistExact || !hist.radius || !hist.latitude || !hist.longitude) {
        return { ...hist, isEstimated: false };
      }

      const fakeHistPoint = generateFakePointInRadius(hist.latitude, hist.longitude, hist.radius, `scan_${hist.id}`);
      return {
        ...hist,
        latitude: fakeHistPoint.lat,
        longitude: fakeHistPoint.lng,
        isEstimated: true
      };
    });

    return {
      ...report,
      latitude: finalLat,
      longitude: finalLng,
      radius: radius,
      isExactLocation,
      isOwner,
      isHidden: report.isHidden, // 🌟 trả về cờ này để FE biết và tự lọc nếu cần
      scanHistory: processedScanHistory
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

    if (!report) {
      throw new NotFoundException('Tag scan report not found.');
    }

    const isOwner = report.tag?.pet?.ownerId === currentUserId;

    // Bảo vệ phía server: dù FE đã ẩn switch Hide/Block với người không phải owner
    // (allowModeration={isOwner} trong ReportUGCModal), vẫn phải chặn lại ở đây
    // để tránh người dùng tự ý gửi request tay (Postman/curl) bypass UI.
    if ((isHideRequested || isBlockRequested) && !isOwner) {
      throw new ForbiddenException('Only the pet owner can hide or block this content.');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Luôn lưu báo cáo — kể cả khi người gửi không phải owner,
      //    miễn họ đã đăng nhập (mọi user đều có quyền report nội dung).
      await tx.contentReport.create({
        data: {
          reporterId: currentUserId,
          targetTagReportId: tagReportId,
          reason,
          details,
        },
      });

      // 2. Ẩn report cụ thể này khỏi timeline (chỉ owner mới tới được đây)
      if (isHideRequested) {
        await tx.tagReport.update({
          where: { id: tagReportId },
          data: { isHidden: true, hiddenAt: new Date() },
        });
      }

      // 3. Chặn người quét — bỏ qua nếu họ quét ẩn danh (không có userId)
      //    hoặc nếu vô tình block chính bản thân mình
      if (isBlockRequested && report.userId && report.userId !== currentUserId) {
        await tx.userBlock.upsert({
          where: {
            blockerId_blockedId: { blockerId: currentUserId, blockedId: report.userId },
          },
          create: { blockerId: currentUserId, blockedId: report.userId },
          update: {},
        });
      }
    });

    if (report.tag?.pet?.id) {
      await this.redisService.del(`pet:detail:${report.tag.pet.id}`);
    }

    return {
      success: true,
      message: 'Đã gửi báo cáo thành công.',
    };
  }

  async createTagReport(data: CreateTagReportDto, currentUserId?: string) {
    const { tagId, ...reportData } = data;
    const lat = Number(reportData.lat ?? reportData.latitude);
    const lng = Number(reportData.lng ?? reportData.longitude);

    const report = await this.prisma.tagReport.create({
      data: {
        tagId: tagId,
        userId: currentUserId, // 🌟 SAVE SCANNER ID HERE
        latitude: lat,
        longitude: lng,
        radius: reportData.radius,
        scannedBy: reportData.scannedBy,
        phoneNumber: reportData.phoneNumber,
        message: reportData.message,
        images: reportData.images,
      },
      include: { tag: { include: { pet: { include: { owner: true } } } } },
    });

    // 2. REDIS INTEGRATION: If tag is LOST and has coordinates, save to Redis map
    if (report.tag.status === TagStatus.LOST && lat && lng) {
      await this.redisService.addLocation(this.LOST_TAGS_KEY, lng, lat, tagId);
    }

    // 3. Use NotificationsService to notify the owner
    await this.notificationsService.notifyOwner(report);

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

    return {
      id: pet.id,
      name: pet.name,
      ownerId: pet.ownerId,
      breed: pet.breed || 'Not updated yet',
      gender: pet.gender || 'unknown',
      color: pet.color || 'Not updated yet',
      dob: pet.dob,
      status: isLost ? 'lost' : 'safe',
      image: pet.images && pet.images.length > 0 ? pet.images[0].url : 'https://via.placeholder.com/600',

      // FIX HERE: Call the exact fields lostContactName, lostContactPhone, lostContactAddress
      owner: isLost ? {
        name: pet.lostContactName || pet.owner?.name || 'Anonymous user',
        phone: pet.lostContactPhone || pet.owner?.phone || 'Phone number not provided',
        address: pet.lostContactAddress || 'Address not updated yet',
        avatarUrl: pet.owner?.avatarUrl || null,
      } : null,

      // FIX HERE: Return note field from lostDetails in DB so Frontend can catch it
      note: pet.lostDetails || "Please contact me ASAP",
    };
  }
}