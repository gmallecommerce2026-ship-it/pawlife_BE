import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
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
export interface FeedFilters {
  gender?: PetGender;
  size?: PetSize;
  species?: string;
}
const ownerSelectQuery = {
  select: {
    id: true,
    name: true,       // Đã sửa thành name
    avatarUrl: true,  // Đã sửa thành avatarUrl
    phone: true,// Chỉ trả về khi cần thiết (ví dụ: pet đang bị thất lạc)
  },
};
@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('swipe-queue') private readonly swipeQueue: Queue,
    private notificationsGateway: NotificationsGateway,
    private readonly notificationsService: NotificationsService, // Inject NotificationsService
    private readonly redisService: RedisService // Inject RedisService
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
        petInteractions: { none: { userId: userId } }, 
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
          petInteractions: { some: { userId: userId, action: 'PASS' } },
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
    // (Hoặc tối ưu hơn là đẩy trực tiếp petId vào mảng JSON trong Redis nếu bạn quen xử lý JSON array)
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

    await this.redisService.del(`pet:detail:${petId}`);

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
      // 1. Xóa bỏ các khoảng trắng hoặc ký tự thừa (nếu user nhập 076 666 8602)
      let rawPhone = payload.phone.replace(/[\s-]/g, '');
      
      // 2. Thêm số nguyên bản user nhập vào mảng tìm kiếm
      orConditions.push({ phone: rawPhone });

      // 3. Tự động sinh ra các biến thể để quét trong DB
      if (rawPhone.startsWith('0')) {
        // Nếu nhập '076...', tìm thêm '+8476...'
        orConditions.push({ phone: '+84' + rawPhone.substring(1) });
      } else if (rawPhone.startsWith('+84')) {
        // Nếu nhập '+8476...', tìm thêm '076...'
        orConditions.push({ phone: '0' + rawPhone.substring(3) });
      }
    }

    // 4. Tìm người nhận với các điều kiện đã được mở rộng
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
          isLost, // 3. TRẢ VỀ CỜ NÀY CHO FRONTEND
        };
      });
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

    // 2. Lấy từ DB nếu chưa có cache
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        owner: ownerSelectQuery,
        images: {
          orderBy: { createdAt: 'asc' } 
        },
        tags: true,
        shelter: {
          select: { id: true, name: true, contactInfo: true, address: true, avatarUrl: true }
        },
        transferRequests: {
          where: { status: 'PENDING' },
          include: {
            receiver: {
              select: { id: true, name: true, email: true, phone: true, avatarUrl: true }
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

    const pendingTransfer = pet.transferRequests && pet.transferRequests.length > 0 ? pet.transferRequests[0] : null;

    const result = {
      ...pet,
      shelter: formattedShelter,
      owner: formattedOwner,
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