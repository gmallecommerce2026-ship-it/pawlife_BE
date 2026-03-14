import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GetSheltersDto } from './dto/get-shelters.dto';

@Injectable()
export class SheltersService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy danh sách trạm cứu hộ có phân trang, tìm kiếm và đếm pet AVAILABLE
  async findAll(query: GetSheltersDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Điều kiện tìm kiếm theo tên hoặc địa chỉ
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
          // Lấy số lượng thú cưng đang ở trạng thái AVAILABLE
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

  // Lấy chi tiết trạm cứu hộ và trạng thái follow của user (nếu có)
  async findOne(id: string, userId?: string) {
    const shelter = await this.prisma.shelter.findUnique({
      where: { id },
      include: {
        // Lấy danh sách thú cưng đang AVAILABLE kèm theo hình ảnh
        pets: {
          where: { status: 'AVAILABLE' },
          include: {
            images: true, // Lấy bảng PetImage để hiển thị ảnh trên app
          },
        },
        _count: {
          select: {
            pets: { where: { status: 'AVAILABLE' } },
            followers: true, // Đếm số người theo dõi
          },
        },
      },
    });

    if (!shelter) {
      throw new NotFoundException('Không tìm thấy trạm cứu hộ');
    }

    // Prisma không hỗ trợ alias nhiều điều kiện trên cùng 1 bảng trong _count, 
    // nên ta đếm số lượng pet ADOPTED bằng một query riêng
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
      adoptedCount, // Trả về số lượng đã nhận nuôi
      isFollowed,
    };
  }

  // Theo dõi (Follow) trạm cứu hộ
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
      return { message: 'Đã theo dõi trạm cứu hộ thành công' };
    } catch (error) {
      // Bắt lỗi vi phạm unique constraint (đã follow rồi)
      if (error.code === 'P2002') {
        throw new ConflictException('Bạn đã theo dõi trạm cứu hộ này rồi');
      }
      throw error;
    }
  }

  // Bỏ theo dõi (Unfollow) trạm cứu hộ
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
      // Lỗi không tìm thấy bản ghi để xóa (Prisma error code P2025)
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

    // Kiểm tra xem user đã follow trạm này chưa
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
      // Nếu đã follow -> Thực hiện Unfollow
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
      // Nếu chưa follow -> Thực hiện Follow
      await this.prisma.followedShelter.create({
        data: {
          userId,
          shelterId,
        },
      });
      isFollowed = true;
    }

    // Đếm lại tổng số lượng follower mới nhất của trạm cứu hộ
    const followersCount = await this.prisma.followedShelter.count({
      where: {
        shelterId,
      },
    });

    // Trả về dữ liệu để App cập nhật đồng bộ UI
    return {
      success: true,
      isFollowed,
      followersCount,
    };
  }
  
  async getSheltersNearBy(lat: number, lng: number, limit: number = 10) {
    // Truy vấn tính khoảng cách và lọc các trạm có khai báo tọa độ
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

    // Cần đếm thêm số pet AVAILABLE của các trạm vừa tìm được để UI có thể hiển thị
    const shelterIds = shelters.map(s => s.id);
    const petCounts = shelterIds.length > 0
      ? await this.prisma.pet.groupBy({
          by: ['shelterId'],
          where: { shelterId: { in: shelterIds }, status: 'AVAILABLE' },
          _count: { _all: true },
        })
      : [];

    // Map dữ liệu đếm thú cưng và format lại khoảng cách
    const formattedShelters = shelters.map(shelter => {
      const petCountData = petCounts.find(pc => pc.shelterId === shelter.id);
      return {
        ...shelter,
        _count: {
          pets: petCountData ? petCountData._count._all : 0
        },
        distance: `${Number(shelter.distance_km).toFixed(1)} km`,
        distance_km: undefined, // Ẩn trường thô
      };
    });

    return {
      data: formattedShelters,
      meta: { limit, count: formattedShelters.length }
    };
  }
}