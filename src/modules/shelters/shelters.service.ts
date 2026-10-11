import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GetSheltersDto } from './dto/get-shelters.dto';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from 'src/database/redis/redis.service';

// Shelter duy nhất được phép hiển thị trên app
const ALLOWED_SHELTER_NAME = 'Sân Nhà Nhiều Chó';

@Injectable()
export class SheltersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService
  ) { }

  // =====================================================================
  // FIX: THIS FUNCTION HAS BEEN MOVED TO QUERY THE ORGANIZER TABLE
  // =====================================================================
  async getOrganizerProfile(organizerId: string, userId?: string) {
    const organizer = await this.prisma.organizer.findUnique({
      where: { id: organizerId },
      include: {
        events: {
          orderBy: { startDate: 'desc' }
        }
      },
    });

    if (!organizer) {
      throw new NotFoundException('Organizer not found');
    }

    let isFollowing = false;

    return {
      success: true,
      data: {
        id: organizer.id,
        name: organizer.name,
        handle: organizer.handle || `@${organizer.name.toLowerCase().replace(/\s+/g, '')}`,
        avatar: organizer.avatarUrl || 'https://images.unsplash.com/photo-1517260739337-6799d239ce83?q=80&w=500&auto=format&fit=crop',
        coverImg: organizer.coverUrl || 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=1000&auto=format&fit=crop',
        followers: organizer.followers,
        totalEvents: organizer.events.length,
        about: organizer.about || 'No introductory information about this organizer yet.',
        isFollowing,
        events: organizer.events,
      },
    };
  }

  private async getCacheVersion(userId?: string): Promise<number> {
    const versionKey = `shelters:cache_version:u_${userId || 'guest'}`;
    const version = await this.redisService.get<number>(versionKey);
    return version || 0;
  }

  private async bumpCacheVersion(userId: string) {
    const versionKey = `shelters:cache_version:u_${userId}`;
    const current = await this.getCacheVersion(userId);
    await this.redisService.set(versionKey, current + 1, 0); // 0 = không hết hạn
  }
  
  private async getGlobalCacheVersion(): Promise<number> {
    const v = await this.redisService.get<number>('shelters:cache_version:global');
    return v || 0;
  }

  async bumpGlobalCacheVersion() {
    const current = await this.getGlobalCacheVersion();
    await this.redisService.set('shelters:cache_version:global', current + 1, 0);
  }

  async findAll(query: GetSheltersDto, userId?: string) {
    const { search, page = 1, limit = 10 } = query;

    let blockedIds: string[] = [];
    if (userId) {
      const blocked = await this.prisma.userBlockedShelter.findMany({
        where: { userId },
        select: { shelterId: true }
      });
      blockedIds = blocked.map(b => b.shelterId);
    }

    const [version, globalVersion] = await Promise.all([
      this.getCacheVersion(userId),
      this.getGlobalCacheVersion(),
    ]);
    // Đổi prefix sang "v2" để bỏ qua cache cũ (cache cũ còn chứa các shelter khác)
    const cacheKey = `shelters:v2:all:page_${page}:limit_${limit}:search_${search || 'none'}:u_${userId || 'guest'}:v_${version}:gv_${globalVersion}`;

    const cachedData = await this.redisService.get<any>(cacheKey);
    if (cachedData) return cachedData;

    const lockKey = `${cacheKey}:lock`;
    const isLocked = await this.redisService.get<boolean>(lockKey);

    if (isLocked) {
      await new Promise(resolve => setTimeout(resolve, 200));
      // FIX: truyền userId để không mất danh sách shelter bị chặn khi retry
      return this.findAll(query, userId);
    }
    await this.redisService.set(lockKey, true, 10);

    try {
      const skip = (page - 1) * limit;

      // Chỉ cho phép đúng 1 shelter
      const whereClause: any = {
        name: ALLOWED_SHELTER_NAME,
      };

      if (search) {
        whereClause.AND = [
          {
            OR: [
              { name: { contains: search } },
              { address: { contains: search } },
            ],
          }
        ];
      }

      if (blockedIds.length > 0) {
        whereClause.id = { notIn: blockedIds };
      }

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

      return result;
    } finally {
      // Luôn nhả lock kể cả khi query lỗi
      await this.redisService.del(lockKey);
    }
  }

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

    // Chỉ cho xem chi tiết shelter được phép
    if (!shelter || shelter.name !== ALLOWED_SHELTER_NAME) {
      throw new NotFoundException('Shelter not found');
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
    if (!shelter || shelter.name !== ALLOWED_SHELTER_NAME) {
      throw new NotFoundException('Shelter not found');
    }

    try {
      await this.prisma.followedShelter.create({
        data: {
          userId,
          shelterId,
        },
      });

      return { message: 'Successfully followed the shelter' };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('You are already following this shelter');
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
      return { message: 'Successfully unfollowed the shelter' };
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('You are not following this shelter yet');
      }
      throw error;
    }
  }

  async toggleFollow(shelterId: string, userId: string) {
    const shelter = await this.prisma.shelter.findUnique({
      where: { id: shelterId },
    });

    if (!shelter || shelter.name !== ALLOWED_SHELTER_NAME) {
      throw new NotFoundException('Shelter not found');
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
      await this.prisma.followedShelter.create({
        data: {
          userId,
          shelterId,
        },
      });
      isFollowed = true;
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
    const followedRecords = await this.prisma.followedShelter.findMany({
      where: {
        userId: userId,
        shelter: {
          name: ALLOWED_SHELTER_NAME // Chỉ hiển thị shelter được phép trong danh sách Followed
        }
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

  async blockShelter(shelterId: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.followedShelter.deleteMany({ where: { userId, shelterId } });
      return await tx.userBlockedShelter.upsert({
        where: { userId_shelterId: { userId, shelterId } },
        create: { userId, shelterId },
        update: {}
      });
    });

    await this.bumpCacheVersion(userId);

    return result;
  }

  async reportShelter(shelterId: string, userId: string, reportData: any) {
    const report = await this.prisma.$transaction(async (tx) => {
      const r = await tx.report.create({ data: { userId, targetId: shelterId, type: 'shelter', reason: reportData.reason, detail: reportData.detail } });

      if (reportData.isBlockRequested) {
        await tx.followedShelter.deleteMany({ where: { userId, shelterId } });
        await tx.userBlockedShelter.upsert({
          where: { userId_shelterId: { userId, shelterId } },
          create: { userId, shelterId },
          update: {},
        });
      }
      return r;
    });

    if (reportData.isBlockRequested) {
      await this.bumpCacheVersion(userId);
    }

    return report;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async getSheltersNearBy(lat: number, lng: number, limit: number = 10, userId?: string) {
    const roundedLat = lat.toFixed(2);
    const roundedLng = lng.toFixed(2);

    const [version, globalVersion] = await Promise.all([
      this.getCacheVersion(userId),
      this.getGlobalCacheVersion(),
    ]);
    // Đổi prefix sang "v2" để bỏ qua cache cũ
    const cacheKey = `shelters:v2:nearby:lat_${roundedLat}:lng_${roundedLng}:limit_${limit}:u_${userId || 'guest'}:v_${version}:gv_${globalVersion}`;

    const cachedData = await this.redisService.get<any>(cacheKey);
    if (cachedData) return cachedData;

    const lockKey = `${cacheKey}:lock`;
    if (await this.redisService.get(lockKey)) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return this.getSheltersNearBy(lat, lng, limit, userId);
    }
    await this.redisService.set(lockKey, true, 10);

    try {
      let blockedIds: string[] = [];
      if (userId) {
        const blocked = await this.prisma.userBlockedShelter.findMany({
          where: { userId },
          select: { shelterId: true }
        });
        blockedIds = blocked.map(b => b.shelterId);
      }

      // Chỉ có 1 shelter được phép nên query thẳng DB theo tên,
      // không cần lọc theo Redis GEO nữa (tránh trường hợp shelter bị cắt mất bởi slice(0, limit)
      // trước khi lọc theo tên).
      const shelters = await this.prisma.shelter.findMany({
        where: {
          name: ALLOWED_SHELTER_NAME,
          ...(blockedIds.length > 0 ? { id: { notIn: blockedIds } } : {}),
        },
        take: limit,
      });

      if (shelters.length === 0) {
        const empty = { data: [], meta: { limit, count: 0 } };
        await this.redisService.set(cacheKey, empty, 600);
        return empty;
      }

      const shelterIds = shelters.map(s => s.id);

      const petCounts = await this.prisma.pet.groupBy({
        by: ['shelterId'],
        where: { shelterId: { in: shelterIds }, status: 'AVAILABLE' },
        _count: { _all: true },
      });

      const finalData = shelters.map(shelter => {
        const petCountData = petCounts.find(pc => pc.shelterId === shelter.id);
        const hasCoords = shelter.latitude != null && shelter.longitude != null;
        const distanceVal = hasCoords
          ? this.calculateDistance(lat, lng, shelter.latitude!, shelter.longitude!)
          : null;

        return {
          ...shelter,
          _count: {
            pets: petCountData ? petCountData._count._all : 0
          },
          distance: distanceVal !== null ? `${distanceVal.toFixed(1)} km` : null,
        };
      });

      const result = { data: finalData, meta: { limit, count: finalData.length } };

      await this.redisService.set(cacheKey, result, 600);

      return result;
    } finally {
      // Luôn nhả lock kể cả khi có lỗi hoặc return sớm
      await this.redisService.del(lockKey);
    }
  }
}