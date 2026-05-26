import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SwipePetDto } from './dto/swipe-pet.dto';
import { PetGender, PetSize, Prisma, NotificationType } from '@prisma/client';
import { CreatePetDto } from './dto/create-pet.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { TagStatus } from '@prisma/client';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { RedisService } from 'src/database/redis/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ToggleLostModeDto } from './dto/toggle-lost-mode.dto';
import { ReplaceQrDto } from './dto/replace-qr.dto';

export interface FeedFilters {
  gender?: PetGender;
  size?: PetSize;
  species?: string;
}

// --- KHAI BÁO TYPE CHO PAW HISTORY TẠI ĐÂY ---
export type PawHistoryType = 'CREATED' | 'BIRTH' | 'QR_LINKED' | 'TRANSFER' | 'VACCINE';

export interface PawHistoryItem {
  id: string;
  type: PawHistoryType;
  title: string;
  date: Date | string; 
  description: string;
}
// ----------------------------------------------

const ownerSelectQuery = {
  select: {
    id: true,
    name: true,       // Đã sửa thành name
    avatarUrl: true,  // Đã sửa thành avatarUrl
    phone: true,      // Chỉ trả về khi cần thiết (ví dụ: pet đang bị thất lạc)
  },
};

@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('swipe-queue') private readonly swipeQueue: Queue,
    private notificationsGateway: NotificationsGateway,
    private readonly notificationsService: NotificationsService, // Inject NotificationsService
    private readonly redisService: RedisService, // Inject RedisService
    private configService: ConfigService,
  ) {}

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

  private async getAvailablePetsByShelterIds(shelterIds: string[]) {
    const cacheKey = `pets:available:shelters:${shelterIds.sort().join('_')}`;
    
    const cached = await this.redisService.get<any[]>(cacheKey);
    if (cached) return cached;

    const pets = await this.prisma.pet.findMany({
      where: { status: 'AVAILABLE', shelterId: { in: shelterIds } },
      include: { images: true, shelter: true }
    });

    await this.redisService.set(cacheKey, pets, 300); // Cache 5 phút
    return pets;
  }

  async linkQrCode(userId: string, petId: string, tagId: string) {
    // 1. Kiểm tra Pet có tồn tại và thuộc quyền sở hữu của user không
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng này!');
    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException('Bạn không có quyền thao tác trên thú cưng này!');
    }

    // 2. Kiểm tra Tag (Mã QR) có tồn tại trong hệ thống không
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new BadRequestException('Mã QR này không thuộc hệ thống PawLife hoặc không tồn tại!');
    }

    // 3. Kiểm tra xem Tag này đã được gán cho con pet nào chưa
    if (tag.petId) {
      if (tag.petId === petId) throw new BadRequestException('Mã QR này đã được gán cho bé này rồi!');
      throw new BadRequestException('Mã QR này đã được sử dụng cho một thú cưng khác!');
    }

    // 4. Thực hiện gán Tag vào Pet (Dùng Transaction để đảm bảo tính toàn vẹn)
    await this.prisma.$transaction([
      this.prisma.tag.update({
        where: { id: tagId },
        data: { 
          petId: petId, 
          status: 'ACTIVE' 
        }
      }),
      this.prisma.pet.update({
        where: { id: petId },
        data: { 
          qrVerificationStatus: 'VERIFIED',
          // Nên lưu Full URL để sau này API trả về là frontend dùng được ngay không cần ghép chuỗi
          qrCodeUrl: `https://pawcare.app/tag/${tagId}` 
        }
      })
    ]);

    // 5. Xóa cache
    await this.redisService.del(`pet:detail:${petId}`);

    return { success: true, message: 'Liên kết vòng cổ thành công!' };
  }

  async getFeed(userId: string, limit: number, filters?: FeedFilters, lat?: number, lng?: number) {
    const { gender, size, species } = filters || {};

    const matchesFilters = (pet: any) => {
      if (gender && pet.gender !== gender) return false;
      if (size && pet.size !== size) return false;
      if (species && pet.species !== species) return false;
      return true;
    };

    // TRƯỜNG HỢP 1: CÓ TỌA ĐỘ (Xử lý trên RAM)
    if (lat && lng) {
      // Chỉ tải userInteractions từ Redis khi thực sự cần thiết (xử lý RAM)
      const interactionCacheKey = `user:${userId}:swiped_pets`;
      let userInteractions = await this.redisService.get<{petId: string, action: string}[]>(interactionCacheKey) || [];
      const allSwipedIds = new Set(userInteractions.map(i => i.petId));
      const passActionIds = new Set(userInteractions.filter(i => i.action === 'PASS').map(i => i.petId));

      const REDIS_KEY = 'shelters:locations';
      let nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);

      if (!nearbyShelterIds || nearbyShelterIds.length === 0) {
        const allShelters = await this.prisma.shelter.findMany({
          where: { latitude: { not: null }, longitude: { not: null } }
        });
        for (const s of allShelters) {
          await this.redisService.addLocation(REDIS_KEY, s.longitude!, s.latitude!, s.id);
        }
        nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);
      }

      const targetShelterIds = nearbyShelterIds.slice(0, 30);

      if (targetShelterIds.length > 0) {
        const allPetsInShelters = await this.getAvailablePetsByShelterIds(targetShelterIds);
        let validPets = allPetsInShelters.filter(pet => !allSwipedIds.has(pet.id) && matchesFilters(pet));

        if (validPets.length === 0) {
          validPets = allPetsInShelters.filter(pet => passActionIds.has(pet.id) && matchesFilters(pet));
        }

        const formattedData = validPets.map(pet => {
          const shelter = pet.shelter;
          const distanceVal = (shelter?.latitude && shelter?.longitude)
            ? this.calculateDistance(lat, lng, shelter.latitude, shelter.longitude) : 0;
          return {
            ...pet,
            distance_val: distanceVal,
            distance: `${distanceVal.toFixed(1)} km`,
            shelter: {
              name: shelter?.name || 'Trạm chưa đặt tên',
              avatarUrl: shelter?.avatarUrl || null,
              address: shelter?.address || 'Chưa cập nhật'
            }
          };
        });

        formattedData.sort((a, b) => a.distance_val - b.distance_val);
        const finalData = formattedData.slice(0, limit).map(p => {
          delete (p as any).distance_val;
          return p;
        });

        return { data: finalData, meta: { limit, count: finalData.length, filters } };
      }
    }

    // TRƯỜNG HỢP 2: KHÔNG CÓ GPS (Dùng DB Tối ưu)
    // SỬA Ở ĐÂY: KHÔNG dùng `notIn: Array.from(allSwipedIds)`
    // Thay vào đó dùng liên kết ngược (Relational Filter) của Prisma để tạo câu lệnh SQL tối ưu:
    let dbPets = await this.prisma.pet.findMany({
      where: {
        status: 'AVAILABLE',
        // Prisma sẽ tự động build câu lệnh SQL "WHERE NOT EXISTS (SELECT ...)" thay vì "WHERE id NOT IN (...hàng nghìn ID...)"
        interactions: { none: { userId: userId } },
        ...(gender && { gender }),
        ...(size && { size }),
        ...(species && { species }),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { createdAt: 'asc' } },
        shelter: { select: { name: true, avatarUrl: true, address: true } }
      }
    });

    if (dbPets.length === 0) {
      // Fallback lấy thú cưng đã PASS bằng Join Table
      dbPets = await this.prisma.pet.findMany({
        where: {
          status: 'AVAILABLE',
          interactions: { some: { userId: userId, action: 'PASS' } },
          ...(gender && { gender }),
          ...(size && { size }),
          ...(species && { species }),
        },
        take: limit,
        include: {
          images: { orderBy: { createdAt: 'asc' } },
          shelter: { select: { name: true, avatarUrl: true, address: true } }
        }
      });
    }

    return { data: dbPets, meta: { limit, count: dbPets.length, filters } };
  }

  async swipePet(userId: string, petId: string, swipePetDto: SwipePetDto) {
    const petExists = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true } 
    });

    if (!petExists) {
      throw new NotFoundException('Không tìm thấy thú cưng này!');
    }

    // XÓA CACHE SWIPE CỦA USER ĐỂ LẦN GET FEED TỚI SẼ LẤY DATA MỚI
    const interactionCacheKey = `user:${userId}:swiped_pets`;
    await this.redisService.del(interactionCacheKey);

    await this.swipeQueue.add(
      'process-swipe', 
      {
        userId,
        petId,
        action: swipePetDto.action,
      },
      { 
        removeOnComplete: true,
        removeOnFail: 100,
      }
    );

    return {
      message: `Đã ${swipePetDto.action.toLowerCase()} thú cưng thành công!`,
      data: {
        userId: userId,
        petId: petId,
        action: swipePetDto.action,
        createdAt: new Date(), 
        updatedAt: new Date(),
      },
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

    // XÓA CACHE SAU KHI XÓA
    await this.redisService.del(`pet:detail:${petId}`);

    return { message: 'Đã xóa thú cưng thành công!' };
  }
  
  async toggleLostMode(userId: string, petId: string, dto: ToggleLostModeDto) {
    const { isLost, location, dateTime, details, ownerName, ownerPhone, ownerAddress, note, photos } = dto;

    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng này!');
    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException('Bạn không có quyền thay đổi trạng thái!');
    }

    const newStatus = isLost ? 'LOST' : 'ACTIVE';
    
    // 1. Cập nhật DB (Dùng Transaction để đảm bảo tính toàn vẹn dữ liệu)
    await this.prisma.$transaction([
      this.prisma.tag.updateMany({
        where: { petId: petId },
        data: { status: newStatus },
      }),
      this.prisma.pet.update({
        where: { id: petId },
        data: {
          // Lưu dữ liệu khi BẬT báo lạc, reset về null khi TẮT báo lạc
          lostContactName: isLost ? ownerName : null,
          lostContactPhone: isLost ? ownerPhone : null,
          lostContactAddress: isLost ? ownerAddress : null,
          lostLocation: isLost ? location : null,
          lostDateTime: isLost ? dateTime : null,
          // Gộp chi tiết (details) và lời nhắn (note) vào cùng một trường
          lostDetails: isLost ? `${note || ''}`.trim() : null,
          lostPhotos: isLost ? JSON.stringify(photos || []) : null,
        }
      })
    ]);

    // Lấy danh sách tag để xử lý Geo Redis
    const tags = await this.prisma.tag.findMany({ where: { petId: petId } });

    // 2. Xóa Cache chi tiết Pet
    await this.redisService.del(`pet:detail:${petId}`);

    // 3. ĐỒNG BỘ REDIS GEO MAP DÀNH CHO HỆ THỐNG LỚN
    const LOST_TAGS_KEY = 'tags:locations:lost'; 
    
    if (!isLost) {
      // NẾU TẮT BÁO LẠC: Xóa ngay tọa độ khỏi Redis Geo
      for (const tag of tags) {
        await this.redisService.removeLocation(LOST_TAGS_KEY, tag.id);
      }
    }

    // 4. Bắn Notification
    await this.notificationsService.createAndSendNotification({
      userId: userId,
      title: isLost ? '🚨 Báo động đi lạc!' : '✅ Thú cưng an toàn',
      body: isLost 
        ? `Bạn đã BẬT chế độ báo lạc cho bé ${pet.name}.` 
        : `Bạn đã TẮT chế độ báo lạc cho bé ${pet.name}.`,
      type: NotificationType.TAG,
      referenceId: petId,
    });

    return {
      message: isLost ? 'Đã bật chế độ báo lạc!' : 'Đã tắt chế độ báo lạc, thú cưng an toàn.',
      isLost: isLost,
    };
  }

  async requestTransfer(petId: string, payload: { email?: string; phone?: string }, senderId: string) {
    if (!payload.email && !payload.phone) {
      throw new BadRequestException('Vui lòng cung cấp email hoặc số điện thoại người nhận');
    }

    const orConditions: Prisma.UserWhereInput[] = [];

    // Xử lý Email
    if (payload.email) {
      orConditions.push({ email: payload.email.trim().toLowerCase() });
    }

    // Xử lý Số điện thoại (Tự động Normalize)
    if (payload.phone) {
      let rawPhone = payload.phone.replace(/[\s-]/g, '');
      orConditions.push({ phone: rawPhone });

      if (rawPhone.startsWith('0')) {
        orConditions.push({ phone: '+84' + rawPhone.substring(1) });
      } else if (rawPhone.startsWith('+84')) {
        orConditions.push({ phone: '0' + rawPhone.substring(3) });
      }
    }

    const receiver = await this.prisma.user.findFirst({
      where: {
        OR: orConditions,
      },
    });

    if (!receiver) {
      throw new NotFoundException('Hệ thống không tìm thấy người dùng với thông tin liên lạc này.');
    }
    
    if (receiver.id === senderId) {
      throw new BadRequestException('Không thể tự chuyển nhượng thú cưng cho chính mình.');
    }

    // Xóa các request PENDING cũ
    await this.prisma.transferRequest.updateMany({
      where: { petId, status: 'PENDING' },
      data: { status: 'CANCELED' },
    });

    // Tạo record Transfer Request trong DB
    const transferRequest = await this.prisma.transferRequest.create({
      data: { petId, senderId, receiverId: receiver.id, status: 'PENDING' },
    });

    // Gửi thông báo
    await this.notificationsService.createAndSendNotification({
      userId: receiver.id,
      title: '🎁 Yêu cầu chuyển nhượng mới',
      body: 'Bạn nhận được yêu cầu nhận nuôi từ chủ cũ của thú cưng.',
      type: NotificationType.SYSTEM,
      referenceId: petId,
    });

    // Bắn Socket real-time
    this.notificationsGateway.server.to(`user_${receiver.id}`).emit('transfer_requested', {
      transferId: transferRequest.id,
      petId,
    });

    await this.redisService.del(`pet:detail:${petId}`);

    return { success: true, message: 'Đã gửi yêu cầu' };
  }

  async confirmTransfer(transferId: string, receiverId: string) {
    const transferReq = await this.prisma.transferRequest.findUnique({
      where: { id: transferId },
    });

    if (!transferReq || transferReq.status !== 'PENDING') {
      throw new BadRequestException('Yêu cầu không hợp lệ hoặc đã được xử lý');
    }

    // 1. Cập nhật chủ mới cho thú cưng
    await this.prisma.pet.update({
      where: { id: transferReq.petId },
      data: { ownerId: receiverId }, 
    });

    await this.redisService.del(`pet:detail:${transferReq.petId}`);

    await this.prisma.transferRequest.updateMany({
      where: { 
        petId: transferReq.petId, 
        status: 'PENDING',
        id: { not: transferId } // Chừa lại cái đang được confirm
      },
      data: { status: 'CANCELED' },
    });

    // 2. Cập nhật trạng thái Request
    await this.prisma.transferRequest.update({
      where: { id: transferId },
      data: { status: 'COMPLETED' },
    });

    // 3. Bắn Socket cho CẢ HAI user để chuyển tab và hiển thị popup complete
    const payload = { petId: transferReq.petId };
    
    // Bắn cho người gửi (chủ cũ)
    this.notificationsGateway.server.to(`user_${transferReq.senderId}`).emit('transfer_completed', payload);
    
    // Bắn cho người nhận (chủ mới)
    this.notificationsGateway.server.to(`user_${receiverId}`).emit('transfer_completed', payload);

    return { success: true, message: 'Chuyển nhượng thành công' };
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
              orderBy: { createdAt: 'asc' }
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
          },
          // 1. THÊM DÒNG NÀY ĐỂ LẤY THÔNG TIN VÒNG CỔ
          tags: true, 
        },
      });

      return pets.map((pet) => {
        // 2. KIỂM TRA XEM CÓ THẺ NÀO ĐANG BÁO LẠC KHÔNG
        const isLost = pet.tags?.some((tag: any) => tag.status === 'LOST') || false;

        return {
          ...pet,
          avatarUrl: pet.images && pet.images.length > 0 ? pet.images[0].url : null,
          isLost, 
        };
      });
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi lấy danh sách thú cưng của người dùng');
    }
  }

  async createPet(userId: string, createPetDto: CreatePetDto) {
    const { images, tagId, ...petData } = createPetDto;
    const publicDomain = this.configService.get<string>('R2_PUBLIC_DOMAIN');
    try {
      // NẾU CÓ TRUYỀN MÃ QR TỪ FRONTEND XUỐNG
      if (tagId) {
        // 1. Kiểm tra Tag có hợp lệ không trước khi làm gì khác
        const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
        if (!tag) {
          throw new BadRequestException('Mã QR này không tồn tại trong hệ thống!');
        }
        if (tag.petId) {
          throw new BadRequestException('Mã QR này đã được sử dụng cho một bé khác!');
        }

        // 2. Gom 2 hành động vào Transaction: Tạo Pet + Update Tag
        const result = await this.prisma.$transaction(async (prisma) => {
          // 2.1 Tạo Pet trước
          const newPet = await prisma.pet.create({
            data: {
              ...petData,
              ownerId: userId,
              status: 'ADOPTED',
              qrVerificationStatus: 'VERIFIED',
              qrCodeUrl: `${publicDomain}/qr-codes/${tagId}.svg`,
              ...(images && images.length > 0 && {
                images: { create: images.map(url => ({ url })) }
              })
            },
            include: { images: true }
          });

          // 2.2 Update Tag với ID của Pet vừa tạo
          await prisma.tag.update({
            where: { id: tagId },
            data: { 
              petId: newPet.id, 
              status: 'ACTIVE' 
            }
          });

          return newPet;
        });

        return result;
      } 
      
      // TRƯỜNG HỢP 2: TẠO PET BÌNH THƯỜNG (KHÔNG CÓ QUÉT QR)
      const newPet = await this.prisma.pet.create({
        data: {
          ...petData,
          ownerId: userId,
          status: 'ADOPTED', 
          ...(images && images.length > 0 && {
            images: { create: images.map(url => ({ url })) }
          })
        },
        include: { images: true }
      });

      return newPet;

    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Lỗi hệ thống khi thêm thú cưng');
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
          orderBy: { createdAt: 'asc' } 
        },
        shelter: {
          select: { id: true, address: true, name: true, avatarUrl: true }
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
    const cacheKey = `pet:detail:${id}`;
    
    // 1. Kiểm tra cache
    const cachedPet = await this.redisService.get<any>(cacheKey);
    if (cachedPet) {
        return cachedPet;
    }

    // 2. Lấy từ DB nếu chưa có cache (Bỏ where PENDING ở transferRequests)
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        owner: ownerSelectQuery,
        images: {
          orderBy: { createdAt: 'asc' } 
        },
        tags: true,
        traitsList: true,
        shelter: {
          select: { id: true, name: true, contactInfo: true, address: true, avatarUrl: true }
        },
        transferRequests: {
          orderBy: { updatedAt: 'desc' },
          include: {
            receiver: {
              select: { id: true, name: true, email: true, phone: true, avatarUrl: true }
            },
            sender: {
              select: { id: true, name: true } // Cần lấy sender để parse history
            }
          }
        }
      },
    });

    if (!pet) throw new NotFoundException('Không tìm thấy thông tin thú cưng này!');

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

    // Tách transfer request đang PENDING cho các logic trả về cũ
    const pendingTransfer = pet.transferRequests && pet.transferRequests.length > 0 
      ? pet.transferRequests.find(tr => tr.status === 'PENDING') 
      : null;

    // ==============================================================
    // --- BUILD PAW HISTORY DYNAMICALLY (TYPE-SAFE) ---
    // ==============================================================
    const pawHistory: PawHistoryItem[] = [];

    // Sự kiện 1: Tham gia hệ thống
    pawHistory.push({
      id: `join_${pet.id}`,
      type: 'CREATED',
      title: 'Joined PawLife',
      date: pet.createdAt,
      description: `Hồ sơ của ${pet.name} được tạo trên hệ thống.`
    });

    // Sự kiện 2: Ngày sinh
    if (pet.dob) {
      pawHistory.push({
        id: `dob_${pet.id}`,
        type: 'BIRTH',
        title: 'Date of Birth',
        date: pet.dob,
        description: `${pet.name} cất tiếng gấu/meo chào đời.`
      });
    }

    // Sự kiện 3: Vòng cổ QR
    if (pet.tags && pet.tags.length > 0) {
      const activeTag = pet.tags.find(t => t.status !== 'INACTIVE');
      if (activeTag) {
        pawHistory.push({
          id: `tag_${activeTag.id}`,
          type: 'QR_LINKED',
          title: 'QR Code Registered',
          date: activeTag.status === 'ACTIVE' ? pet.updatedAt : pet.createdAt,
          description: `Vòng cổ thông minh được kích hoạt cho ${pet.name}.`
        });
      }
    }

    // Sự kiện 4: Lịch sử Vaccine
    // Type checking an toàn cho Json value từ DB
    const vaccineUrls = pet.vaccinationRecordUrls as string[];
    if (Array.isArray(vaccineUrls) && vaccineUrls.length > 0) {
      pawHistory.push({
        id: `vaccine_${pet.id}`,
        type: 'VACCINE',
        title: 'Vaccination Record Updated',
        date: pet.updatedAt, 
        description: `Cập nhật ${vaccineUrls.length} giấy tờ tiêm chủng/y tế.`
      });
    }

    // Sự kiện 5: Lịch sử chuyển nhượng / Nhận nuôi
    if (pet.transferRequests) {
      pet.transferRequests
        .filter(tr => tr.status === 'COMPLETED')
        .forEach(tr => {
          pawHistory.push({
            id: `transfer_${tr.id}`,
            type: 'TRANSFER',
            title: 'Ownership Transferred',
            date: tr.updatedAt,
            description: `Được chuyển nhượng thành công cho chủ mới (${tr.receiver?.name || 'Ẩn danh'}).`
          });
        });
    }

    // Sort an toàn
    pawHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // ==============================================================

    const result = {
      ...pet,
      shelter: formattedShelter,
      owner: formattedOwner,
      pawHistory, // <--- BỔ SUNG PAW HISTORY VÀO RESPONSE
      avatarUrl: pet.images && pet.images.length > 0 ? pet.images[0].url : null,
      transferStatus: pendingTransfer ? pendingTransfer.status : null,
      pendingContact: pendingTransfer ? (pendingTransfer.receiver.email || pendingTransfer.receiver.phone) : null,
      transferRequestId: pendingTransfer ? pendingTransfer.id : null,
      receiverId: pendingTransfer ? pendingTransfer.receiverId : null,
      senderId: pendingTransfer ? pendingTransfer.senderId : null,
      receiver: pendingTransfer ? pendingTransfer.receiver : null,
    };

    // 3. Set Cache (Lưu trong 10 phút = 600s)
    await this.redisService.set(cacheKey, result, 600);

    return result;
  }

  async replaceQrCode(userId: string, petId: string, dto: ReplaceQrDto) {
    const { newTagId } = dto;

    // 1. Kiểm tra Pet có tồn tại và thuộc quyền sở hữu của User không
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: { tags: true }, // Lấy kèm các tag cũ để xử lý
    });

    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng.');
    if (pet.ownerId !== userId) throw new ForbiddenException('Bạn không có quyền thao tác trên thú cưng này.');

    // 2. Kiểm tra Tag mới có hợp lệ không
    const newTag = await this.prisma.tag.findUnique({
      where: { id: newTagId },
    });

    if (!newTag) throw new NotFoundException('Mã QR này không tồn tại trong hệ thống.');
    if (newTag.petId && newTag.petId !== petId) {
      throw new ConflictException('Mã QR này đã được sử dụng cho một thú cưng khác.');
    }
    if (newTag.petId === petId) {
      return { message: 'Mã QR này hiện đã được gắn cho thú cưng này.' };
    }

    // 3. Thực thi Transaction để đảm bảo tính toàn vẹn
    await this.prisma.$transaction(async (tx) => {
      // 3.1. Hủy liên kết tất cả Tag cũ (nếu có)
      if (pet.tags && pet.tags.length > 0) {
        await tx.tag.updateMany({
          where: { petId: pet.id },
          data: { 
            petId: null, 
            status: 'INACTIVE' 
          },
        });
      }

      // 3.2. Gắn Tag mới vào Pet
      await tx.tag.update({
        where: { id: newTagId },
        data: { 
          petId: pet.id,
          status: 'ACTIVE' 
        },
      });

      // 3.3. Cập nhật thông tin Pet
      const qrCodeUrl = `https://yourdomain.com/scan/${newTagId}`;
      
      await tx.pet.update({
        where: { id: pet.id },
        data: { 
          qrCodeUrl,
          qrVerificationStatus: 'VERIFIED',
          needsQrReplacement: false
        },
      });
    });

    return { 
      success: true, 
      message: 'Thay đổi mã QR thành công!',
      newTagId,
    };
  }

  async getPetByTagId(tagId: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      include: {
        pet: {
          include: {
            owner: {
              select: { id: true, name: true, avatarUrl: true, phone: true },
            },
            images: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!tag || !tag.pet) {
      throw new NotFoundException('Không tìm thấy thú cưng với mã thẻ này');
    }

    const pet = tag.pet;
    const isLost = tag.status === TagStatus.LOST;

    if (!isLost && pet.owner) {
      (pet.owner as any).phone = null;
    }

    return {
      ...pet,
      // ✅ Normalize về 'dob' để frontend dùng thống nhất
      dob: pet.dob ?? null,
      avatarUrl: pet.images?.length > 0 ? pet.images[0].url : null,
      isLost,
      // ✅ Trả thêm lostInfo gom lại cho frontend dễ dùng
      lostInfo: isLost ? {
        ownerName: pet.lostContactName ?? pet.owner?.name ?? null,
        ownerPhone: pet.lostContactPhone ?? pet.owner?.phone ?? null,
        ownerAddress: pet.lostContactAddress ?? null,
        note: pet.lostDetails ?? null,
      } : null,
    };
  }

  async cancelTransfer(petId: string, userId: string) {
    // 1. SỬA LỖI QUERY: Cho phép cả Sender HOẶC Receiver tìm thấy request
    const transferReq = await this.prisma.transferRequest.findFirst({
      where: { 
        petId: petId, 
        status: 'PENDING',
        OR: [
          { senderId: userId }, 
          { receiverId: userId }
        ]
      },
    });

    if (!transferReq) {
      throw new BadRequestException('Không tìm thấy yêu cầu chuyển nhượng nào đang chờ xử lý.');
    }

    // 2. Cập nhật trạng thái thành CANCELED
    await this.prisma.transferRequest.update({
      where: { id: transferReq.id },
      data: { status: 'CANCELED' },
    });

    // 3. THÊM MỚI: Bắn Socket Real-time cho CẢ HAI bên để cập nhật UI ngay lập tức
    const payload = { petId: petId };
    this.notificationsGateway.server.to(`user_${transferReq.senderId}`).emit('transfer_cancelled', payload);
    this.notificationsGateway.server.to(`user_${transferReq.receiverId}`).emit('transfer_cancelled', payload);

    // 4. (Tùy chọn thêm) Bắn Notification hệ thống cho người CÒN LẠI biết giao dịch đã bị hủy
    const targetUserId = userId === transferReq.senderId ? transferReq.receiverId : transferReq.senderId;
    const isSenderCanceling = userId === transferReq.senderId;
    
    await this.notificationsService.createAndSendNotification({
      userId: targetUserId,
      title: '❌ Hủy chuyển nhượng',
      body: isSenderCanceling 
        ? 'Chủ cũ đã hủy yêu cầu chuyển nhượng thú cưng cho bạn.' 
        : 'Người nhận đã từ chối yêu cầu chuyển nhượng thú cưng của bạn.',
      type: NotificationType.SYSTEM, 
      referenceId: petId,
    });

    await this.redisService.del(`pet:detail:${petId}`);
    
    return { success: true, message: 'Đã hủy yêu cầu chuyển nhượng.' };
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

      await this.redisService.del(`pet:detail:${petId}`);

      return {
        message: 'Cập nhật thông tin thú cưng thành công',
        data: updatedPet
      };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi cập nhật thông tin thú cưng');
    }
  }
}