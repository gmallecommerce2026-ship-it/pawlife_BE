import { Injectable, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SwipePetDto } from './dto/swipe-pet.dto';
import { PetGender, PetSize, Prisma } from '@prisma/client';
import { CreatePetDto } from './dto/create-pet.dto';

export interface FeedFilters {
  gender?: PetGender;
  size?: PetSize;
  species?: string;
}

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) { }

  // API 1: Lấy danh sách thú cưng chưa được quẹt
  async getFeed(userId: string, limit: number, filters?: FeedFilters, lat?: number, lng?: number) {
    const { gender, size, species } = filters || {};

    // NẾU CÓ TỌA ĐỘ -> SỬ DỤNG RAW SQL ĐỂ TÍNH KHOẢNG CÁCH
    if (lat && lng) {
      // Dùng Prisma.sql để chống SQL Injection khi ghép chuỗi điều kiện động
      const genderCondition = gender ? Prisma.sql`AND p.gender = ${gender}` : Prisma.empty;
      const sizeCondition = size ? Prisma.sql`AND p.size = ${size}` : Prisma.empty;
      const speciesCondition = species ? Prisma.sql`AND p.species = ${species}` : Prisma.empty;

      // Thực thi Raw Query tính khoảng cách Haversine (Sử dụng chuẩn MySQL)
      const pets: any[] = await this.prisma.$queryRaw`
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

      // Lấy thêm hình ảnh cho các pets đã tìm được (để tránh lỗi JSON Array Aggregate trên MySQL)
      const petIds = pets.map(p => p.id);
      const images = petIds.length > 0
        ? await this.prisma.petImage.findMany({ where: { petId: { in: petIds } } })
        : [];

      // Format lại data khớp với cấu trúc trả về
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
          // Xóa các trường thừa sinh ra từ câu query raw
          distance_km: undefined,
          shelterName: undefined,
          shelterAvatarUrl: undefined
        };
      });

      return {
        data: formattedData,
        meta: { limit, count: formattedData.length, filters }
      };
    }

    // NẾU KHÔNG CÓ TỌA ĐỘ -> FALLBACK DÙNG PRISMA NHƯ CŨ
    const whereCondition: Prisma.PetWhereInput = {
      status: 'AVAILABLE',
      interactions: {
        none: { userId: userId },
      },
      ...(gender && { gender }),
      ...(size && { size }),
      ...(species && { species }),
    };

    const pets = await this.prisma.pet.findMany({
      where: whereCondition,
      take: limit,
      include: {
        images: true,
        shelter: { select: { name: true, avatarUrl: true } }
      }
    });

    return {
      data: pets,
      meta: { limit, count: pets.length, filters }
    };
  }

  // API 2: Ghi nhận hành động quẹt (LIKE/PASS)
  async swipePet(userId: string, petId: string, swipePetDto: SwipePetDto) {
    // 1. Check xem bé pet này có tồn tại hay không
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    // 2. Check xem user đã từng quẹt bé này chưa (xử lý lỗi trùng lặp)
    // Lưu ý: Cần đảm bảo trong file schema.prisma, bảng PetInteraction có `@@unique([userId, petId])`
    const existingInteraction = await this.prisma.petInteraction.findUnique({
      where: {
        userId_petId: {
          userId: userId,
          petId: petId,
        },
      },
    });

    if (existingInteraction) {
      throw new ConflictException('Bạn đã tương tác với thú cưng này rồi!');
    }

    // 3. Tiến hành ghi nhận hành động quẹt
    const interaction = await this.prisma.petInteraction.create({
      data: {
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
    // 1. Kiểm tra xem pet có tồn tại không
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    // 2. Kiểm tra xem đã lưu trước đó chưa
    // Lưu ý: Cần đảm bảo schema Prisma có bảng FavoritePet và `@@unique([userId, petId])`
    const existingFavorite = await this.prisma.favoritePet.findUnique({
      where: {
        userId_petId: {
          userId: userId,
          petId: petId,
        },
      },
    });

    // Nếu đã lưu rồi thì trả về thông báo thành công (không throw lỗi crash)
    if (existingFavorite) {
      return {
        message: 'Thú cưng này đã nằm trong danh sách yêu thích của bạn từ trước.',
        data: existingFavorite,
      };
    }

    // 3. Tiến hành lưu vào bảng FavoritePet
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

    // Chỉ chủ sở hữu hoặc shelter tạo ra pet mới được xóa
    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException('Bạn không có quyền xóa thú cưng này!');
    }

    // Tiến hành xóa (Prisma sẽ tự động xóa các bảng phụ nếu có onCascade delete, 
    // nếu không bạn cần xóa Tag, Image, Interaction trước)
    await this.prisma.pet.delete({
      where: { id: petId },
    });

    return { message: 'Đã xóa thú cưng thành công!' };
  }

  async toggleLostMode(
    userId: string,
    petId: string,
    data: {
      isLost: boolean;
      location?: string;
      dateTime?: string;
      details?: string;
      ownerName?: string;
      ownerPhone?: string;
      ownerAddress?: string;
      note?: string;
      photos?: string[];
      latitude?: number | null;
      longitude?: number | null;
      radius?: number;
      lostDate?: string;
    },
  ) {
    const { isLost } = data;

    // 1. Kiểm tra thú cưng
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: { tags: true },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    // 2. Kiểm tra quyền sở hữu — FIX: so sánh đúng thực thể
    // Lấy thông tin user hiện tại để biết họ có quản lý Shelter nào không
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shelterId: true },
    });

    const isOwner = pet.ownerId === userId;
    const isShelterManager =
      pet.shelterId && currentUser?.shelterId && pet.shelterId === currentUser.shelterId;

    if (!isOwner && !isShelterManager) {
      throw new ConflictException('Bạn không có quyền thay đổi trạng thái thú cưng này!');
    }

    // 3. Cập nhật trạng thái Tag (vòng cổ)
    const newTagStatus = isLost ? 'LOST' : 'ACTIVE';
    await this.prisma.tag.updateMany({
      where: { petId },
      data: { status: newTagStatus },
    });

    // 4. Cập nhật thông tin "lost" vào Pet
    const updatedPet = await this.prisma.pet.update({
      where: { id: petId },
      data: isLost
        ? {
          lostLatitude: data.latitude ?? null,
          lostLongitude: data.longitude ?? null,
          lostRadius: data.radius ?? 500,
          lostDate: data.lostDate ? new Date(data.lostDate) : new Date(),
          lostContactName: data.ownerName ?? null,
          lostContactPhone: data.ownerPhone ?? null,
          lostContactAddress: data.ownerAddress ?? null,
          lostLocation: data.location ?? null,
          lostDateTime: data.dateTime ?? null,
          lostDetails: data.details ? { vi: data.details, en: data.details } : undefined,
          lostPhotos: data.photos ? JSON.stringify(data.photos) : null,
        }
        : {
          // Khi tắt lost mode, có thể giữ lại lịch sử hoặc clear — tuỳ bạn quyết định
          lostLatitude: null,
          lostLongitude: null,
          lostRadius: null,
        },
    });

    let reportId: string | null = null;

    // 5. Khi BẬT lost mode: tạo 1 TagReport "point-zero" để FE có reportId redirect tới
    if (isLost) {
      // Lấy tag đầu tiên của pet (nếu có)
      const tag = pet.tags?.[0];

      if (tag) {
        const newReport = await this.prisma.tagReport.create({
          data: {
            tagId: tag.id,
            userId: userId,
            scannedBy: data.ownerName || 'Owner',
            phoneNumber: data.ownerPhone || null,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            radius: data.radius ?? 500,
            message: data.details || 'Chủ nhân đã báo mất thú cưng',
            images: data.photos ?? [],
            status: 'PENDING',
            scannedAt: data.lostDate ? new Date(data.lostDate) : new Date(),
          },
        });
        reportId = newReport.id;
      }
    }

    return {
      message: isLost ? 'Đã bật chế độ báo lạc!' : 'Đã tắt chế độ báo lạc, thú cưng an toàn.',
      isLost,
      reportId, // FE sẽ dùng field này để redirect sang tag-report-detail
      pet: updatedPet,
    };
  }

  // API 4: Xóa thú cưng khỏi danh sách yêu thích
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

  // API 5: Lấy danh sách thú cưng yêu thích
  async getFavorites(userId: string, skip: number, take: number) {
    const favorites = await this.prisma.favoritePet.findMany({
      where: { userId: userId },
      skip: skip,
      take: take,
      orderBy: {
        createdAt: 'desc', // Sắp xếp theo thời gian thêm vào mục yêu thích mới nhất
      },
      include: {
        pet: {
          include: {
            images: {
              take: 1, // Chỉ lấy ảnh đầu tiên của thú cưng
            },
            shelter: {
              select: {
                id: true,
                name: true,
                avatarUrl: true, // Lấy thêm các trường cần thiết của shelter nếu có
              },
            },
          },
        },
      },
    });

    // Lấy tổng số bản ghi để hỗ trợ phân trang ở client
    const totalCount = await this.prisma.favoritePet.count({
      where: { userId: userId },
    });

    return {
      // Map qua mảng để lấy thông tin của pet thay vì cấu trúc lồng { pet: {...} }
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
          images: true, // Lấy dữ liệu từ bảng PetImage
        },
        // Tạm thời bỏ orderBy vì bảng Pet chưa có trường thời gian (createdAt/updatedAt)
      });

      return pets.map((pet) => ({
        ...pet,
        // Dùng optional chaining để tránh lỗi nếu images bị undefined
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
          ownerId: userId, // Gán chủ sở hữu là user đang đăng nhập
          status: 'ADOPTED', // Pet tự thêm thì trạng thái mặc định xem như đã sở hữu

          // Xử lý lưu mảng URL ảnh vào bảng PetImage (nếu có ảnh)
          ...(images && images.length > 0 && {
            images: {
              create: images.map(url => ({ url }))
            }
          })
        },
        include: {
          images: true, // Trả về kèm ảnh để frontend map state
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

    // Lọc theo từ khóa tìm kiếm (Tên hoặc giống loài)
    if (search) {
      whereCondition.OR = [
        { name: { contains: search } },
        { breed: { contains: search } },
      ];
    }

    // Lọc theo chó hoặc mèo
    if (type) {
      // Giả sử type trên DB lưu là 'DOG' hoặc 'CAT'
      whereCondition.species = type.toUpperCase() as any;
    }

    const pets = await this.prisma.pet.findMany({
      where: whereCondition,
      take: limit,
      include: {
        images: true,
        shelter: {
          select: { id: true, name: true, avatarUrl: true }
        }
      },
      orderBy: {}
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
      images: true, // Lấy danh sách ảnh
      tags: true,
      shelter: {
        // Shelter dùng 'contactInfo' thay vì 'phone', và có 'address'
        select: { id: true, name: true, contactInfo: true, address: true, avatarUrl: true }
      },
      owner: {
        // User có 'phone' nhưng KHÔNG CÓ 'address'
        select: { id: true, name: true, phone: true, avatarUrl: true }
      },
      adoptionRequirements: {
        where: { requirement: { isActive: true } },
        include: { requirement: true },
        orderBy: { requirement: { sortOrder: 'asc' } },
      },
    },
  });

  if (!pet) {
    throw new NotFoundException('Không tìm thấy thông tin thú cưng này!');
  }

  // Format lại dữ liệu shelter và owner để frontend dễ hiển thị
  let formattedShelter: any = null;
  if (pet.shelter) {
    formattedShelter = {
      ...pet.shelter,
      phone: pet.shelter.contactInfo, // Đổi tên biến contactInfo thành phone cho khớp với code frontend
    };
  }

  let formattedOwner: any = null;
  if (pet.owner) {
    formattedOwner = {
      ...pet.owner,
      address: 'Chưa cập nhật', // Bảng User không có address nên ta gán chuỗi mặc định
    };
  }

  // Format lại adoptionRequirements: bỏ lớp bảng nối, chỉ trả key/label/icon cho FE
  const formattedRequirements = pet.adoptionRequirements.map((par) => ({
    id: par.requirement.key,
    label: par.requirement.label, // { vi, en } -> FE dùng l() để đọc
    iconKey: par.requirement.iconKey,
  }));

  return {
    ...pet,
    shelter: formattedShelter,
    owner: formattedOwner,
    avatarUrl: pet.images && pet.images.length > 0 ? pet.images[0].url : null,
    adoptionRequirements: formattedRequirements, // override field raw từ Prisma bằng bản đã format
  };
}


  async updatePet(userId: string, petId: string, updateData: any) { // Dùng UpdatePetDto thay cho any nếu bạn đã import
    // 1. Kiểm tra pet có tồn tại không
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    // 2. Kiểm tra quyền (chỉ chủ sở hữu hoặc shelter mới được sửa)
    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException('Bạn không có quyền chỉnh sửa thông tin thú cưng này!');
    }

    // 3. Tách images ra khỏi updateData vì lưu ở bảng khác
    const { images, ...petInfo } = updateData;

    try {
      const updatedPet = await this.prisma.pet.update({
        where: { id: petId },
        data: {
          ...petInfo,
          // Nếu có mảng ảnh mới, xóa ảnh cũ và tạo ảnh mới (logic cơ bản)
          ...(images && images.length > 0 && {
            images: {
              deleteMany: {}, // Xóa ảnh cũ
              create: images.map((url: string) => ({ url })) // Thêm ảnh mới
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