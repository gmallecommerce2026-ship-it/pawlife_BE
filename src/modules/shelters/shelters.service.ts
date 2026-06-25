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

    // Because the system currently does not have a separate FollowedOrganizer table (only FollowedShelter), 
    // we temporarily set isFollowing = false. Later, when implementing the follow organizer feature, we will query the secondary table here.
    let isFollowing = false;

    // Mapping returned data to the format requested by FE
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

  // =====================================================================
  // THE REMAINING FUNCTIONS ARE KEPT COMPLETELY UNCHANGED
  // =====================================================================
  async findAll(query: GetSheltersDto, userId?: string) {
    const { search, page = 1, limit = 10 } = query;

    // Nếu có userId, KHÔNG cache theo cách cũ (cache chung không phân biệt user)
    // hoặc đưa userId vào cacheKey — xem lưu ý cache bên dưới
    let blockedIds: string[] = [];
    if (userId) {
      const blocked = await this.prisma.blockedShelter.findMany({
        where: { userId },
        select: { shelterId: true }
      });
      blockedIds = blocked.map(b => b.shelterId);
    }

    const cacheKey = `shelters:all:page_${page}:limit_${limit}:search_${search || 'none'}:u_${userId || 'guest'}`;

    const cachedData = await this.redisService.get<any>(cacheKey);
    if (cachedData) return cachedData;

    const lockKey = `${cacheKey}:lock`;
    const isLocked = await this.redisService.get<boolean>(lockKey);

    if (isLocked) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return this.findAll(query);
    }
    await this.redisService.set(lockKey, true, 10);

    const skip = (page - 1) * limit;
    const whereClause: any = search
      ? {
        OR: [
          { name: { contains: search } },
          { address: { contains: search } },
        ],
      }
      : {};

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
    await this.redisService.del(lockKey);

    return result;
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

    if (!shelter) {
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
    if (!shelter) {
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

    if (!shelter) {
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
    return await this.prisma.$transaction(async (tx) => {
      // 1. Xóa follow nếu đang follow
      await tx.followedShelter.deleteMany({
        where: { userId, shelterId }
      });

      // 2. Tạo record block — dùng upsert để tránh lỗi nếu đã từng block trước đó
      return await tx.blockedShelter.upsert({
        where: {
          userId_shelterId: { userId, shelterId }
        },
        create: { userId, shelterId },
        update: {} // đã tồn tại thì không cần làm gì thêm, coi như thành công
      });
    });
  }

  async reportShelter(
    shelterId: string,
    userId: string,
    reportData: { reason: string; detail?: string; isBlockRequested?: boolean }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          userId,
          targetId: shelterId,
          type: 'shelter',
          reason: reportData.reason,
          detail: reportData.detail,
        },
      });

      if (reportData.isBlockRequested) {
        await tx.followedShelter.deleteMany({ where: { userId, shelterId } });
        await tx.blockedShelter.upsert({
          where: { userId_shelterId: { userId, shelterId } },
          create: { userId, shelterId },
          update: {},
        });
      }

      return report;
    });
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
    const cacheKey = `shelters:nearby:lat_${roundedLat}:lng_${roundedLng}:limit_${limit}`;

    const cachedData = await this.redisService.get<any>(cacheKey);
    if (cachedData) return cachedData;

    const lockKey = `${cacheKey}:lock`;
    if (await this.redisService.get(lockKey)) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return this.getSheltersNearBy(lat, lng, limit);
    }
    await this.redisService.set(lockKey, true, 10);
    const REDIS_KEY = 'shelters:locations';

    let nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);

    if (!nearbyShelterIds || nearbyShelterIds.length === 0) {
      const allShelters = await this.prisma.shelter.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
      });
      for (const s of allShelters) {
        await this.redisService.addLocation(REDIS_KEY, s.longitude!, s.latitude!, s.id);
      }
      nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);
    }

    let blockedIds: string[] = [];
    if (userId) {
      const blocked = await this.prisma.blockedShelter.findMany({
        where: { userId },
        select: { shelterId: true }
      });
      blockedIds = blocked.map(b => b.shelterId);
    }

    const targetIds = nearbyShelterIds
      .filter(id => !blockedIds.includes(id))
      .slice(0, limit);


    if (targetIds.length === 0) {
      return { data: [], meta: { limit, count: 0 } };
    }

    const shelters = await this.prisma.shelter.findMany({
      where: { id: { in: targetIds } },
    });

    const petCounts = await this.prisma.pet.groupBy({
      by: ['shelterId'],
      where: { shelterId: { in: targetIds }, status: 'AVAILABLE' },
      _count: { _all: true },
    });

    const formattedShelters = shelters.map(shelter => {
      const petCountData = petCounts.find(pc => pc.shelterId === shelter.id);
      const distanceVal = this.calculateDistance(lat, lng, shelter.latitude!, shelter.longitude!);

      return {
        ...shelter,
        _count: {
          pets: petCountData ? petCountData._count._all : 0
        },
        distance_val: distanceVal,
      };
    });

    formattedShelters.sort((a, b) => a.distance_val - b.distance_val);

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

    await this.redisService.set(cacheKey, result, 600);
    await this.redisService.del(`${cacheKey}:lock`);

    return result;
  }
}