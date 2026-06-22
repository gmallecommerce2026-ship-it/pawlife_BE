// src/modules/pets/pets.service.ts
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

export type PawHistoryType = 'CREATED' | 'BIRTH' | 'QR_LINKED' | 'TRANSFER' | 'VACCINE';

export interface PawHistoryItem {
  id: string;
  type: PawHistoryType;
  title: string;
  date: Date | string;
  description: string;
  i18n?: {
    titleKey: string;
    bodyKey: string;
    params?: Record<string, any>;
  };

}
function getEnglishText(field: unknown): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null && 'en' in field) {
    return String((field as any).en ?? '');
  }
  return String(field);
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
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });

    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException({ message: 'You do not have permission to perform actions on this pet!', i18n: { key: 'error.pet_unauthorized' } });
    }

    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new BadRequestException({ message: 'This QR code does not belong to the PawLife system or does not exist!', i18n: { key: 'error.qr_invalid' } });
    }

    if (tag.petId) {
      if (tag.petId === petId) throw new BadRequestException({ message: 'This QR code is already assigned to this pet!', i18n: { key: 'error.qr_already_assigned' } });
      throw new BadRequestException({ message: 'This QR code is already in use for another pet!', i18n: { key: 'error.qr_in_use' } });
    }

    await this.prisma.$transaction([
      this.prisma.tag.update({
        where: { id: tagId },
        data: { petId: petId, status: 'ACTIVE', linkedAt: new Date() }
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
              name: shelter?.name || 'Unnamed shelter',
              avatarUrl: shelter?.avatarUrl || null,
              address: shelter?.address || 'Not updated yet'
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
        shelter: { select: { name: true, avatarUrl: true, address: true } }
      }
    });

    if (dbPets.length === 0) {
      dbPets = await this.prisma.pet.findMany({
        where: {
          status: 'AVAILABLE',
          interactions: { some: { userId: userId, action: 'PASS' } },
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

    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException({ message: 'You do not have permission to delete this pet!', i18n: { key: 'error.pet_unauthorized' } });
    }

    await this.prisma.pet.delete({ where: { id: petId } });
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
    if (pet.ownerId !== userId && pet.shelterId !== userId) {
      throw new ConflictException({ message: 'You do not have permission to change the status!', i18n: { key: 'error.pet_unauthorized' } });
    }

    const newStatus = isLost ? 'LOST' : 'ACTIVE';
    const activeTag = await this.prisma.tag.findFirst({ where: { petId: petId, status: { not: 'INACTIVE' } } });

    await this.prisma.$transaction([
      this.prisma.tag.updateMany({ where: { petId: petId }, data: { status: newStatus } }),
      this.prisma.pet.update({
        where: { id: petId },
        data: {
          lostContactName: isLost ? ownerName : null, lostContactPhone: isLost ? ownerPhone : null,
          lostContactAddress: isLost ? ownerAddress : null, lostLocation: isLost ? location : null,
          lostDateTime: isLost ? dateTime : null,
          // FIX 1: Ép kiểu as any để qua mặt TypeScript
          lostDetails: isLost && note ? ({ vi: note.trim(), en: note.trim() } as any) : null,
          lostPhotos: isLost ? JSON.stringify(photos || []) : null, lostLatitude: isLost && latitude ? latitude : null,
          lostLongitude: isLost && longitude ? longitude : null, lostRadius: isLost && radius ? radius : null,
          lostDate: isLost && lostDate ? new Date(lostDate) : null,
        }
      }),
      ...(isLost && activeTag ? [
        this.prisma.tagReport.create({
          data: {
            tagId: activeTag.id, userId: userId, latitude: latitude || null, longitude: longitude || null,
            message: note ? `Lost report: ${note}` : 'The owner has reported the pet missing', scannedBy: ownerName || 'Owner', status: 'PENDING',
          }
        })
      ] : []),
      ...(isLost ? [] : [
        this.prisma.tagReport.updateMany({
          where: { tag: { petId: petId }, status: 'PENDING' }, data: { status: 'RESOLVED' }
        })
      ])
    ]);

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

    await this.prisma.transferRequest.updateMany({ where: { petId, status: 'PENDING' }, data: { status: 'CANCELED' } });

    const transferRequest = await this.prisma.transferRequest.create({
      data: { petId, senderId, receiverId: receiver.id, status: 'PENDING' },
    });

    await this.notificationsService.createAndSendNotification({
      userId: receiver.id, title: '🎁 New transfer request', body: 'You have received an adoption request from the pet\'s previous owner.',
      type: NotificationType.SYSTEM, referenceId: petId,
      metadata: { i18n: { titleKey: 'notification.transfer_request_title', bodyKey: 'notification.transfer_request_body' } }
    });

    this.notificationsGateway.server.to(`user_${receiver.id}`).emit('transfer_requested', { transferId: transferRequest.id, petId });
    await this.redisService.del(`pet:detail:${petId}`);

    return {
      success: true,
      message: 'Request sent',
      i18n: { key: 'success.transfer_requested' }
    };
  }

  async confirmTransfer(transferId: string, receiverId: string) {
    const transferReq = await this.prisma.transferRequest.findUnique({ where: { id: transferId } });

    if (!transferReq || transferReq.status !== 'PENDING') {
      throw new BadRequestException({ message: 'Invalid or already processed request', i18n: { key: 'error.invalid_transfer_request' } });
    }

    await this.prisma.pet.update({ where: { id: transferReq.petId }, data: { ownerId: receiverId } });
    await this.redisService.del(`pet:detail:${transferReq.petId}`);

    await this.prisma.transferRequest.updateMany({
      where: { petId: transferReq.petId, status: 'PENDING', id: { not: transferId } },
      data: { status: 'CANCELED' },
    });

    await this.prisma.transferRequest.update({ where: { id: transferId }, data: { status: 'COMPLETED' } });

    const payload = { petId: transferReq.petId };
    this.notificationsGateway.server.to(`user_${transferReq.senderId}`).emit('transfer_completed', payload);
    this.notificationsGateway.server.to(`user_${receiverId}`).emit('transfer_completed', payload);

    return {
      success: true,
      message: 'Transfer successful',
      i18n: { key: 'success.transfer_completed' }
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

  async createPet(userId: string, createPetDto: CreatePetDto) {
    const { images, tagId, medicalRecords, ...petData } = createPetDto;
    const publicDomain = this.configService.get<string>('R2_PUBLIC_DOMAIN');
    const idSetByShelter = await this.generateUniqueShelterCode();
    const medicalRecordsData = medicalRecords && medicalRecords.length > 0 ? {
      create: medicalRecords.map(record => ({
        type: record.type, recordName: record.recordName, recordDate: new Date(record.recordDate),
        images: record.images || [], hasNextDueDate: record.hasNextDueDate || false,
        nextDueDate: record.nextDueDate ? new Date(record.nextDueDate) : null, nextDueName: record.nextDueName,
      }))
    } : undefined;

    try {
      if (tagId) {
        const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
        if (!tag) throw new BadRequestException({ message: 'This QR code does not exist in the system!', i18n: { key: 'error.qr_not_found' } });
        if (tag.petId) throw new BadRequestException({ message: 'This QR code is already in use for another pet!', i18n: { key: 'error.qr_in_use' } });

        const result = await this.prisma.$transaction(async (prisma) => {
          const newPet = await prisma.pet.create({
            data: {
              // FIX 2: Ép kiểu as any cho petData
              ...(petData as any), ownerId: userId, status: 'ADOPTED', qrVerificationStatus: 'VERIFIED',
              qrCodeUrl: `${publicDomain}/qr-codes/${tagId}.svg`, idSetByShelter,
              ...(images && images.length > 0 && { images: { create: images.map(url => ({ url })) } }),
              ...(medicalRecordsData && { medicalRecords: medicalRecordsData })
            },
            include: { images: true }
          });
          await prisma.tag.update({ where: { id: tagId }, data: { petId: newPet.id, status: 'ACTIVE', linkedAt: new Date() } });
          return newPet;
        });
        return result;
      }

      const newPet = await this.prisma.pet.create({
        data: {
          // FIX 3: Ép kiểu as any cho petData
          ...(petData as any), ownerId: userId, status: 'ADOPTED', idSetByShelter,
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

  async searchPets(params: { search?: string; type?: string; limit?: number }) {
    const { search, type, limit = 20 } = params;
    const whereCondition: Prisma.PetWhereInput = {
      status: 'AVAILABLE',
    };

    if (search) {
      whereCondition.OR = [
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
      orderBy: {}
    });

    return {
      success: true,
      data: pets,
    };
  }

  async getPetById(id: string, userId?: string) {
    const cacheKey = `pet:detail:${id}`;
    let petData = await this.redisService.get<any>(cacheKey);

    if (!petData) {
      const pet = await this.prisma.pet.findUnique({
        where: { id },
        include: {
          owner: ownerSelectQuery,
          images: { orderBy: { createdAt: 'asc' } },
          medicalRecords: true, traitsList: true,
          shelter: { select: { id: true, name: true, contactInfo: true, address: true, avatarUrl: true } },
          transferRequests: {
            orderBy: { updatedAt: 'desc' },
            include: { receiver: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } }, sender: { select: { id: true, name: true } } }
          },
          tags: { include: { reports: { orderBy: { scannedAt: 'desc' }, take: 1, select: { id: true } } } },
        },
      });

      if (!pet) throw new NotFoundException({ message: 'Pet information not found!', i18n: { key: 'error.pet_not_found' } });

      if (!pet.idSetByShelter) {
        const newCode = await this.generateUniqueShelterCode();
        await this.prisma.pet.update({
          where: { id: pet.id },
          data: { idSetByShelter: newCode },
        });
        pet.idSetByShelter = newCode;
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
          address: 'Not updated yet',
        };
      }

      const pendingTransfer = pet.transferRequests && pet.transferRequests.length > 0
        ? pet.transferRequests.find(tr => tr.status === 'PENDING')
        : null;

      const pawHistory: PawHistoryItem[] = [];

      pawHistory.push({
        id: `join_${pet.id}`, type: 'CREATED', title: 'Joined PawLife',
        date: pet.createdAt, description: `The profile for ${pet.name} was created on the system.`,
        i18n: {
          titleKey: 'pawHistory.joined_title',
          bodyKey: 'pawHistory.joined_body',
          params: { petName: pet.name },
        },
      });


      if (pet.dob) {
        pawHistory.push({
          id: `dob_${pet.id}`, type: 'BIRTH', title: 'Date of Birth',
          date: pet.dob, description: `${pet.name} barked/meowed into the world.`,
          i18n: {
            titleKey: 'pawHistory.birth_title',
            bodyKey: 'pawHistory.birth_body',
            params: { petName: pet.name },
          },
        });
      }


      if (pet.tags && pet.tags.length > 0) {
        const linkedTags = pet.tags.filter(t => t.linkedAt !== null);
        linkedTags.forEach(tag => {
          const isActiveTag = tag.status !== 'INACTIVE';
          pawHistory.push({
            id: `tag_${tag.id}`, type: 'QR_LINKED', title: isActiveTag ? 'QR Code Registered' : 'QR Code Replaced',
            date: tag.linkedAt || tag.createdAt,
            description: isActiveTag ? `Smart collar activated for ${pet.name}.` : `Old smart collar replaced.`,
            i18n: {
              titleKey: isActiveTag ? 'pawHistory.qr_registered_title' : 'pawHistory.qr_replaced_title',
              bodyKey: isActiveTag ? 'pawHistory.qr_registered_body' : 'pawHistory.qr_replaced_body',
              params: { petName: pet.name },
            },

          });
        });
      }

      if (pet.medicalRecords && pet.medicalRecords.length > 0) {
        pet.medicalRecords.forEach(record => {
          const recordNameBi = JSON.parse(record.recordName);
          pawHistory.push({
            id: `med_${record.id}`, type: 'VACCINE', title: recordNameBi,
            date: record.recordDate, description: `Record ${record.type}: ${recordNameBi}`,
          });
        });
      }

      if (pet.transferRequests) {
        pet.transferRequests.filter(tr => tr.status === 'COMPLETED').forEach(tr => {
          pawHistory.push({
            id: `transfer_${tr.id}`, type: 'TRANSFER', title: 'Ownership Transferred',
            date: tr.updatedAt, description: `Successfully transferred to the new owner (${tr.receiver?.name || 'Anonymous'}).`,
            i18n: {
              titleKey: 'pawHistory.transfer_title',
              bodyKey: 'pawHistory.transfer_body',
              params: { receiverName: tr.receiver?.name || 'Anonymous' },
            },

          });
        });
      }

      pawHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let latestReportId: any = null;
      if (pet.tags && pet.tags.length > 0) {
        const activeTag = pet.tags.find(t => t.status !== 'INACTIVE') || pet.tags[0];
        if (activeTag && activeTag.reports && activeTag.reports.length > 0) {
          latestReportId = activeTag.reports[0].id;
        }
      }

      petData = {
        ...pet, shelter: formattedShelter, owner: formattedOwner, pawHistory,
        avatarUrl: pet.images && pet.images.length > 0 ? pet.images[0].url : null, latestReportId,
        transferStatus: pendingTransfer ? pendingTransfer.status : null,
        pendingContact: pendingTransfer ? (pendingTransfer.receiver.email || pendingTransfer.receiver.phone) : null,
        transferRequestId: pendingTransfer ? pendingTransfer.id : null, receiverId: pendingTransfer ? pendingTransfer.receiverId : null,
        senderId: pendingTransfer ? pendingTransfer.senderId : null, receiver: pendingTransfer ? pendingTransfer.receiver : null,
      };

      await this.redisService.set(cacheKey, petData, 600);
    }

    let isFavorited = false;
    if (userId) {
      const favoriteRecord = await this.prisma.favoritePet.findUnique({
        where: { userId_petId: { userId: userId, petId: id } }
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
    if (pet.ownerId !== userId) throw new ForbiddenException({ message: 'You do not have permission to perform actions on this pet.', i18n: { key: 'error.pet_unauthorized' } });

    const newTag = await this.prisma.tag.findUnique({ where: { id: newTagId } });

    if (!newTag) throw new NotFoundException({ message: 'This QR code does not exist in the system.', i18n: { key: 'error.qr_not_found' } });
    if (newTag.petId && newTag.petId !== petId) {
      throw new ConflictException({ message: 'This QR code is already in use for another pet.', i18n: { key: 'error.qr_in_use' } });
    }
    if (newTag.petId === petId) {
      return { message: 'This QR code is already assigned to this pet.', i18n: { key: 'error.qr_already_assigned' } };
    }

    await this.prisma.$transaction(async (tx) => {
      if (pet.tags && pet.tags.length > 0) {
        await tx.tag.updateMany({
          where: { petId: pet.id }, data: { petId: null, status: 'INACTIVE' },
        });
      }
      await tx.tag.update({
        where: { id: newTagId }, data: { petId: pet.id, status: 'ACTIVE', linkedAt: new Date() },
      });

      const qrCodeUrl = `https://yourdomain.com/scan/${newTagId}`;

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

    if (!tag || !tag.pet) {
      throw new NotFoundException({ message: 'No pet found with this tag code', i18n: { key: 'error.pet_not_found_by_qr' } });
    }

    const pet = tag.pet;
    const isLost = tag.status === TagStatus.LOST;

    if (!isLost && pet.owner) {
      (pet.owner as any).phone = null;
    }

    return {
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
      where: {
        petId: petId, status: 'PENDING',
        OR: [{ senderId: userId }, { receiverId: userId }]
      },
    });

    if (!transferReq) {
      throw new BadRequestException({ message: 'No pending transfer request found.', i18n: { key: 'error.transfer_not_found' } });
    }

    await this.prisma.transferRequest.update({
      where: { id: transferReq.id }, data: { status: 'CANCELED' },
    });

    const payload = { petId: petId };
    this.notificationsGateway.server.to(`user_${transferReq.senderId}`).emit('transfer_cancelled', payload);
    this.notificationsGateway.server.to(`user_${transferReq.receiverId}`).emit('transfer_cancelled', payload);

    const targetUserId = userId === transferReq.senderId ? transferReq.receiverId : transferReq.senderId;
    const isSenderCanceling = userId === transferReq.senderId;

    await this.notificationsService.createAndSendNotification({
      userId: targetUserId, title: '❌ Transfer cancelled',
      body: isSenderCanceling ? 'The previous owner has cancelled the pet transfer request to you.' : 'The recipient has declined your pet transfer request.',
      type: NotificationType.SYSTEM, referenceId: petId,
      metadata: { i18n: { titleKey: 'notification.transfer_cancelled_title', bodyKey: isSenderCanceling ? 'notification.transfer_cancelled_by_sender' : 'notification.transfer_cancelled_by_receiver' } }
    });

    await this.redisService.del(`pet:detail:${petId}`);

    return {
      success: true,
      message: 'Transfer request cancelled.',
      i18n: { key: 'success.transfer_cancelled' }
    };
  }

  async updatePet(userId: string, petId: string, updateData: any) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });

    if (!pet) throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });
    if (pet.ownerId !== userId && pet.shelterId !== userId) {
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
      if (updateData.breed && pet.breed && JSON.stringify(updateData.breed) !== JSON.stringify(pet.breed)) {
        throw new BadRequestException({ message: 'Pet breed cannot be changed after 7 days of profile creation.', i18n: { key: 'error.breed_locked' } });
      }
      if (updateData.gender && pet.gender && updateData.gender !== pet.gender) {
        throw new BadRequestException({ message: 'Gender cannot be changed after 7 days of profile creation.', i18n: { key: 'error.gender_locked' } });
      }
    }

    const { images, medicalRecords, nameLastUpdatedAt, ...petInfo } = updateData;

    try {
      const updatedPet = await this.prisma.pet.update({
        where: { id: petId },
        data: {
          ...petInfo, ...(nameLastUpdatedAt && { nameLastUpdatedAt }),
          ...(images && images.length > 0 && { images: { deleteMany: {}, create: images.map((url: string) => ({ url })) } }),
          ...(medicalRecords && {
            medicalRecords: {
              deleteMany: {},
              create: medicalRecords.map((record: any) => ({
                type: record.type, recordName: record.recordName, recordDate: new Date(record.recordDate),
                images: record.images || [], hasNextDueDate: record.hasNextDueDate || false,
                nextDueDate: record.nextDueDate ? new Date(record.nextDueDate) : null, nextDueName: record.nextDueName,
              }))
            }
          })
        },
        include: { images: true }
      });

      await this.redisService.del(`pet:detail:${petId}`);

      return {
        message: 'Pet information updated successfully',
        i18n: { key: 'success.pet_updated' },
        data: updatedPet
      };
    } catch (error) {
      throw new InternalServerErrorException({ message: 'Error updating pet information', i18n: { key: 'error.update_pet_failed' } });
    }
  }
}