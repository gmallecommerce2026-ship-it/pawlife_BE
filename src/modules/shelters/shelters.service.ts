import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GetSheltersDto } from './dto/get-shelters.dto';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SheltersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService // Inject NotificationsService
  ) {}

  async findAll(query: GetSheltersDto) {
    const { search, page = 1, limit = 10 } = query;
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
            select: {
              pets: {
                where: { status: 'AVAILABLE' },
              },
            },
          },
        },
      }),
      this.prisma.shelter.count({ where: whereClause }),
    ]);

    return {
      data: shelters,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    } catch (error) {
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
    } catch (error) {
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
  
  async getSheltersNearBy(lat: number, lng: number, limit: number = 10) {
    const shelters: any[] = await this.prisma.$queryRaw`
      SELECT 
        s.id, s.name, s.address, s.contactInfo, s.avatarUrl, s.coverUrl, s.latitude, s.longitude,
        (6371 * acos(
          cos(radians(${lat})) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(${lng})) + 
          sin(radians(${lat})) * sin(radians(s.latitude))
        )) AS distance_km
      FROM Shelter s
      WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
      ORDER BY distance_km ASC
      LIMIT ${limit};
    `;

    const shelterIds = shelters.map(s => s.id);
    const petCounts = shelterIds.length > 0
      ? await this.prisma.pet.groupBy({
          by: ['shelterId'],
          where: { shelterId: { in: shelterIds }, status: 'AVAILABLE' },
          _count: { _all: true },
        })
      : [];

    const formattedShelters = shelters.map(shelter => {
      const petCountData = petCounts.find(pc => pc.shelterId === shelter.id);
      return {
        ...shelter,
        _count: {
          pets: petCountData ? petCountData._count._all : 0
        },
        distance: `${Number(shelter.distance_km).toFixed(1)} km`,
        distance_km: undefined, 
      };
    });

    return {
      data: formattedShelters,
      meta: { limit, count: formattedShelters.length }
    };
  }
}