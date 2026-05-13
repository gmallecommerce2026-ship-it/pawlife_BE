// src/modules/tags/tags.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TagStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';
import { RedisService } from '../../database/redis/redis.service'; // IMPORT REDIS

@Injectable()
export class TagsService {
  private readonly LOST_TAGS_KEY = 'tags:locations:lost'; // Key lưu trong Redis

  constructor(
    private prisma: PrismaService, 
    private notificationsService: NotificationsService,
    private redisService: RedisService // INJECT REDIS
  ) {}
  
  async getTagReportDetail(id: string) {
    const report = await this.prisma.tagReport.findUnique({
      where: { id },
      include: { tag: { include: { pet: { include: { owner: true, images: true } } } } },
    });

    if (!report) throw new NotFoundException('Không tìm thấy báo cáo quét thẻ này.');

    const scanHistory = await this.prisma.tagReport.findMany({
      where: { tagId: report.tagId, id: { not: report.id } },
      orderBy: { scannedAt: 'desc' }
    });

    return { ...report, scanHistory };
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
      status: isLost ? 'lost' : 'safe',
      image: pet.images && pet.images.length > 0 ? pet.images[0].url : 'https://via.placeholder.com/600',
      owner: isLost ? {
        name: pet.contactName || pet.owner?.name || 'Người dùng ẩn danh',
        phone: pet.contactPhone || pet.owner?.phone || 'Chưa cung cấp số điện thoại',
        address: pet.contactAddress || 'Chưa cập nhật địa chỉ', 
        avatarUrl: pet.owner?.avatarUrl || null,
      } : null,
    };
  }
}