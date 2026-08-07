// src/modules/pets/pets.service.ts
import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SwipePetDto } from './dto/swipe-pet.dto';
import { PetGender, PetSize, Prisma, NotificationType, TagStatus } from '@prisma/client';
import { CreatePetDto } from './dto/create-pet.dto';
import { NotificationsService } from '../notifications/notifications.service';
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

export type PawHistoryType =
  | 'CREATED'
  | 'BIRTH'
  | 'QR_LINKED'
  | 'TRANSFER'
  | 'VACCINE'
  | 'DENTAL_CARE'
  | 'ANNUAL_CHECKUP'
  | 'UNDER_SHELTER_CARE'
  | 'WAS_UNDER_SHELTER_CARE'
  | 'CURRENT_OWNER'
  | 'PREVIOUS_OWNER';


export interface PawHistoryItem {
  id: string;
  type: PawHistoryType;
  title: string;       // fallback en text
  date: Date | string;
  description: string; // fallback en text
  i18n: {
    titleKey: string;
    bodyKey: string;
    params?: Record<string, any>;
  };
}

// ----------------------------------------------------------------------
// HÀM ĐÃ ĐƯỢC SỬA: Xử lý triệt để Object, JSON String và FormData lỗi
// ----------------------------------------------------------------------
function getBilingualText(field: unknown): { vi: string; en: string } {
  if (!field) return { vi: '', en: '' };

  // Chặn đứng trường hợp Frontend dùng FormData gửi nhầm Object thành "[object Object]"
  if (field === '[object Object]') return { vi: 'Unknown/Chưa cập nhật', en: 'Unknown/Not updated' };

  // Trường hợp Frontend đã cẩn thận JSON.stringify() trước khi nhét vào FormData
  if (typeof field === 'string') {
    const trimmed = field.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          vi: String(parsed.vi ?? parsed.en ?? trimmed),
          en: String(parsed.en ?? parsed.vi ?? trimmed)
        };
      } catch (e) {
        return { vi: field, en: field };
      }
    }
    return { vi: field, en: field };
  }

  // Trường hợp truyền thẳng Object chuẩn
  if (typeof field === 'object' && field !== null) {
    const obj = field as Record<string, unknown>;
    const viVal = obj.vi ?? obj.en ?? '';
    const enVal = obj.en ?? obj.vi ?? '';

    return {
      // Ép kiểu an toàn, không dùng String() lên Object để tránh văng [object Object]
      vi: typeof viVal === 'object' ? JSON.stringify(viVal) : String(viVal),
      en: typeof enVal === 'object' ? JSON.stringify(enVal) : String(enVal)
    };
  }

  return { vi: String(field), en: String(field) };
}
// ----------------------------------------------------------------------
function normalizeBilingualList(list: unknown): { vi: string; en: string }[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => getBilingualText(item)).filter((t) => t.vi || t.en);
}
function normalizeTraitsList(list: unknown): { name: { vi: string; en: string } }[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      // Chấp nhận cả 3 dạng đầu vào: string thuần, {vi,en} phẳng, hoặc {name:{vi,en}} sẵn có
      const source = item && typeof item === 'object' && 'name' in (item as any)
        ? (item as any).name
        : item;
      const bi = getBilingualText(source);
      return bi.vi || bi.en ? { name: bi } : null;
    })
    .filter((x): x is { name: { vi: string; en: string } } => x !== null);
}
const ownerSelectQuery = {
  select: {
    id: true,
    name: true,
    avatarUrl: true,
    phone: true,
  },
};

@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('swipe-queue') private readonly swipeQueue: Queue,
    private notificationsGateway: NotificationsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService,
    private configService: ConfigService,
  ) { }

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
  private async resolveRequirementIds(keys?: string[]): Promise<string[]> {
    if (!keys || keys.length === 0) return [];
    const found = await this.prisma.adoptionRequirement.findMany({
      where: { key: { in: keys } },
      select: { id: true },
    });
    return found.map((r) => r.id);
  }
  private async hasPermission(userId: string, pet: any): Promise<boolean> {
    // 1. Nếu là Chủ nhân (User bình thường) -> Hợp lệ
    if (pet.ownerId === userId) return true;

    // 2. Nếu là Trạm cứu hộ -> Phải lấy shelterId của user ra để so sánh với pet.shelterId
    if (pet.shelterId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { shelterId: true }
      });
      if (user?.shelterId === pet.shelterId) return true;
    }

    return false;
  }
  private diffInDays(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  private generateShelterCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    const randomDigits = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SH-${randomLetter}${randomDigits}`;
  }

  private async generateUniqueShelterCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateShelterCode();
      const existing = await this.prisma.pet.findUnique({
        where: { idSetByShelter: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    return `${this.generateShelterCode()}-${Date.now().toString().slice(-4)}`;
  }

  private async getAvailablePetsByShelterIds(shelterIds: string[]) {
    const cacheKey = `pets:available:shelters:${shelterIds.sort().join('_')}`;

    const cached = await this.redisService.get<any[]>(cacheKey);
    if (cached) return cached;

    const pets = await this.prisma.pet.findMany({
      where: { status: 'AVAILABLE', shelterId: { in: shelterIds } },
      include: { images: true, shelter: true }
    });

    await this.redisService.set(cacheKey, pets, 300);
    return pets;
  }

  async linkQrCode(userId: string, petId: string, tagId: string) {
    // ======================================================================
    // 🔥 LOG DEBUG CHUYÊN SÂU TẬN GỐC - ĐỂ TÌM LỖI QR TRÊN BACKEND
    // ======================================================================
    console.log('\n=================== [BACKEND DEBUG QR START] ===================');
    console.log(`[1] Chuỗi tagId nhận từ Frontend: "${tagId}"`);
    console.log(`[2] Độ dài thực tế (Length): ${tagId ? tagId.length : 0}`);

    if (tagId) {
      const charCodes: string[] = [];
      for (let i = 0; i < tagId.length; i++) {
        charCodes.push(`${tagId[i]}:${tagId.charCodeAt(i)}`);
      }
      console.log(`[3] Mã ASCII từng ký tự (Ký tự:Mã): [${charCodes.join(', ')}]`);
    }

    // Kiểm tra xem Database thực tế đang có những Tag nào (Lấy thử 3 cái mẫu)
    try {
      const dbSampleTags = await this.prisma.tag.findMany({
        take: 3,
        select: { id: true, status: true }
      });
      console.log('[4] Thử lấy 3 Tag mẫu đang có thực tế trong Database:');
      console.log(JSON.stringify(dbSampleTags, null, 2));

      // Thử tìm kiếm thủ công bằng từ khóa cứng 'PLT-0001' xem DB có ra không
      const testFind = await this.prisma.tag.findUnique({ where: { id: 'PLT-0001' } });
      console.log(`[5] Thử tìm kiếm CỨNG mã "PLT-0001" trong DB có ra không?:`, testFind ? 'CÓ THẤY' : 'KHÔNG THẤY');
    } catch (dbError: any) {
      console.log('[4-5 LỖI] Không thể đọc bảng Tag từ DB:', dbError.message);
    }
    console.log('=================== [BACKEND DEBUG QR END] ===================\n');
    // ======================================================================

    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });

    if (!(await this.hasPermission(userId, pet))) {
      throw new ConflictException({ message: 'You do not have permission to perform actions on this pet!', i18n: { key: 'error.pet_unauthorized' } });
    }

    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new BadRequestException({ message: 'This QR code does not belong to the PawLife system or does not exist!', i18n: { key: 'error.qr_invalid' } });
    }

    if ((tag as any).linkCount >= 3) {
      throw new BadRequestException({ message: 'This QR code has reached its maximum reuse limit (3 times)!', i18n: { key: 'error.qr_limit_reached' } });
    }

    if (tag.petId) {
      if (tag.petId === petId) throw new BadRequestException({ message: 'This QR code is already assigned to this pet!', i18n: { key: 'error.qr_already_assigned' } });
      throw new BadRequestException({ message: 'This QR code is already in use for another pet!', i18n: { key: 'error.qr_in_use' } });
    }

    await this.prisma.$transaction([
      this.prisma.tag.update({
        where: { id: tagId },
        data: { petId: petId, status: 'ACTIVE', linkedAt: new Date(), linkCount: { increment: 1 } }
      }),
      this.prisma.pet.update({
        where: { id: petId },
        data: { qrVerificationStatus: 'VERIFIED', qrCodeUrl: `https://pawcare.app/tag/${tagId}` }
      })
    ]);

    await this.redisService.del(`pet:detail:${petId}`);

    return {
      success: true,
      message: 'Smart collar linked successfully!',
      i18n: { key: 'success.qr_linked' }
    };
  }

  async getFeed(userId: string, limit: number, filters?: FeedFilters, lat?: number, lng?: number) {
    // 1. Lấy danh sách USER đã block
    const blockedUserRecords = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      select: { blockedId: true }
    });
    const blockedUserIds = blockedUserRecords.map(b => b.blockedId);

    // 1.5 Lấy danh sách SHELTER đã block (THÊM MỚI Ở ĐÂY)
    const blockedShelterRecords = await this.prisma.userBlockedShelter.findMany({
      where: { userId: userId },
      select: { shelterId: true }
    });
    const blockedShelterIds = blockedShelterRecords.map(b => b.shelterId);

    const hiddenPetRecords = await this.prisma.userHiddenPet.findMany({
      where: { userId: userId },
      select: { petId: true }
    });
    const hiddenPetIds = hiddenPetRecords.map(h => h.petId);

    // 2. Tạo điều kiện filter linh hoạt cho Prisma
    const blockFilterCondition: Prisma.PetWhereInput = {};
    if (blockedUserIds.length > 0) {
      blockFilterCondition.ownerId = { notIn: blockedUserIds };
    }
    if (blockedShelterIds.length > 0) {
      blockFilterCondition.shelterId = { notIn: blockedShelterIds };
    }
    if (hiddenPetIds.length > 0) {
      blockFilterCondition.id = { notIn: hiddenPetIds };
    }
    const { gender, size, species } = filters || {};

    const matchesFilters = (pet: any) => {
      if (gender && pet.gender !== gender) return false;
      if (size && pet.size !== size) return false;
      if (species && pet.species?.en !== species && pet.species?.vi !== species && pet.species !== species) return false;
      return true;
    };

    if (lat && lng) {
      const interactionCacheKey = `user:${userId}:swiped_pets`;
      let userInteractions = await this.redisService.get<{ petId: string, action: string }[]>(interactionCacheKey) || [];
      const allSwipedIds = new Set(userInteractions.map(i => i.petId));
      const passActionIds = new Set(userInteractions.filter(i => i.action === 'PASS').map(i => i.petId));

      const REDIS_KEY = 'shelters:locations';
      let nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);

      if (!nearbyShelterIds || nearbyShelterIds.length === 0) {
        // ... (Giữ nguyên logic của bạn) ...
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

        // SỬA FILTER TRÊN MEMORY Ở ĐÂY: Sử dụng đúng blockedShelterIds cho shelterId
        let validPets = allPetsInShelters.filter(pet =>
          !allSwipedIds.has(pet.id) &&
          matchesFilters(pet) &&
          (!pet.ownerId || !blockedUserIds.includes(pet.ownerId)) &&
          (!pet.shelterId || !blockedShelterIds.includes(pet.shelterId)) &&
          (!hiddenPetIds.includes(pet.id)) // 👈 BỔ SUNG DÒNG NÀY ĐỂ FILTER MẢNG
        );

        if (validPets.length === 0) {
          validPets = allPetsInShelters.filter(pet =>
            passActionIds.has(pet.id) &&
            matchesFilters(pet) &&
            (!pet.shelterId || !blockedShelterIds.includes(pet.shelterId)) &&
            (!hiddenPetIds.includes(pet.id)) // 👈 BỔ SUNG DÒNG NÀY
          );
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
              name: shelter?.name || 'Unnamed shelter',
              avatarUrl: shelter?.avatarUrl || null,
              address: shelter?.address || 'Not updated yet',
              latitude: shelter?.latitude ?? null,   // ✅ thêm
              longitude: shelter?.longitude ?? null, // ✅ thêm
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

    let dbPets = await this.prisma.pet.findMany({
      where: {
        status: 'AVAILABLE',
        interactions: { none: { userId: userId } },
        ...blockFilterCondition,
        ...(gender && { gender }),
        ...(size && { size }),
        ...(species && {
          species: {
            path: ['en'],
            equals: species
          } as any
        }),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { orderBy: { createdAt: 'asc' } },
        shelter: { select: { name: true, avatarUrl: true, address: true, latitude: true, longitude: true } }
      }
    });

    if (dbPets.length === 0) {
      dbPets = await this.prisma.pet.findMany({
        where: {
          status: 'AVAILABLE',
          interactions: { some: { userId: userId, action: 'PASS' } },
          ...blockFilterCondition,
          ...(gender && { gender }),
          ...(size && { size }),
          ...(species && {
            species: {
              path: ['en'],
              equals: species
            } as any
          }),
        },
        take: limit,
        include: {
          images: { orderBy: { createdAt: 'asc' } },
          shelter: { select: { name: true, avatarUrl: true, address: true, latitude: true, longitude: true } }
        }
      });
    }
    if (lat && lng) {
      dbPets = dbPets.map(pet => {
        const s = pet.shelter;
        const distanceVal = (s?.latitude && s?.longitude)
          ? this.calculateDistance(lat, lng, s.latitude, s.longitude)
          : null;
        return {
          ...pet,
          distance: distanceVal !== null ? `${distanceVal.toFixed(1)} km` : undefined,
        };
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
      throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });
    }

    const interactionCacheKey = `user:${userId}:swiped_pets`;
    await this.redisService.del(interactionCacheKey);

    await this.swipeQueue.add('process-swipe', { userId, petId, action: swipePetDto.action }, { removeOnComplete: true, removeOnFail: 100 });

    return {
      message: `Successfully ${swipePetDto.action.toLowerCase()} pet!`,
      i18n: { key: 'success.pet_swiped', params: { action: swipePetDto.action.toLowerCase() } },
      data: {
        userId: userId, petId: petId, action: swipePetDto.action,
        createdAt: new Date(), updatedAt: new Date(),
      },
    };
  }

  async addFavorite(userId: string, petId: string) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });

    if (!pet) {
      throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });
    }

    const existingFavorite = await this.prisma.favoritePet.findUnique({
      where: { userId_petId: { userId: userId, petId: petId } },
    });

    if (existingFavorite) {
      return {
        message: 'This pet is already in your favorites list.',
        i18n: { key: 'success.already_favorited' },
        data: existingFavorite,
      };
    }

    const favorite = await this.prisma.favoritePet.create({
      data: { userId: userId, petId: petId },
    });

    return {
      message: 'Pet successfully saved to favorites!',
      i18n: { key: 'success.added_to_favorites' },
      data: favorite,
    };
  }

  async removePet(userId: string, petId: string) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });

    if (!pet) throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });

    if (!(await this.hasPermission(userId, pet))) {
      throw new ConflictException({ message: 'You do not have permission to delete this pet!', i18n: { key: 'error.pet_unauthorized' } });
    }

    // SỬA Ở ĐÂY: Dùng Transaction để nhả Tag và xoá Pet cùng lúc
    await this.prisma.$transaction(async (tx) => {
      // 1. Nhả tất cả Tag đang gắn với Pet này về INACTIVE
      await tx.tag.updateMany({
        where: { petId: petId },
        data: {
          status: 'INACTIVE',
          petId: null,
          linkedAt: null,
        }
      });

      // 2. Xoá Pet
      await tx.pet.delete({ where: { id: petId } });
    });

    await this.redisService.del(`pet:detail:${petId}`);

    return {
      message: 'Pet deleted successfully!',
      i18n: { key: 'success.pet_deleted' }
    };
  }

  async toggleLostMode(userId: string, petId: string, dto: ToggleLostModeDto) {
    const { isLost, location, dateTime, details, ownerName, ownerPhone, ownerAddress, note, photos, latitude, longitude, lostDate, radius } = dto;
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });

    if (!pet) throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });
    if (!(await this.hasPermission(userId, pet))) {
      throw new ConflictException({ message: 'You do not have permission to change the status!', i18n: { key: 'error.pet_unauthorized' } });
    }

    const newStatus = isLost ? 'LOST' : 'ACTIVE';
    const activeTag = await this.prisma.tag.findFirst({ where: { petId: petId, status: { not: 'INACTIVE' } } });

    const transactionResults = await this.prisma.$transaction([
      this.prisma.tag.updateMany({ where: { petId: petId }, data: { status: newStatus } }),
      this.prisma.pet.update({
        where: { id: petId },
        data: {
          lostContactName: isLost ? ownerName : null, lostContactPhone: isLost ? ownerPhone : null,
          lostContactAddress: isLost ? ownerAddress : null, lostLocation: isLost ? location : null,
          lostDateTime: isLost ? dateTime : null,
          // ✅ SỬA: dùng `details` (mô tả nhận dạng) thay vì `note` (ghi chú ngắn)
          lostDetails: isLost && details ? ({ vi: details.trim(), en: details.trim() } as any) : null,
          lostPhotos: isLost ? JSON.stringify(photos || []) : null, lostLatitude: isLost && latitude ? latitude : null,
          lostLongitude: isLost && longitude ? longitude : null, lostRadius: isLost && radius ? radius : null,
          lostDate: isLost && lostDate ? new Date(lostDate) : null,
        }
      }),
      ...(isLost && activeTag ? [
        this.prisma.tagReport.create({
          data: {
            tagId: activeTag.id, userId: userId, latitude: latitude || null, longitude: longitude || null,
            // ✅ giữ nguyên: note vẫn dùng làm message ngắn của TagReport gốc
            message: note ? `${note}` : 'The owner has reported the pet missing', scannedBy: ownerName || 'Owner', status: 'PENDING',
          }
        })
      ] : []),
      ...(isLost ? [] : [
        this.prisma.tagReport.updateMany({
          where: { tag: { petId: petId }, status: 'PENDING' }, data: { status: 'RESOLVED' }
        })
      ])
    ]);

    let newReportId = null;
    if (isLost && activeTag && transactionResults.length >= 3) {
      newReportId = (transactionResults[2] as any)?.id;
    }

    const tags = await this.prisma.tag.findMany({ where: { petId: petId } });
    await this.redisService.del(`pet:detail:${petId}`);

    const LOST_TAGS_KEY = 'tags:locations:lost';
    if (!isLost) {
      for (const tag of tags) await this.redisService.removeLocation(LOST_TAGS_KEY, tag.id);
    } else if (latitude && longitude) {
      for (const tag of tags) await this.redisService.addLocation(LOST_TAGS_KEY, longitude, latitude, tag.id);
    }

    if (!isLost) {
      try {
        const recentReporters = await this.prisma.tagReport.findMany({
          where: { tag: { petId: petId }, userId: { not: null } },
          distinct: ['userId'], select: { userId: true }
        });

        for (const reporter of recentReporters) {
          if (reporter.userId && reporter.userId !== userId) {
            await this.notificationsService.createAndSendNotification({
              userId: reporter.userId,
              title: '🎉 Good news!', body: `The owner of ${pet.name} has reported them safe. Thank you!`,
              type: NotificationType.SYSTEM, referenceId: petId,
              metadata: { i18n: { titleKey: 'notification.pet_safe_title', bodyKey: 'notification.pet_safe_body', params: { petName: pet.name } } }
            });
            this.notificationsGateway.server.to(`user_${reporter.userId}`).emit('notification', {
              title: '🎉 Good news!', body: `The owner of ${pet.name} has reported them safe.`
            });
          }
        }
      } catch (err) { console.error(err); }
    }

    return {
      message: isLost ? 'Lost mode enabled!' : 'Lost mode disabled, pet is safe.',
      i18n: { key: isLost ? 'success.lost_mode_enabled' : 'success.lost_mode_disabled' },
      isLost: isLost,
      data: {
        isLost,
        location,
        dateTime,
        details,
        reportId: newReportId // <-- THÊM DÒNG NÀY ĐỂ FRONTEND NHẬN ĐƯỢC ID
      }
    };
  }
  async getPendingTransferForUser(userId: string) {
    const pendingTransfer = await this.prisma.transferRequest.findFirst({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        // SỬA Ở ĐÂY: Include thêm images để lấy ảnh pet
        pet: {
          include: {
            images: {
              orderBy: { createdAt: 'asc' },
              take: 1 // Chỉ lấy 1 ảnh đầu tiên làm avatar cho nhẹ
            }
          }
        },
        sender: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!pendingTransfer) return null;

    // THÊM BƯỚC NÀY: Map images[0] thành avatarUrl cho Frontend dễ dùng
    const petWithAvatar = {
      ...pendingTransfer.pet,
      avatarUrl: pendingTransfer.pet.images?.length > 0 ? pendingTransfer.pet.images[0].url : null,
    };

    return {
      ...pendingTransfer,
      pet: petWithAvatar
    };
  }
  async requestTransfer(petId: string, payload: { email?: string; phone?: string }, senderId: string) {
    if (!payload.email && !payload.phone) {
      throw new BadRequestException({ message: 'Please provide the recipient\'s email or phone number', i18n: { key: 'error.missing_transfer_contact' } });
    }

    const orConditions: Prisma.UserWhereInput[] = [];
    if (payload.email) orConditions.push({ email: payload.email.trim().toLowerCase() });
    if (payload.phone) {
      let rawPhone = payload.phone.replace(/[\s-]/g, '');
      orConditions.push({ phone: rawPhone });
      if (rawPhone.startsWith('0')) orConditions.push({ phone: '+84' + rawPhone.substring(1) });
      else if (rawPhone.startsWith('+84')) orConditions.push({ phone: '0' + rawPhone.substring(3) });
    }

    const receiver = await this.prisma.user.findFirst({ where: { OR: orConditions } });
    if (!receiver) {
      throw new NotFoundException({ message: 'The system could not find a user with this contact information.', i18n: { key: 'error.user_not_found' } });
    }
    if (receiver.id === senderId) {
      throw new BadRequestException({ message: 'Cannot transfer a pet to yourself.', i18n: { key: 'error.transfer_to_self' } });
    }

    // 🆕 CHẶN GỬI YÊU CẦU NẾU RECEIVER ĐÃ BLOCK SENDER
    const isBlocked = await this.prisma.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: receiver.id, blockedId: senderId } },
    });
    if (isBlocked) {
      throw new ForbiddenException({
        message: 'This user is not accepting transfer requests from you.',
        i18n: { key: 'error.transfer_blocked' },
      });
    }

    await this.prisma.transferRequest.updateMany({ where: { petId, status: 'PENDING' }, data: { status: 'CANCELED' } });

    const transferRequest = await this.prisma.transferRequest.create({
      data: { petId, senderId, receiverId: receiver.id, status: 'PENDING' },
    });

    const petDataForSocket = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: { owner: { select: { name: true, avatarUrl: true } }, images: true }
    });

    // THÊM ĐOẠN NÀY: Map avatarUrl cho FE
    const formattedPet = {
      ...petDataForSocket,
      avatarUrl: petDataForSocket?.images?.[0]?.url || null,
    };

    // ✅ CHỈ 1 payload duy nhất, đầy đủ, dùng transferId để FE match chính xác
    const eventPayload = {
      transferId: transferRequest.id,
      petId,
      pet: formattedPet, // SỬA Ở ĐÂY: Truyền formattedPet thay vì petDataForSocket gốc
      senderName: petDataForSocket?.owner?.name,
    };

    // ✅ XOÁ dòng server.to().emit() thô bên dưới — chỉ giữ 1 nguồn emit
    await this.notificationsGateway.notifyUserSmartly(receiver.id, 'transfer_requested', eventPayload);

    await this.notificationsService.createAndSendNotification({
      userId: receiver.id, title: '🎁 New transfer request',
      body: 'You have received an adoption request from the pet\'s previous owner.',
      type: NotificationType.SYSTEM, referenceId: petId,
      metadata: {
        transferId: transferRequest.id,
        uiAction: 'navigate_transfer', // 👈 dùng để FE biết tap vào thì điều hướng
        i18n: { titleKey: 'notification.transfer_request_title', bodyKey: 'notification.transfer_request_body' }
      }
    });

    await this.redisService.del(`pet:detail:${petId}`);

    return { success: true, message: 'Request sent', i18n: { key: 'success.transfer_requested' } };
  }

  async confirmTransfer(transferId: string, receiverId: string) {
    const transferReq = await this.prisma.transferRequest.findUnique({
      where: { id: transferId },
      include: { receiver: true, sender: true }
    });

    if (!transferReq || transferReq.status !== 'PENDING') {
      throw new BadRequestException({ message: 'Invalid or already processed request', i18n: { key: 'error.invalid_transfer_request' } });
    }

    // 🔧 SỬA: include owner + images ngay trong lần update này
    const pet = await this.prisma.pet.update({
      where: { id: transferReq.petId },
      data: { ownerId: receiverId, adoptedAt: new Date() },
      include: {
        owner: ownerSelectQuery, // đã có sẵn const này trong file, tái dùng luôn
        images: { orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });
    await this.redisService.del(`pet:detail:${transferReq.petId}`);

    await this.prisma.transferRequest.updateMany({
      where: { petId: transferReq.petId, status: 'PENDING', id: { not: transferId } },
      data: { status: 'CANCELED' },
    });
    await this.prisma.transferRequest.update({ where: { id: transferId }, data: { status: 'COMPLETED' } });

    // 🔧 SỬA: format pet để FE dùng thẳng (avatarUrl từ images[0])
    const formattedPet = {
      ...pet,
      avatarUrl: pet.images?.[0]?.url ?? null,
    };

    const senderPayload = {
      petId: transferReq.petId,
      transferId,
      status: 'COMPLETED',
      role: 'sender',
      targetName: transferReq.receiver?.name || 'Người dùng mới',
      pet: formattedPet, // 🔧 THÊM
    };

    const receiverPayload = {
      petId: transferReq.petId,
      transferId,
      status: 'COMPLETED',
      role: 'receiver',
      targetName: transferReq.sender?.name || 'Chủ cũ',
      pet: formattedPet, // 🔧 THÊM
    };

    await this.notificationsGateway.notifyUserSmartly(transferReq.senderId, 'transfer_completed', senderPayload);
    await this.notificationsGateway.notifyUserSmartly(receiverId, 'transfer_completed', receiverPayload);

    for (const uid of [transferReq.senderId, receiverId]) {
      await this.notificationsService.createAndSendNotification({
        userId: uid,
        title: '✅ Transfer completed',
        body: 'The pet ownership transfer has been completed successfully.',
        type: NotificationType.SYSTEM,
        referenceId: transferReq.petId,
        metadata: {
          transferId,
          uiAction: 'show_success_popup',
          i18n: { titleKey: 'notification.transfer_completed_title', bodyKey: 'notification.transfer_completed_body' }
        }
      });
    }

    // 🔧 SỬA: trả pet kèm owner mới trong REST response
    return {
      success: true,
      message: 'Transfer successful',
      i18n: { key: 'success.transfer_completed' },
      pet: formattedPet,
    };
  }

  async removeFavorite(userId: string, petId: string) {
    const existingFavorite = await this.prisma.favoritePet.findUnique({ where: { userId_petId: { userId, petId } } });

    if (!existingFavorite) {
      throw new NotFoundException({ message: 'This pet is not in your favorites list!', i18n: { key: 'error.not_in_favorites' } });
    }

    await this.prisma.favoritePet.delete({ where: { userId_petId: { userId, petId } } });

    return {
      message: 'Removed from favorites!',
      i18n: { key: 'success.removed_from_favorites' }
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
        where: { ownerId: userId, status: 'ADOPTED' },
        include: { images: { orderBy: { createdAt: 'asc' } }, tags: true },
      });

      return pets.map((pet) => {
        const isLost = pet.tags?.some((tag: any) => tag.status === 'LOST') || false;
        return { ...pet, avatarUrl: pet.images && pet.images.length > 0 ? pet.images[0].url : null, isLost };
      });
    } catch (error) {
      throw new InternalServerErrorException({ message: 'Error fetching user\'s pet list', i18n: { key: 'error.get_my_pets_failed' } });
    }
  }
  // ============================================================
  // THÊM VÀO pets.service.ts (trong class PetsService)
  // Method này UPDATE 1 medical record cụ thể, KHÔNG đụng tới
  // các record khác và KHÔNG reset verificationStatus của chúng
  // (khác với updatePet() hiện tại đang deleteMany + create lại hết)
  // ============================================================

  async updateMedicalRecord(
    userId: string,
    petId: string,
    recordId: string,
    updateData: {
      type?: string;
      recordName?: any; // string | {vi,en} | JSON string
      recordDate?: string;
      images?: string[];
      hasNextDueDate?: boolean;
      nextDueDate?: string | null;
      nextDueName?: any;
    },
  ) {
    // 1. Kiểm tra quyền sở hữu pet
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });
    }
    if (!(await this.hasPermission(userId, pet))) {
      throw new ConflictException({
        message: "You do not have permission to edit this pet's information!",
        i18n: { key: 'error.pet_unauthorized' },
      });
    }

    // 2. Kiểm tra record có thuộc pet này không
    const record = await this.prisma.medicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.petId !== petId) {
      throw new NotFoundException({
        message: 'Medical record not found!',
        i18n: { key: 'error.medical_record_not_found' },
      });
    }

    // 3. (Tuỳ chọn) Chỉ cho sửa khi record còn PENDING, đã VERIFIED thì khoá lại
    //    Bỏ comment nếu bạn muốn áp dụng rule này:
    // if (record.verificationStatus === 'VERIFIED') {
    //   throw new BadRequestException({
    //     message: 'This record has been verified and can no longer be edited.',
    //     i18n: { key: 'error.medical_record_locked' },
    //   });
    // }

    const dataToUpdate: Prisma.MedicalRecordUpdateInput = {};

    if (updateData.type !== undefined) dataToUpdate.type = updateData.type;
    if (updateData.recordName !== undefined) {
      dataToUpdate.recordName = getBilingualText(updateData.recordName) as any;
    }
    if (updateData.recordDate !== undefined) {
      dataToUpdate.recordDate = new Date(updateData.recordDate);
    }
    if (updateData.images !== undefined) {
      dataToUpdate.images = updateData.images as any;
    }
    if (updateData.hasNextDueDate !== undefined) {
      dataToUpdate.hasNextDueDate = updateData.hasNextDueDate;
    }
    if (updateData.nextDueDate !== undefined) {
      dataToUpdate.nextDueDate = updateData.nextDueDate ? new Date(updateData.nextDueDate) : null;
    }
    if (updateData.nextDueName !== undefined) {
      dataToUpdate.nextDueName = updateData.nextDueName
        ? (getBilingualText(updateData.nextDueName) as any)
        : null;
    }

    // Sau khi sửa nội dung, đưa record về lại PENDING để admin xác minh lại
    // (vì nội dung đã thay đổi, verification cũ không còn áp dụng)
    dataToUpdate.verificationStatus = 'PENDING';

    const updatedRecord = await this.prisma.medicalRecord.update({
      where: { id: recordId },
      data: dataToUpdate,
    });

    await this.redisService.del(`pet:detail:${petId}`);

    return {
      message: 'Medical record updated successfully',
      i18n: { key: 'success.medical_record_updated' },
      data: updatedRecord,
    };
  }

  // ============================================================
  // (Khuyến nghị thêm luôn) DELETE 1 medical record riêng lẻ,
  // để nút "Xóa" trong menu cũng không phải replace-all
  // ============================================================
  async deleteMedicalRecord(userId: string, petId: string, recordId: string) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });
    }
    if (!(await this.hasPermission(userId, pet))) {
      throw new ConflictException({
        message: "You do not have permission to edit this pet's information!",
        i18n: { key: 'error.pet_unauthorized' },
      });
    }

    const record = await this.prisma.medicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.petId !== petId) {
      throw new NotFoundException({
        message: 'Medical record not found!',
        i18n: { key: 'error.medical_record_not_found' },
      });
    }

    await this.prisma.medicalRecord.delete({ where: { id: recordId } });
    await this.redisService.del(`pet:detail:${petId}`);

    return {
      message: 'Medical record deleted successfully',
      i18n: { key: 'success.medical_record_deleted' },
    };
  }
  async reportMedicalRecord(
    userId: string,
    petId: string,
    recordId: string,
    reportData: { reason: string; details?: string },
  ) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });
    }
    if (!(await this.hasPermission(userId, pet))) {
      throw new ConflictException({
        message: "You do not have permission to report this pet's medical record!",
        i18n: { key: 'error.pet_unauthorized' },
      });
    }

    const record = await this.prisma.medicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.petId !== petId) {
      throw new NotFoundException({
        message: 'Medical record not found!',
        i18n: { key: 'error.medical_record_not_found' },
      });
    }

    // 🆕 Chỉ cho report record đang VERIFIED — khớp đúng logic FE chỉ hiện nút Report khi verified
    if (record.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException({
        message:
          record.verificationStatus === 'DISPUTED'
            ? 'This record is already under dispute and pending review.'
            : 'Only verified records can be reported.',
        i18n: {
          key:
            record.verificationStatus === 'DISPUTED'
              ? 'error.medical_record_already_disputed'
              : 'error.medical_record_not_verified',
        },
      });
    }

    // 🆕 Bọc trong transaction: tạo Report + chuyển record sang DISPUTED cùng lúc
    const report = await this.prisma.$transaction(async (tx) => {
      const r = await tx.report.create({
        data: {
          userId,
          targetId: recordId,
          type: 'medical_record',
          reason: reportData.reason,
          detail: reportData.details,
        },
      });

      await tx.medicalRecord.update({
        where: { id: recordId },
        data: { verificationStatus: 'DISPUTED' },
      });

      return r;
    });

    // 🆕 Bắt buộc xoá cache pet:detail, vì medicalRecords nằm trong object cache này
    await this.redisService.del(`pet:detail:${petId}`);

    return {
      success: true,
      message: 'Report submitted successfully',
      i18n: { key: 'success.medical_record_reported' },
      data: report,
    };
  }


  async getShelterPets(userId: string, params: { search?: string; type?: string; status?: string; page?: number; pageSize?: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shelterId: true },
    });
    if (!user?.shelterId) {
      return { data: [], meta: { page: 1, pageSize: 0, total: 0 } };
    }

    const { search, type, status, page = 1, pageSize = 20 } = params;
    const whereCondition: Prisma.PetWhereInput = { shelterId: user.shelterId };

    if (status) whereCondition.status = status as any;
    if (search) {
      whereCondition.OR = [
        { name: { contains: search } },
        { breed: { path: ['vi'], string_contains: search } as any },
        { breed: { path: ['en'], string_contains: search } as any },
      ];
    }
    if (type) {
      whereCondition.species = { path: ['en'], equals: type.toUpperCase() } as any;
    }

    const [pets, total] = await Promise.all([
      this.prisma.pet.findMany({
        where: whereCondition,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.pet.count({ where: whereCondition }),
    ]);

    return { data: pets, meta: { page, pageSize, total } };
  }
  async createPet(userId: string, createPetDto: CreatePetDto) {
    const publicDomain = this.configService.get<string>('R2_PUBLIC_DOMAIN');
    const idSetByShelter = await this.generateUniqueShelterCode();

    // 👈 THÊM: lấy shelterId của user đang tạo pet (nếu là tài khoản shelter)
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { shelterId: true },
    });
    const { images, tagId, medicalRecords, adoptionRequirementKeys, personalityTags, goodWith, badWith, ...petData } = createPetDto;
    const requirementIds = adoptionRequirementKeys && adoptionRequirementKeys.length > 0
      ? await this.resolveRequirementIds(adoptionRequirementKeys)
      : [];
    const medicalRecordsData = medicalRecords && medicalRecords.length > 0 ? {
      create: medicalRecords.map(record => ({
        type: record.type, recordName: getBilingualText(record.recordName) as any, recordDate: new Date(record.recordDate),
        images: record.images || [], hasNextDueDate: record.hasNextDueDate || false,
        nextDueDate: record.nextDueDate ? new Date(record.nextDueDate) : null,
        nextDueName: record.nextDueName ? (getBilingualText(record.nextDueName) as any) : null,
      }))
    } : undefined;
    try {
      if (tagId) {
        // ... giữ nguyên phần kiểm tra tag
        const result = await this.prisma.$transaction(async (prisma) => {
          const newPet = await this.prisma.pet.create({
            data: {
              ...(petData as any), ownerId: userId,
              shelterId: currentUser?.shelterId ?? null,
              status: petData.status || (currentUser?.shelterId ? 'AVAILABLE' : 'ADOPTED'),
              adoptedAt: currentUser?.shelterId ? null : new Date(),
              dob: petData.dob ? new Date(petData.dob) : undefined,
              idSetByShelter,
              ...(personalityTags !== undefined && { traits: normalizeTraitsList(personalityTags) }),
              ...(goodWith !== undefined && { goodWith: normalizeBilingualList(goodWith) }),
              ...(badWith !== undefined && { badWith: normalizeBilingualList(badWith) }),
              ...(requirementIds.length > 0 && {                                          // 🆕 thêm khối này
                adoptionRequirements: { create: requirementIds.map((requirementId) => ({ requirementId })) },
              }),
              ...(images && images.length > 0 && { images: { create: images.map(url => ({ url })) } }),
              ...(medicalRecordsData && { medicalRecords: medicalRecordsData })
            },
            include: { images: true }
          });
          await prisma.tag.update({ where: { id: tagId }, data: { petId: newPet.id, status: 'ACTIVE', linkedAt: new Date(), linkCount: { increment: 1 } } });
          return newPet;
        });
        return result;
      }

      const newPet = await this.prisma.pet.create({
        data: {
          ...(petData as any), ownerId: userId,
          shelterId: currentUser?.shelterId ?? null,
          status: petData.status || (currentUser?.shelterId ? 'AVAILABLE' : 'ADOPTED'),
          adoptedAt: currentUser?.shelterId ? null : new Date(),
          dob: petData.dob ? new Date(petData.dob) : undefined,
          idSetByShelter,
          ...(traits !== undefined && { traits: normalizeTraitsList(traits) }),
          ...(goodWith !== undefined && { goodWith: normalizeBilingualList(goodWith) }),
          ...(badWith !== undefined && { badWith: normalizeBilingualList(badWith) }),
          ...(requirementIds.length > 0 && {                                          // 🆕 thêm khối này
            adoptionRequirements: { create: requirementIds.map((requirementId) => ({ requirementId })) },
          }),
          ...(images && images.length > 0 && { images: { create: images.map(url => ({ url })) } }),
          ...(medicalRecordsData && { medicalRecords: medicalRecordsData })
        },
        include: { images: true }
      });
      return newPet;

    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException({ message: 'System error when creating pet', i18n: { key: 'error.create_pet_failed' } });
    }
  }

  async searchPets(params: { search?: string; type?: string; limit?: number; userId?: string }) {
    const { search, type, limit = 20, userId } = params;

    const whereCondition: Prisma.PetWhereInput = {
      status: 'AVAILABLE',
    };

    if (userId) {
      // 1. Lấy danh sách ID của Owner đã bị user này block
      const blockedUserRecords = await this.prisma.userBlock.findMany({
        where: { blockerId: userId },
        select: { blockedId: true }
      });
      const blockedUserIds = blockedUserRecords.map(b => b.blockedId);

      // 2. Lấy danh sách ID của Shelter đã bị user này block
      const blockedShelterRecords = await this.prisma.userBlockedShelter.findMany({
        where: { userId: userId },
        select: { shelterId: true }
      });
      const blockedShelterIds = blockedShelterRecords.map(b => b.shelterId);

      // 🌟 THÊM MỚI: 3. Lấy danh sách ID Pet đã bị user này ẩn
      const hiddenPetRecords = await this.prisma.userHiddenPet.findMany({
        where: { userId: userId },
        select: { petId: true }
      });
      const hiddenPetIds = hiddenPetRecords.map(h => h.petId);

      // Áp dụng điều kiện NOT IN vào query
      if (blockedUserIds.length > 0) {
        whereCondition.ownerId = { notIn: blockedUserIds };
      }
      if (blockedShelterIds.length > 0) {
        whereCondition.shelterId = { notIn: blockedShelterIds };
      }
      // 🌟 THÊM MỚI: Áp dụng điều kiện loại bỏ pet
      if (hiddenPetIds.length > 0) {
        whereCondition.id = { notIn: hiddenPetIds };
      }
    }
    // 🌟 KẾT THÚC LOGIC FILTER BLOCK

    if (search) {
      whereCondition.OR = [
        // Khuyên dùng thêm mode: 'insensitive' nếu dùng PostgreSQL để tìm kiếm không phân biệt hoa thường
        { name: { contains: search } },
        { breed: { path: ['vi'], string_contains: search } as any },
        { breed: { path: ['en'], string_contains: search } as any },
      ];
    }

    if (type) {
      whereCondition.species = {
        path: ['en'],
        equals: type.toUpperCase()
      } as any;
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
      // Nên thêm orderBy để kết quả search nhất quán giữa các lần gọi
      orderBy: { createdAt: 'desc' }
    });

    return {
      success: true,
      data: pets,
    };
  }
  async hidePet(userId: string, petId: string) {
    // Lưu vào DB
    await this.prisma.userHiddenPet.upsert({
      where: { userId_petId: { userId, petId } },
      create: { userId, petId },
      update: {}
    });

    // Lưu ID pet bị ẩn vào Redis Set với TTL (ví dụ 30 ngày)
    const cacheKey = `user:${userId}:hidden_pets`;
    await this.redisService.sAdd(cacheKey, petId, 2592000);

    return { success: true, message: 'Thú cưng đã được ẩn khỏi bảng tin của bạn' };
  }

  // 2. Hàm Report Pet
  async reportPet(petId: string, userId: string, reportData: any) {
    const report = await this.prisma.$transaction(async (tx) => {
      const r = await tx.report.create({
        data: {
          userId,
          targetId: petId,
          type: 'pet',
          reason: reportData.reason,
          detail: reportData.detail
        }
      });

      if (reportData.isBlockRequested) {
        await tx.userHiddenPet.upsert({
          where: { userId_petId: { userId, petId } },
          create: { userId, petId },
          update: {},
        });
        // Cập nhật Redis ngay lập tức
        await this.redisService.sAdd(`user:${userId}:hidden_pets`, petId, 2592000);
      }
      return r;
    });

    return { success: true, data: report };
  }
  // ── HÀM (trong class PetsService) ──────────────────────────────────────────
  async getPetById(id: string, userId?: string) {
    const cacheKey = `pet:detail:${id}`;
    let petData = await this.redisService.get<any>(cacheKey);

    if (!petData) {
      const pet = await this.prisma.pet.findUnique({
        where: { id },
        include: {
          owner: ownerSelectQuery,
          images: { orderBy: { createdAt: 'asc' } },
          medicalRecords: true,
          traitsList: true,
          shelter: {
            select: {
              id: true,
              name: true,
              contactInfo: true,
              address: true,
              avatarUrl: true,
              shelterType: true,
            },
          },
          transferRequests: {
            orderBy: { updatedAt: 'desc' },
            include: {
              receiver: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
              sender: { select: { id: true, name: true } },
            },
          },
          tags: {
            include: {
              reports: {
                where: { isHidden: false },
                orderBy: { scannedAt: 'desc' },
                take: 1,
                select: { id: true },
              },
            },
          },
          adoptionRequirements: {
            where: { requirement: { isActive: true } },
            include: { requirement: true },
            orderBy: { requirement: { sortOrder: 'asc' } },
          },
        },
      });

      if (!pet) {
        throw new NotFoundException({
          message: 'Pet information not found!',
          i18n: { key: 'error.pet_not_found' },
        });
      }

      // ── Auto-generate shelter code nếu chưa có ─────────────────────────────
      if (!pet.idSetByShelter) {
        const newCode = await this.generateUniqueShelterCode();
        await this.prisma.pet.update({
          where: { id: pet.id },
          data: { idSetByShelter: newCode },
        });
        pet.idSetByShelter = newCode;
      }

      // ── Format shelter & owner ──────────────────────────────────────────────
      const formattedShelter = pet.shelter
        ? { ...pet.shelter, phone: pet.shelter.contactInfo }
        : null;

      const formattedOwner = pet.owner
        ? { ...pet.owner, address: 'Not updated yet' }
        : null;

      // ── Pending transfer ────────────────────────────────────────────────────
      const pendingTransfer =
        pet.transferRequests?.find((tr) => tr.status === 'PENDING') ?? null;

      const completedTransfers =
        pet.transferRequests?.filter((tr) => tr.status === 'COMPLETED') ?? [];

      // ── Helper: phân loại medical record ───────────────────────────────────
      const classifyMedicalRecord = (
        record: (typeof pet.medicalRecords)[number],
      ): {
        type: PawHistoryType;
        titleKey: string;
        bodyKey: string;
      } => {
        const nameBi = getBilingualText(record.recordName);
        const nameRaw = `${nameBi.en} ${nameBi.vi}`.toLowerCase();

        if (
          nameRaw.includes('dental') ||
          nameRaw.includes('răng') ||
          nameRaw.includes('teeth')
        ) {
          return {
            type: 'DENTAL_CARE',
            titleKey: 'pawHistory.dental_title',
            bodyKey: 'pawHistory.dental_body',
          };
        }

        if (
          nameRaw.includes('checkup') ||
          nameRaw.includes('annual') ||
          nameRaw.includes('tổng quát') ||
          nameRaw.includes('định kỳ')
        ) {
          return {
            type: 'ANNUAL_CHECKUP',
            titleKey: 'pawHistory.checkup_title',
            bodyKey: 'pawHistory.checkup_body',
          };
        }

        return {
          type: 'VACCINE',
          titleKey: 'pawHistory.vaccine_title',
          bodyKey: 'pawHistory.vaccine_body',
        };
      };

      // ── Build pawHistory ────────────────────────────────────────────────────
      const pawHistory: PawHistoryItem[] = [];

      // 1. CURRENT_OWNER — chỉ push khi pet có owner
      if (pet.owner) {
        // Lấy ngày sở hữu chính xác:
        // - Nếu pet đã từng được transfer, lấy ngày hoàn thành transfer gần nhất (completedTransfers[0] vì đã order desc)
        // - Nếu chưa từng transfer, lấy adoptedAt hoặc ngày tạo profile gốc (createdAt)
        const ownershipDate = completedTransfers.length > 0
          ? completedTransfers[0].updatedAt
          : (pet.adoptedAt ?? pet.createdAt);

        pawHistory.push({
          id: `owner_current_${pet.id}`,
          type: 'CURRENT_OWNER',
          title: 'Current Owner',
          date: ownershipDate, // <--- SỬA LẠI THÀNH BIẾN NÀY
          description: `Ownership transferred to ${pet.owner.name ?? 'Anonymous'}`,
          i18n: {
            titleKey: 'pawHistory.current_owner_title',
            bodyKey: 'pawHistory.current_owner_body',
            params: { name: pet.owner.name ?? 'Anonymous' },
          },
        });
      }

      // 2. PREVIOUS_OWNER — mỗi completed transfer → 1 previous owner entry
      completedTransfers.forEach((tr) => {
        pawHistory.push({
          id: `owner_prev_${tr.id}`,
          type: 'PREVIOUS_OWNER',
          title: 'Previous Owner',
          date: tr.updatedAt,
          description: `Previously cared for by ${tr.sender?.name ?? 'Anonymous'}`,
          i18n: {
            titleKey: 'pawHistory.previous_owner_title',
            bodyKey: 'pawHistory.previous_owner_body',
            params: { name: tr.sender?.name ?? 'Anonymous' },
          },
        });
      });

      // 3. TRANSFER milestone — 1 entry per completed transfer
      completedTransfers.forEach((tr) => {
        pawHistory.push({
          id: `transfer_${tr.id}`,
          type: 'TRANSFER',
          title: 'Ownership Transferred',
          date: tr.updatedAt,
          description: `Successfully transferred to ${tr.receiver?.name ?? 'Anonymous'}`,
          i18n: {
            titleKey: 'pawHistory.transfer_title',
            bodyKey: 'pawHistory.transfer_body',
            params: { receiverName: tr.receiver?.name ?? 'Anonymous' },
          },
        });
      });

      // 4. UNDER_SHELTER_CARE / WAS_UNDER_SHELTER_CARE
      if (pet.shelter) {
        const isCurrentlyInShelter =
          pet.status === 'AVAILABLE' || pet.status === 'PENDING';

        if (isCurrentlyInShelter) {
          pawHistory.push({
            id: `shelter_current_${pet.id}`,
            type: 'UNDER_SHELTER_CARE',
            title: "Under Shelter's Care",
            date: pet.createdAt,
            description: `Currently under the care of ${pet.shelter.name}`,
            i18n: {
              titleKey: 'pawHistory.under_shelter_title',
              bodyKey: 'pawHistory.under_shelter_body',
              params: { shelterName: pet.shelter.name },
            },
          });
        } else {
          // status === ADOPTED → shelter entry jadi "was under care"
          pawHistory.push({
            id: `shelter_past_${pet.id}`,
            type: 'WAS_UNDER_SHELTER_CARE',
            title: "Was Under Shelter's Care",
            date: pet.createdAt,
            description: `Previously cared by ${pet.shelter.name}`,
            i18n: {
              titleKey: 'pawHistory.was_under_shelter_title',
              bodyKey: 'pawHistory.was_under_shelter_body',
              params: { shelterName: pet.shelter.name },
            },
          });
        }
      }

      // 5. VACCINE / DENTAL_CARE / ANNUAL_CHECKUP (từ medicalRecords)
      (pet.medicalRecords ?? []).forEach((record) => {
        const nameBi = getBilingualText(record.recordName);
        const classified = classifyMedicalRecord(record);

        pawHistory.push({
          id: `med_${record.id}`,
          type: classified.type,
          title: nameBi.en,
          date: record.recordDate,
          description: `${record.type}: ${nameBi.en}`,
          i18n: {
            titleKey: classified.titleKey,
            bodyKey: classified.bodyKey,
            params: {
              recordType: record.type,
              recordNameEn: nameBi.en,
              recordNameVi: nameBi.vi,
              clinicName: 'PawLife Clinic', // thay bằng field thật khi có
            },
          },
        });
      });

      // 6. QR_LINKED / QR_REPLACED
      (pet.tags ?? [])
        .filter((t) => t.linkedAt !== null)
        .forEach((tag) => {
          const isActive = tag.status !== 'INACTIVE';
          pawHistory.push({
            id: `tag_${tag.id}`,
            type: 'QR_LINKED',
            title: isActive ? 'QR Tag Registered' : 'QR Tag Replaced',
            date: tag.linkedAt ?? tag.createdAt,
            description: isActive
              ? `PawLife QR tag is now active for ${pet.name}.`
              : `Old QR tag replaced with a new one.`,
            i18n: {
              titleKey: isActive
                ? 'pawHistory.qr_registered_title'
                : 'pawHistory.qr_replaced_title',
              bodyKey: isActive
                ? 'pawHistory.qr_registered_body'
                : 'pawHistory.qr_replaced_body',
              params: { petName: pet.name },
            },
          });
        });

      // 7. BIRTH
      if (pet.dob) {
        pawHistory.push({
          id: `dob_${pet.id}`,
          type: 'BIRTH',
          title: 'Date of Birth',
          date: pet.dob,
          description: `${pet.name} was born.`,
          i18n: {
            titleKey: 'pawHistory.birth_title',
            bodyKey: 'pawHistory.birth_body',
            params: { petName: pet.name },
          },
        });
      }

      // 8. CREATED — luôn có, neo ở cuối timeline
      pawHistory.push({
        id: `join_${pet.id}`,
        type: 'CREATED',
        title: 'Joined PawLife',
        date: pet.createdAt,
        description: `The profile for ${pet.name} was created.`,
        i18n: {
          titleKey: 'pawHistory.joined_title',
          bodyKey: 'pawHistory.joined_body',
          params: { petName: pet.name },
        },
      });

      // ── Sort: mới nhất lên đầu ─────────────────────────────────────────────
      pawHistory.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      // ── Latest report id (dùng cho lost mode) ──────────────────────────────
      let latestReportId: string | null = null;
      if (pet.tags && pet.tags.length > 0) {
        const activeTag =
          pet.tags.find((t) => t.status !== 'INACTIVE') ?? pet.tags[0];
        if (activeTag?.reports?.length > 0) {
          latestReportId = activeTag.reports[0].id;
        }
      }

      // ── Adoption requirements ──────────────────────────────────────────────
      const formattedAdoptionRequirements = (pet.adoptionRequirements ?? []).map(
        (par) => ({
          id: par.requirement.key,
          label: par.requirement.label, // { vi, en }
          iconKey: par.requirement.iconKey,
        }),
      );

      // ── Assemble final petData ─────────────────────────────────────────────
      petData = {
        ...pet,
        shelter: formattedShelter,
        owner: formattedOwner,
        pawHistory,
        avatarUrl: pet.images?.[0]?.url ?? null,
        latestReportId,
        transferStatus: pendingTransfer?.status ?? null,
        pendingContact: pendingTransfer
          ? (pendingTransfer.receiver.email || pendingTransfer.receiver.phone)
          : null,
        transferRequestId: pendingTransfer?.id ?? null,
        receiverId: pendingTransfer?.receiverId ?? null,
        senderId: pendingTransfer?.senderId ?? null,
        receiver: pendingTransfer?.receiver ?? null,
        adoptionRequirements: formattedAdoptionRequirements,
      };

      await this.redisService.set(cacheKey, petData, 600);
    }

    // ── isFavorited — không cache theo user ───────────────────────────────────
    let isFavorited = false;
    if (userId) {
      const favoriteRecord = await this.prisma.favoritePet.findUnique({
        where: { userId_petId: { userId, petId: id } },
      });
      isFavorited = !!favoriteRecord;
    }

    return { ...petData, isFavorited };
  }

  async replaceQrCode(userId: string, petId: string, dto: ReplaceQrDto) {
    const { newTagId } = dto;
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId }, include: { tags: true },
    });

    if (!pet) throw new NotFoundException({ message: 'Pet not found.', i18n: { key: 'error.pet_not_found' } });
    if (!(await this.hasPermission(userId, pet))) {
      throw new ForbiddenException({ message: 'You do not have permission to perform actions on this pet.', i18n: { key: 'error.pet_unauthorized' } });
    }

    const newTag = await this.prisma.tag.findUnique({ where: { id: newTagId } });

    if (!newTag) throw new NotFoundException({ message: 'This QR code does not exist in the system.', i18n: { key: 'error.qr_not_found' } });
    if (newTag.petId && newTag.petId !== petId) {
      throw new ConflictException({ message: 'This QR code is already in use for another pet.', i18n: { key: 'error.qr_in_use' } });
    }
    if ((newTag as any).linkCount >= 3) {
      throw new BadRequestException({ message: 'This new QR code has reached its maximum reuse limit!', i18n: { key: 'error.qr_limit_reached' } });
    }
    if (newTag.petId === petId) {
      return { message: 'This QR code is already assigned to this pet.', i18n: { key: 'error.qr_already_assigned' } };
    }

    await this.prisma.$transaction(async (tx) => {
      if (pet.tags && pet.tags.length > 0) {
        await tx.tag.updateMany({
          // Nhả Tag cũ về INACTIVE
          where: { petId: pet.id }, data: { petId: null, status: 'INACTIVE' },
        });
      }
      await tx.tag.update({
        // Gán Tag mới và tăng biến đếm
        where: { id: newTagId }, data: { petId: pet.id, status: 'ACTIVE', linkedAt: new Date(), linkCount: { increment: 1 } } as any,
      });

      const qrCodeUrl = `https://pawcare.app/tag/${newTagId}`;

      await tx.pet.update({
        where: { id: pet.id },
        data: { qrCodeUrl, qrVerificationStatus: 'VERIFIED', needsQrReplacement: false },
      });
    });

    return {
      success: true,
      message: 'QR code replaced successfully!',
      i18n: { key: 'success.qr_replaced' },
      newTagId,
    };
  }

  async getPetByTagId(tagId: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      include: {
        pet: { include: { owner: { select: { id: true, name: true, avatarUrl: true, phone: true } }, images: { orderBy: { createdAt: 'asc' } } } },
      },
    });

    // 1. Nếu mã QR hoàn toàn không tồn tại trong hệ thống
    if (!tag) {
      throw new NotFoundException({ message: 'No pet found with this tag code', i18n: { key: 'error.pet_not_found_by_qr' } });
    }

    // 2. SỬA Ở ĐÂY: Nếu QR tồn tại nhưng ĐANG TRỐNG (chưa có Pet)
    if (!tag.pet) {
      return {
        isUnlinked: true, // Báo cho Frontend biết đây là QR trống
        tagId: tag.id,
        status: tag.status,
        linkCount: (tag as any).linkCount || 0
      };
    }

    const pet = tag.pet;
    const isLost = tag.status === TagStatus.LOST;

    if (!isLost && pet.owner) {
      (pet.owner as any).phone = null;
    }

    return {
      isUnlinked: false, // QR đã có thú cưng
      ...pet, dob: pet.dob ?? null,
      avatarUrl: pet.images?.length > 0 ? pet.images[0].url : null, isLost,
      lostInfo: isLost ? {
        ownerName: pet.lostContactName ?? pet.owner?.name ?? null,
        ownerPhone: pet.lostContactPhone ?? pet.owner?.phone ?? null,
        ownerAddress: pet.lostContactAddress ?? null, note: pet.lostDetails ?? null,
      } : null,
    };
  }

  async cancelTransfer(petId: string, userId: string) {
    const transferReq = await this.prisma.transferRequest.findFirst({
      where: { petId, status: 'PENDING', OR: [{ senderId: userId }, { receiverId: userId }] },
    });
    if (!transferReq) throw new BadRequestException({ message: 'No pending transfer request found.', i18n: { key: 'error.transfer_not_found' } });

    await this.prisma.transferRequest.update({ where: { id: transferReq.id }, data: { status: 'CANCELED' } });

    const eventPayload = { petId, transferId: transferReq.id, status: 'CANCELED' };
    await this.notificationsGateway.notifyUserSmartly(transferReq.senderId, 'transfer_cancelled', eventPayload);
    await this.notificationsGateway.notifyUserSmartly(transferReq.receiverId, 'transfer_cancelled', eventPayload);

    const targetUserId = userId === transferReq.senderId ? transferReq.receiverId : transferReq.senderId;
    const isSenderCanceling = userId === transferReq.senderId;

    await this.notificationsService.createAndSendNotification({
      userId: targetUserId, title: '❌ Transfer cancelled',
      body: isSenderCanceling ? 'The previous owner has cancelled the pet transfer request to you.' : 'The recipient has declined your pet transfer request.',
      type: NotificationType.SYSTEM, referenceId: petId,
      metadata: {
        transferId: transferReq.id,
        uiAction: 'navigate_transfer', // cho biết vẫn nên vào screen để xem trạng thái "Canceled"
        i18n: { titleKey: 'notification.transfer_cancelled_title', bodyKey: isSenderCanceling ? 'notification.transfer_cancelled_by_sender' : 'notification.transfer_cancelled_by_receiver' }
      }
    });

    await this.redisService.del(`pet:detail:${petId}`);
    return { success: true, message: 'Transfer request cancelled.', i18n: { key: 'success.transfer_cancelled' } };
  }


  async updatePet(userId: string, petId: string, updateData: any) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });

    if (!pet) throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });
    if (!(await this.hasPermission(userId, pet))) {
      throw new ConflictException({ message: 'You do not have permission to edit this pet\'s information!', i18n: { key: 'error.pet_unauthorized' } });
    }

    const now = new Date();

    if (updateData.name && updateData.name !== pet.name) {
      const isAdopted = pet.status === 'ADOPTED';
      const daysSinceAdoption = pet.adoptedAt ? this.diffInDays(now, pet.adoptedAt) : 999;
      const isUnlimitedNameChange = isAdopted && daysSinceAdoption <= 30;

      if (!isUnlimitedNameChange) {
        if (pet.nameLastUpdatedAt) {
          const daysSinceLastNameChange = this.diffInDays(now, pet.nameLastUpdatedAt);
          if (daysSinceLastNameChange < 14) {
            throw new BadRequestException({
              message: `You can only change the name once every 14 days. Please wait ${14 - daysSinceLastNameChange} more days.`,
              i18n: { key: 'error.name_change_limit', params: { daysLeft: 14 - daysSinceLastNameChange } }
            });
          }
        }
      }
      updateData.nameLastUpdatedAt = now;
    }

    const daysSinceCreation = this.diffInDays(now, pet.createdAt);
    const isCoreInfoLocked = daysSinceCreation >= 7;

    if (isCoreInfoLocked) {
      if (updateData.dob && pet.dob && new Date(updateData.dob).getTime() !== pet.dob.getTime()) {
        throw new BadRequestException({ message: 'Date of birth cannot be changed after 7 days of profile creation.', i18n: { key: 'error.dob_locked' } });
      }
      if (updateData.breed && pet.breed) {
        const newBreed = getBilingualText(updateData.breed);
        const oldBreed = getBilingualText(pet.breed);
        const breedChanged = newBreed.vi.trim() !== oldBreed.vi.trim() || newBreed.en.trim() !== oldBreed.en.trim();
        if (breedChanged) {
          throw new BadRequestException({ message: 'Pet breed cannot be changed after 7 days of profile creation.', i18n: { key: 'error.breed_locked' } });
        }
      }

      if (updateData.gender && pet.gender && updateData.gender !== pet.gender) {
        throw new BadRequestException({ message: 'Gender cannot be changed after 7 days of profile creation.', i18n: { key: 'error.gender_locked' } });
      }
    }

    const { images, medicalRecords, nameLastUpdatedAt, adoptionRequirementKeys, traits, goodWith, badWith, ...petInfo } = updateData;
    const requirementIds = adoptionRequirementKeys !== undefined
      ? await this.resolveRequirementIds(adoptionRequirementKeys)
      : undefined; // 🆕 — undefined nghĩa là FE không gửi field này, giữ nguyên dữ liệu cũ
    try {
      // ── Xử lý medicalRecords KHÔNG xoá hết — giữ nguyên verificationStatus của record cũ ──
      if (medicalRecords) {
        // 1. Lấy danh sách record hiện có trong DB của pet này
        const existingRecords = await this.prisma.medicalRecord.findMany({
          where: { petId },
          select: { id: true },
        });
        const existingIds = new Set(existingRecords.map((r) => r.id));

        // 2. Phân loại payload: record có id hợp lệ (đã tồn tại) vs record mới (chưa có id hoặc id không khớp DB)
        const incomingWithId = medicalRecords.filter((r: any) => r.id && existingIds.has(r.id));
        const incomingNew = medicalRecords.filter((r: any) => !r.id || !existingIds.has(r.id));
        const incomingIds = new Set(incomingWithId.map((r: any) => r.id));

        // 3. Record nào có trong DB nhưng KHÔNG còn trong payload -> user đã xoá ở FE -> xoá thật trong DB
        const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));

        await this.prisma.$transaction([
          // Xoá các record bị loại bỏ khỏi form
          ...(idsToDelete.length > 0
            ? [this.prisma.medicalRecord.deleteMany({ where: { id: { in: idsToDelete } } })]
            : []),

          // Update từng record đã tồn tại — KHÔNG đụng tới verificationStatus, giữ nguyên trạng thái VERIFIED/DISPUTED đã có
          ...incomingWithId.map((record: any) =>
            this.prisma.medicalRecord.update({
              where: { id: record.id },
              data: {
                type: record.type,
                recordName: getBilingualText(record.recordName) as any,
                recordDate: new Date(record.recordDate),
                images: record.images || [],
                hasNextDueDate: record.hasNextDueDate || false,
                nextDueDate: record.nextDueDate ? new Date(record.nextDueDate) : null,
                nextDueName: record.nextDueName ? (getBilingualText(record.nextDueName) as any) : null,
                // Không set verificationStatus ở đây -> giữ nguyên giá trị cũ trong DB
              },
            })
          ),

          // Tạo mới các record chưa từng tồn tại — mặc định PENDING (theo behavior cũ)
          ...(incomingNew.length > 0
            ? [
              this.prisma.medicalRecord.createMany({
                data: incomingNew.map((record: any) => ({
                  petId,
                  type: record.type,
                  recordName: getBilingualText(record.recordName) as any,
                  recordDate: new Date(record.recordDate),
                  images: record.images || [],
                  hasNextDueDate: record.hasNextDueDate || false,
                  nextDueDate: record.nextDueDate ? new Date(record.nextDueDate) : null,
                  nextDueName: record.nextDueName ? (getBilingualText(record.nextDueName) as any) : null,
                  // verificationStatus dùng default PENDING từ schema, không cần set tay
                })),
              }),
            ]
            : []),
        ]);
      }

      // ── Update các field còn lại của Pet (không đụng medicalRecords nữa) ──
      const updatedPet = await this.prisma.pet.update({
        where: { id: petId },
        data: {
          ...petInfo,
          dob: petInfo.dob ? new Date(petInfo.dob) : undefined,
          ...(nameLastUpdatedAt && { nameLastUpdatedAt }),
          ...(traits !== undefined && { traits: normalizeTraitsList(traits) }),
          ...(goodWith !== undefined && { goodWith: normalizeBilingualList(goodWith) }),
          ...(badWith !== undefined && { badWith: normalizeBilingualList(badWith) }),
          ...(requirementIds !== undefined && {                                        // 🆕 thêm khối này
            adoptionRequirements: {
              deleteMany: {},
              create: requirementIds.map((requirementId) => ({ requirementId })),
            },
          }),
          ...(images && images.length > 0 && { images: { deleteMany: {}, create: images.map((url: string) => ({ url })) } }),
        },
        include: { images: true, medicalRecords: true },
      });

      await this.redisService.del(`pet:detail:${petId}`);

      return {
        message: 'Pet information updated successfully',
        i18n: { key: 'success.pet_updated' },
        data: updatedPet,
      };
    } catch (error) {
      throw new InternalServerErrorException({ message: 'Error updating pet information', i18n: { key: 'error.update_pet_failed' } });
    }
  }
}