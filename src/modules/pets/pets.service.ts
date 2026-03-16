import { Injectable, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SwipePetDto } from './dto/swipe-pet.dto';
import { PetGender, PetSize, Prisma, NotificationType } from '@prisma/client';
import { CreatePetDto } from './dto/create-pet.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { TagStatus } from '@prisma/client';
export interface FeedFilters {
  gender?: PetGender;
  size?: PetSize;
  species?: string;
}
const ownerSelectQuery = {
  select: {
    id: true,
    fullName: true,
    avatar: true,
    phoneNumber: true, // Chỉ trả về khi cần thiết (ví dụ: pet đang bị thất lạc)
    address: true,
  },
};
@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService // Inject NotificationsService
  ) {}

  async getFeed(userId: string, limit: number, filters?: FeedFilters, lat?: number, lng?: number) {
    const { gender, size, species } = filters || {};

    if (lat && lng) {
      const genderCondition = gender ? Prisma.sql`AND p.gender = ${gender}` : Prisma.empty;
      const sizeCondition = size ? Prisma.sql`AND p.size = ${size}` : Prisma.empty;
      const speciesCondition = species ? Prisma.sql`AND p.species = ${species}` : Prisma.empty;

      // Bước 1: Tìm thú cưng CHƯA TỪNG tương tác
      let pets: any[] = await this.prisma.$queryRaw`
        SELECT 
          p.*, 
          s.name as shelterName, 
          s.avatarUrl as shelterAvatarUrl,
          (6371 * acos(
            cos(radians(${lat})) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(${lng})) + 
            sin(radians(${lat})) * sin(radians(s.latitude))
          )) AS distance_km
        FROM Pet p
        JOIN Shelter s ON p.shelterId = s.id
        WHERE p.status = 'AVAILABLE'
          AND p.id NOT IN (SELECT petId FROM PetInteraction WHERE userId = ${userId})
          AND s.latitude IS NOT NULL 
          AND s.longitude IS NOT NULL
          ${genderCondition}
          ${sizeCondition}
          ${speciesCondition}
        ORDER BY distance_km ASC
        LIMIT ${limit};
      `;

      // Bước 2 (Fallback): Nếu đã hết thú cưng mới, lấy lại những thú cưng đã quẹt trái (PASS)
      if (pets.length === 0) {
        pets = await this.prisma.$queryRaw`
          SELECT 
            p.*, 
            s.name as shelterName, 
            s.avatarUrl as shelterAvatarUrl,
            (6371 * acos(
              cos(radians(${lat})) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(${lng})) + 
              sin(radians(${lat})) * sin(radians(s.latitude))
            )) AS distance_km
          FROM Pet p
          JOIN Shelter s ON p.shelterId = s.id
          WHERE p.status = 'AVAILABLE'
            -- Chỉ lọc bỏ những bé đã thao tác khác 'PASS' (VD: đã 'LIKE')
            AND p.id NOT IN (SELECT petId FROM PetInteraction WHERE userId = ${userId} AND action != 'PASS')
            AND s.latitude IS NOT NULL 
            AND s.longitude IS NOT NULL
            ${genderCondition}
            ${sizeCondition}
            ${speciesCondition}
          ORDER BY distance_km ASC
          LIMIT ${limit};
        `;
      }

      const petIds = pets.map(p => p.id);
      const images = petIds.length > 0 
      ? await this.prisma.petImage.findMany({ 
          where: { petId: { in: petIds } },
          orderBy: { createdAt: 'asc' } // <--- THÊM DÒNG NÀY ĐỂ ĐẢM BẢO THỨ TỰ ẢNH
        })
      : [];

      const formattedData = pets.map(pet => {
        const petImages = images.filter(img => img.petId === pet.id);
        return {
          ...pet,
          images: petImages,
          shelter: {
            name: pet.shelterName,
            avatarUrl: pet.shelterAvatarUrl
          },
          distance: `${Number(pet.distance_km).toFixed(1)} km`,
          distance_km: undefined,
          shelterName: undefined,
          shelterAvatarUrl: undefined
        };
      });

      return { data: formattedData, meta: { limit, count: formattedData.length, filters } };
    }

    // Xử lý luồng tương tự cho trường hợp KHÔNG có lat/lng
    const whereCondition: Prisma.PetWhereInput = {
      status: 'AVAILABLE',
      interactions: {
        none: { userId: userId },
      },
      ...(gender && { gender }),
      ...(size && { size }),
      ...(species && { species }),
    };

    let pets = await this.prisma.pet.findMany({
      where: whereCondition,
      take: limit,
      orderBy: { createdAt: 'desc' }, // <--- THÊM DÒNG NÀY ĐỂ FIX THỨ TỰ
      include: {
        images: {
          orderBy: { createdAt: 'asc' } 
        },
        shelter: { select: { name: true, avatarUrl: true } }
      }
  });

    // Fallback cho luồng Prisma query
    if (pets.length === 0) {
      pets = await this.prisma.pet.findMany({
        where: {
          ...whereCondition,
          interactions: {
            none: { 
              userId: userId, 
              action: { not: 'PASS' } // Chỉ loại bỏ nếu action là 'LIKE' (cho phép 'PASS' đi qua)
            },
          },
        },
        take: limit,
        include: {
          images: { orderBy: { createdAt: 'asc' } }, // <--- THÊM DÒNG NÀY
          shelter: { select: { name: true, avatarUrl: true } }
        }
      });
    }

    return { data: pets, meta: { limit, count: pets.length, filters } };
  }

  async swipePet(userId: string, petId: string, swipePetDto: SwipePetDto) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    const interaction = await this.prisma.petInteraction.upsert({
      where: {
        userId_petId: {
          userId: userId,
          petId: petId,
        },
      },
      update: {
        action: swipePetDto.action,
      },
      create: {
        userId: userId,
        petId: petId,
        action: swipePetDto.action,
      },
    });

    return {
      message: `Đã ${swipePetDto.action.toLowerCase()} thú cưng thành công!`,
      data: interaction,
    };
  }

  async addFavorite(userId: string, petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    const existingFavorite = await this.prisma.favoritePet.findUnique({
      where: {
        userId_petId: {
          userId: userId,
          petId: petId,
        },
      },
    });

    if (existingFavorite) {
      return {
        message: 'Thú cưng này đã nằm trong danh sách yêu thích của bạn từ trước.',
        data: existingFavorite,
      };
    }

    const favorite = await this.prisma.favoritePet.create({
      data: {
        userId: userId,
        petId: petId,
      },
    });

    return {
      message: 'Đã lưu thú cưng vào danh sách yêu thích thành công!',
      data: favorite,
    };
  }

  async removePet(userId: string, petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException('Bạn không có quyền xóa thú cưng này!');
    }

    await this.prisma.pet.delete({
      where: { id: petId },
    });

    return { message: 'Đã xóa thú cưng thành công!' };
  }

  async toggleLostMode(userId: string, petId: string, isLost: boolean) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException('Bạn không có quyền thay đổi trạng thái thú cưng này!');
    }

    const newStatus = isLost ? 'LOST' : 'ACTIVE';
    
    await this.prisma.tag.updateMany({
      where: { petId: petId },
      data: { status: newStatus },
    });

    // Bắn thông báo xác nhận đã Bật / Tắt chế độ báo lạc
    await this.notificationsService.createAndSendNotification({
      userId: userId,
      title: isLost ? '🚨 Báo động đi lạc!' : '✅ Thú cưng an toàn',
      body: isLost 
        ? `Bạn đã BẬT chế độ báo lạc cho bé ${pet.name}. Hệ thống sẽ thông báo ngay nếu có người quét mã vòng cổ!` 
        : `Bạn đã TẮT chế độ báo lạc cho bé ${pet.name}. Chúc mừng bé đã về nhà an toàn.`,
      type: NotificationType.TAG,
      referenceId: petId,
    });

    return {
      message: isLost ? 'Đã bật chế độ báo lạc!' : 'Đã tắt chế độ báo lạc, thú cưng an toàn.',
      isLost: isLost,
    };
  }

  async removeFavorite(userId: string, petId: string) {
    const existingFavorite = await this.prisma.favoritePet.findUnique({
      where: {
        userId_petId: { userId, petId },
      },
    });

    if (!existingFavorite) {
      throw new NotFoundException('Thú cưng này không nằm trong danh sách yêu thích của bạn!');
    }

    await this.prisma.favoritePet.delete({
      where: {
        userId_petId: { userId, petId },
      },
    });

    return {
      message: 'Đã bỏ yêu thích thú cưng này!',
    };
  }

  async getFavorites(userId: string, skip: number, take: number) {
    const favorites = await this.prisma.favoritePet.findMany({
      where: { userId: userId },
      skip: skip,
      take: take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        pet: {
          include: {
            images: {
              take: 1,
              orderBy: { createdAt: 'asc' } // <--- THÊM DÒNG NÀY
            },
            shelter: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    const totalCount = await this.prisma.favoritePet.count({
      where: { userId: userId },
    });

    return {
      data: favorites.map((fav) => fav.pet), 
      meta: {
        skip,
        take,
        totalCount,
      },
    };
  }

  async getMyPets(userId: string) {
    try {
      const pets = await this.prisma.pet.findMany({
        where: { 
          ownerId: userId,
          status: 'ADOPTED', 
        },
        include: {
          images: {
            orderBy: { createdAt: 'asc' },
          }
        },
      });

      return pets.map((pet) => ({
        ...pet,
        avatarUrl: pet.images && pet.images.length > 0 ? pet.images[0].url : null,
      }));
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi lấy danh sách thú cưng của người dùng');
    }
  }

  async createPet(userId: string, createPetDto: CreatePetDto) {
    const { images, ...petData } = createPetDto;

    try {
      const newPet = await this.prisma.pet.create({
        data: {
          ...petData,
          ownerId: userId,
          status: 'ADOPTED', 
          ...(images && images.length > 0 && {
            images: {
              create: images.map(url => ({ url }))
            }
          })
        },
        include: {
          images: true,
        }
      });

      return newPet;
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi thêm thú cưng');
    }
  }

  async searchPets(params: { search?: string; type?: string; limit?: number }) {
    const { search, type, limit = 20 } = params;

    const whereCondition: Prisma.PetWhereInput = {
      status: 'AVAILABLE',
    };

    if (search) {
      whereCondition.OR = [
        { name: { contains: search } },
        { breed: { contains: search } },
      ];
    }

    if (type) {
      whereCondition.species = type.toUpperCase() as any; 
    }

    const pets = await this.prisma.pet.findMany({
      where: whereCondition,
      take: limit,
      include: {
        images: {
          orderBy: { createdAt: 'asc' } // <--- THÊM DÒNG NÀY
        },
        shelter: {
          select: { id: true, name: true, avatarUrl: true }
        }
      },
      orderBy: {  }
    });

    return {
      success: true,
      data: pets,
    };
  }

  async getPetById(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        owner: ownerSelectQuery,
        images: {
          orderBy: { createdAt: 'asc' } // <--- THÊM DÒNG NÀY
        },
        tags: true,
        shelter: {
          select: { id: true, name: true, contactInfo: true, address: true, avatarUrl: true }
        },
      },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thông tin thú cưng này!');
    }

    let formattedShelter: any = null;
    if (pet.shelter) {
      formattedShelter = {
        ...pet.shelter,
        phone: pet.shelter.contactInfo,
      };
    }

    let formattedOwner: any = null;
    if (pet.owner) {
      formattedOwner = {
        ...pet.owner,
        address: 'Chưa cập nhật',
      };
    }

    return {
      ...pet,
      shelter: formattedShelter,
      owner: formattedOwner,
      avatarUrl: pet.images && pet.images.length > 0 ? pet.images[0].url : null,
    };
  }
  async getPetByTagId(tagId: string) {
    // 1. SỬA LỖI 1: Phải query từ bảng Tag, không query từ bảng Pet
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId }, 
      include: {
        pet: {
          include: {
            // 2. SỬA LỖI 3: Bắt buộc phải include owner thì TypeScript mới nhận diện được `pet.owner`
            owner: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                phone: true, // Lấy đúng tên trường trong User schema
              },
            },
          },
        },
      },
    });

    if (!tag || !tag.pet) {
      throw new NotFoundException('Không tìm thấy thú cưng với mã thẻ này');
    }

    const pet = tag.pet;
    
    // 3. SỬA LỖI 2: Xác định trạng thái thất lạc từ bảng Tag, không lấy từ Pet
    const isLost = tag.status === TagStatus.LOST;

    // Logic bảo mật: Ẩn số điện thoại nếu thú cưng không ở trạng thái LOST
    if (!isLost && pet.owner) {
      pet.owner.phone = null;
    }

    // Trả về object gom chung data của pet, owner và cờ isLost để frontend dễ xử lý
    return {
      ...pet,
      isLost: isLost, 
    };
  }
  async updatePet(userId: string, petId: string, updateData: any) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException('Bạn không có quyền chỉnh sửa thông tin thú cưng này!');
    }

    const { images, ...petInfo } = updateData;

    try {
      const updatedPet = await this.prisma.pet.update({
        where: { id: petId },
        data: {
          ...petInfo,
          ...(images && images.length > 0 && {
            images: {
              deleteMany: {},
              create: images.map((url: string) => ({ url }))
            }
          })
        },
        include: { images: true }
      });

      return {
        message: 'Cập nhật thông tin thú cưng thành công',
        data: updatedPet
      };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi cập nhật thông tin thú cưng');
    }
  }
}