// src/modules/tags/tags.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TagStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';
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
  private readonly LOST_TAGS_KEY = 'tags:locations:lost'; // Key lưu trong Redis

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private redisService: RedisService // INJECT REDIS
  ) { }

  async getTagReportDetail(id: string, currentUserId?: string) {
    const report = await this.prisma.tagReport.findUnique({
      where: { id },
      include: {
        tag: {
          include: {
            pet: {
              include: {
                owner: true,
                images: true
              }
            }
          }
        }
      },
    });

    if (!report) throw new NotFoundException('Không tìm thấy báo cáo quét thẻ này.');

    const scanHistory = await this.prisma.tagReport.findMany({
      where: { tagId: report.tagId, id: { not: report.id } },
      orderBy: { scannedAt: 'desc' }
    });

    const radius = report.radius || 0; 
    // Logic phân quyền
    const isOwnerOrScanner = currentUserId && (
      currentUserId === report.userId ||
      currentUserId === report.tag?.pet?.ownerId
    );

    const isExactLocation = !!isOwnerOrScanner;

    // 1. XỬ LÝ REPORT CHÍNH
    let finalLat = report.latitude;
    let finalLng = report.longitude;

    if (!isExactLocation && radius > 0 && report.latitude && report.longitude) {
      // Dùng report.id làm seed để đảm bảo random cố định
      const fakePoint = generateFakePointInRadius(report.latitude, report.longitude, radius, `report_${report.id}`);
      finalLat = fakePoint.lat;
      finalLng = fakePoint.lng;
    }

    // 2. XỬ LÝ LỊCH SỬ QUÉT (Bảo mật: Không được leak tọa độ thật)
    const processedScanHistory = scanHistory.map(hist => {
      if (isExactLocation || !hist.radius || !hist.latitude || !hist.longitude) {
        return hist; // Có quyền -> trả tọa độ thật
      }
      
      const fakeHistPoint = generateFakePointInRadius(hist.latitude, hist.longitude, hist.radius, `report_${hist.id}`);
      return {
        ...hist,
        latitude: fakeHistPoint.lat,
        longitude: fakeHistPoint.lng,
        isEstimated: true // Cờ cho Frontend biết đây là tọa độ fake
      };
    });

    // 3. XỬ LÝ VỊ TRÍ PET BÁO MẤT
    const petData = report.tag?.pet;
    if (petData && !isExactLocation && petData.lostLatitude != null && petData.lostLongitude != null && petData.lostRadius != null && petData.lostRadius > 0) {
      const fakeOwnerLost = generateFakePointInRadius(petData.lostLatitude, petData.lostLongitude, petData.lostRadius, `lost_${petData.id}`);
      (report as any).tag.pet.lostLatitude = fakeOwnerLost.lat;
      (report as any).tag.pet.lostLongitude = fakeOwnerLost.lng;
    }

    return {
      ...report,
      latitude: finalLat,     
      longitude: finalLng,
      radius: radius,
      isExactLocation,        
      scanHistory: processedScanHistory // Trả về mảng đã được bảo mật
    };
  }

  async createTagReport(data: CreateTagReportDto) {
    const { tagId, ...reportData } = data;
    const lat = Number(reportData.lat ?? reportData.latitude);
    const lng = Number(reportData.lng ?? reportData.longitude);

    // 1. Lưu report vào database
    const report = await this.prisma.tagReport.create({
      data: {
        tagId: tagId,
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

    // 2. TÍCH HỢP REDIS: Nếu thẻ đang ở trạng thái LOST và có tọa độ, lưu vào bản đồ Redis
    if (report.tag.status === TagStatus.LOST && lat && lng) {
      await this.redisService.addLocation(this.LOST_TAGS_KEY, lng, lat, tagId);
    }

    // 3. Sử dụng NotificationsService để thông báo cho chủ sở hữu
    await this.notificationsService.notifyOwner(report);

    return report;
  }

  async resolveTagReport(reportId: string) {
    const report = await this.prisma.tagReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Không tìm thấy báo cáo quét thẻ này.');

    // Xóa vị trí khỏi bản đồ Redis khi đã được resolve
    await this.redisService.removeLocation(this.LOST_TAGS_KEY, report.tagId);

    return this.prisma.tagReport.update({
      where: { id: reportId },
      data: { status: 'RESOLVED' },
    });
  }

  // ---- TÍNH NĂNG MỚI: TÌM THÚ CƯNG LẠC QUANH ĐÂY BẰNG REDIS ----
  async getNearbyLostPets(lat: number, lng: number, radiusKm: number = 5) {
    const roundedLat = lat.toFixed(2);
    const roundedLng = lng.toFixed(2);
    const cacheKey = `tags:nearby:lat_${roundedLat}:lng_${roundedLng}:radius_${radiusKm}`;

    // 2. Kiểm tra Cache
    const cachedData = await this.redisService.get<any>(cacheKey);
    if (cachedData) return cachedData;
    // 1. Lấy danh sách ID thẻ (tagId) nằm trong bán kính từ Redis cực nhanh
    const nearbyTagIds = await this.redisService.getNearby(this.LOST_TAGS_KEY, Number(lng), Number(lat), Number(radiusKm));

    if (!nearbyTagIds || nearbyTagIds.length === 0) return [];

    // 2. Query thông tin chi tiết từ Prisma bằng mảng ID vừa lấy được
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
      // Có thể kèm theo khoảng cách nếu cần tính toán thêm
    }));
    await this.redisService.set(cacheKey, result, 600);
    // Format data trả về cho app React Native
    return result;
  }

  async scanTag(tagId: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      include: { pet: { include: { owner: true, images: true } } },
    });

    if (!tag || !tag.pet) throw new NotFoundException('Không tìm thấy thông tin vòng cổ hoặc thú cưng.');

    const pet = tag.pet;
    const isLost = tag.status === TagStatus.LOST;

    return {
      id: pet.id,
      name: pet.name,
      breed: pet.breed || 'Chưa cập nhật',
      gender: pet.gender || 'unknown',
      color: pet.color || 'Chưa cập nhật',
      dob: pet.dob,
      status: isLost ? 'lost' : 'safe',
      image: pet.images && pet.images.length > 0 ? pet.images[0].url : 'https://via.placeholder.com/600',

      // SỬA Ở ĐÂY: Gọi đúng các trường lostContactName, lostContactPhone, lostContactAddress
      owner: isLost ? {
        name: pet.lostContactName || pet.owner?.name || 'Người dùng ẩn danh',
        phone: pet.lostContactPhone || pet.owner?.phone || 'Chưa cung cấp số điện thoại',
        address: pet.lostContactAddress || 'Chưa cập nhật địa chỉ',
        avatarUrl: pet.owner?.avatarUrl || null,
      } : null,

      // SỬA Ở ĐÂY: Trả về trường note từ lostDetails trong DB để Frontend hứng được
      note: pet.lostDetails || "Please contact me ASAP",
    };
  }
}