import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GetSheltersDto } from './dto/get-shelters.dto';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from 'src/database/redis/redis.service';

@Injectable()
export class SheltersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService, // Inject NotificationsService
    private readonly redisService: RedisService
  ) {}

  async findAll(query: GetSheltersDto) {
    const { search, page = 1, limit = 10 } = query;
    const cacheKey = `shelters:all:page_${page}:limit_${limit}:search_${search || 'none'}`;

    const cachedData = await this.redisService.get<any>(cacheKey);
    if (cachedData) return cachedData;

    // 1. CƠ CHẾ CHỐNG CACHE STAMPEDE
    const lockKey = `${cacheKey}:lock`;
    const isLocked = await this.redisService.get<boolean>(lockKey);
    
    if (isLocked) {
      // Đợi 200ms rồi lấy lại cache thay vì query DB
      await new Promise(resolve => setTimeout(resolve, 200));
      return this.findAll(query);
    }
    // Set lock trong 10 giây
    await this.redisService.set(lockKey, true, 10);

    const skip = (page - 1) * limit;
    const whereClause = search
      ? {
          OR: [
            { name: { contains: search } },
            { address: { contains: search } },
          ],
        }
      : {};

    const [shelters, total] = await Promise.all([
      this.prisma.shelter.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          _count: {
            select: { pets: { where: { status: 'AVAILABLE' } } },
          },
        },
      }),
      this.prisma.shelter.count({ where: whereClause }),
    ]);

    const result = {
      data: shelters,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };

    await this.redisService.set(cacheKey, result, 3600);
    await this.redisService.del(lockKey); // Xóa lock sau khi nạp cache xong

    return result;
  }

  // =====================================================================
  // TẤT CẢ CÁC HÀM BÊN DƯỚI ĐƯỢC GIỮ NGUYÊN 100% ĐỂ ĐẢM BẢO KHÔNG BỊ HỎNG
  // =====================================================================

  async findOne(id: string, userId?: string) {
    const shelter = await this.prisma.shelter.findUnique({
      where: { id },
      include: {
        pets: {
          where: { status: 'AVAILABLE' },
          include: {
            images: true,
          },
        },
        _count: {
          select: {
            pets: { where: { status: 'AVAILABLE' } },
            followers: true,
          },
        },
      },
    });

    if (!shelter) {
      throw new NotFoundException('Không tìm thấy trạm cứu hộ');
    }

    const adoptedCount = await this.prisma.pet.count({
      where: { 
        shelterId: id, 
        status: 'ADOPTED' 
      },
    });

    let isFollowed = false;
    
    if (userId) {
      const followRecord = await this.prisma.followedShelter.findUnique({
        where: {
          userId_shelterId: {
            userId,
            shelterId: id,
          },
        },
      });
      isFollowed = !!followRecord;
    }

    return {
      ...shelter,
      adoptedCount,
      isFollowed,
    };
  }

  async follow(shelterId: string, userId: string) {
    const shelter = await this.prisma.shelter.findUnique({ where: { id: shelterId } });
    if (!shelter) {
      throw new NotFoundException('Không tìm thấy trạm cứu hộ');
    }

    try {
      await this.prisma.followedShelter.create({
        data: {
          userId,
          shelterId,
        },
      });

      // Bắn thông báo xác nhận follow thành công
      await this.notificationsService.createAndSendNotification({
        userId: userId,
        title: '🏠 Đã theo dõi trạm cứu hộ',
        body: `Bạn đã bắt đầu theo dõi trạm cứu hộ ${shelter.name}. Bạn sẽ nhận được các thông tin mới nhất từ họ.`,
        type: NotificationType.SYSTEM,
        referenceId: shelterId,
      });

      return { message: 'Đã theo dõi trạm cứu hộ thành công' };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Bạn đã theo dõi trạm cứu hộ này rồi');
      }
      throw error;
    }
  }

  async unfollow(shelterId: string, userId: string) {
    try {
      await this.prisma.followedShelter.delete({
        where: {
          userId_shelterId: {
            userId,
            shelterId,
          },
        },
      });
      return { message: 'Đã bỏ theo dõi trạm cứu hộ thành công' };
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Bạn chưa theo dõi trạm cứu hộ này');
      }
      throw error;
    }
  }

  async toggleFollow(shelterId: string, userId: string) {
    const shelter = await this.prisma.shelter.findUnique({
      where: { id: shelterId },
    });

    if (!shelter) {
      throw new NotFoundException('Không tìm thấy trạm cứu hộ');
    }

    const existingFollow = await this.prisma.followedShelter.findUnique({
      where: {
        userId_shelterId: {
          userId,
          shelterId,
        },
      },
    });

    let isFollowed = false;

    if (existingFollow) {
      // Unfollow
      await this.prisma.followedShelter.delete({
        where: {
          userId_shelterId: {
            userId,
            shelterId,
          },
        },
      });
      isFollowed = false;
    } else {
      // Follow
      await this.prisma.followedShelter.create({
        data: {
          userId,
          shelterId,
        },
      });
      isFollowed = true;

      // Bắn thông báo khi Follow thành công
      await this.notificationsService.createAndSendNotification({
        userId: userId,
        title: '🏠 Đã theo dõi trạm cứu hộ',
        body: `Bạn đã bắt đầu theo dõi ${shelter.name}. Bạn sẽ nhận được các thông tin mới nhất từ họ.`,
        type: NotificationType.SYSTEM,
        referenceId: shelterId,
      });
    }

    const followersCount = await this.prisma.followedShelter.count({
      where: {
        shelterId,
      },
    });

    return {
      success: true,
      isFollowed,
      followersCount,
    };
  }

  async getFollowedSheltersByUser(userId: string) {
    // Truy vấn database để lấy các trạm cứu hộ mà user này đã theo dõi
    const followedRecords = await this.prisma.followedShelter.findMany({
      where: {
        userId: userId,
      },
      include: {
        shelter: {
          include: {
            _count: {
              select: { 
                pets: { where: { status: 'AVAILABLE' } },
                followers: true 
              }
            }
          }
        },
      },
    });

    // Map lại dữ liệu trả về để khớp với những gì Frontend (FollowedSheltersScreen) đang cần hiển thị
    return followedRecords.map(record => {
      const shelter = record.shelter;
      return {
        id: shelter.id,
        name: shelter.name,
        address: shelter.address,
        imageUrl: shelter.avatarUrl || shelter.coverUrl || 'https://via.placeholder.com/200',
        isFollowing: true,
        _count: shelter._count
      };
    });
  }
  // Hàm tính khoảng cách bằng thuật toán Haversine trên Node.js
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Bán kính trái đất tính bằng km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  async getSheltersNearBy(lat: number, lng: number, limit: number = 10) {
    const roundedLat = lat.toFixed(2);
    const roundedLng = lng.toFixed(2);
    const cacheKey = `shelters:nearby:lat_${roundedLat}:lng_${roundedLng}:limit_${limit}`;

    const cachedData = await this.redisService.get<any>(cacheKey);
    if (cachedData) return cachedData;

    // CƠ CHẾ CHỐNG CACHE STAMPEDE
    const lockKey = `${cacheKey}:lock`;
    if (await this.redisService.get(lockKey)) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return this.getSheltersNearBy(lat, lng, limit);
    }
    await this.redisService.set(lockKey, true, 10);
    const REDIS_KEY = 'shelters:locations';
    
    // 1. Lấy danh sách ID trạm từ Redis (Bán kính 50km)
    let nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);

    // [AUTO-SYNC] Nếu Redis trống, tự động nạp tọa độ từ Database vào Redis
    if (!nearbyShelterIds || nearbyShelterIds.length === 0) {
      const allShelters = await this.prisma.shelter.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
      });
      for (const s of allShelters) {
        await this.redisService.addLocation(REDIS_KEY, s.longitude!, s.latitude!, s.id);
      }
      nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);
    }

    // Lấy số lượng vừa đủ limit để tối ưu query
    const targetIds = nearbyShelterIds.slice(0, limit);

    if (targetIds.length === 0) {
      return { data: [], meta: { limit, count: 0 } };
    }

    // 2. Query MySQL với mảng ID (Tối ưu cực độ, bỏ hoàn toàn QueryRaw toán học)
    const shelters = await this.prisma.shelter.findMany({
      where: { id: { in: targetIds } },
    });

    const petCounts = await this.prisma.pet.groupBy({
      by: ['shelterId'],
      where: { shelterId: { in: targetIds }, status: 'AVAILABLE' },
      _count: { _all: true },
    });

    // 3. Tính khoảng cách trên RAM và format chuẩn dữ liệu cũ
    const formattedShelters = shelters.map(shelter => {
      const petCountData = petCounts.find(pc => pc.shelterId === shelter.id);
      const distanceVal = this.calculateDistance(lat, lng, shelter.latitude!, shelter.longitude!);
      
      return {
        ...shelter,
        _count: {
          pets: petCountData ? petCountData._count._all : 0
        },
        distance_val: distanceVal, // Biến tạm để sắp xếp
      };
    });

    // Sắp xếp mảng từ gần đến xa
    formattedShelters.sort((a, b) => a.distance_val - b.distance_val);

    // Gắn format text distance và dọn dẹp biến tạm
    const finalData = formattedShelters.map(s => {
      const formattedData = {
         ...s,
         distance: `${s.distance_val.toFixed(1)} km`,
      };
      delete (formattedData as any).distance_val;
      return formattedData;
    });

    const result = {
      data: finalData,
      meta: { limit, count: finalData.length }
    };

    // 3. Cache lại kết quả trong 10 phút (600s)
    await this.redisService.set(cacheKey, result, 600);

    // THÊM DÒNG NÀY: Mở khóa ngay lập tức để giải phóng cho các request đang đợi
    await this.redisService.del(`${cacheKey}:lock`); 

    return result;
  }
}