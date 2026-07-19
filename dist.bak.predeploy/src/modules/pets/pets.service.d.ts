import { PrismaService } from '../../database/prisma/prisma.service';
import { SwipePetDto } from './dto/swipe-pet.dto';
import { PetGender, PetSize, Prisma } from '@prisma/client';
import { CreatePetDto } from './dto/create-pet.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { RedisService } from 'src/database/redis/redis.service';
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
}
export declare class PetsService {
    private readonly prisma;
    private readonly swipeQueue;
    private notificationsGateway;
    private readonly notificationsService;
    private readonly redisService;
    private configService;
    constructor(prisma: PrismaService, swipeQueue: Queue, notificationsGateway: NotificationsGateway, notificationsService: NotificationsService, redisService: RedisService, configService: ConfigService);
    private calculateDistance;
    private getAvailablePetsByShelterIds;
    linkQrCode(userId: string, petId: string, tagId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getFeed(userId: string, limit: number, filters?: FeedFilters, lat?: number, lng?: number): Promise<{
        data: any[];
        meta: {
            limit: number;
            count: number;
            filters: FeedFilters | undefined;
        };
    }>;
    swipePet(userId: string, petId: string, swipePetDto: SwipePetDto): Promise<{
        message: string;
        data: {
            userId: string;
            petId: string;
            action: import("./dto/swipe-pet.dto").SwipeAction;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    addFavorite(userId: string, petId: string): Promise<{
        message: string;
        data: {
            id: string;
            createdAt: Date;
            userId: string;
            petId: string;
        };
    }>;
    removePet(userId: string, petId: string): Promise<{
        message: string;
    }>;
    toggleLostMode(userId: string, petId: string, dto: ToggleLostModeDto): Promise<{
        message: string;
        isLost: boolean;
    }>;
    requestTransfer(petId: string, payload: {
        email?: string;
        phone?: string;
    }, senderId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    confirmTransfer(transferId: string, receiverId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    removeFavorite(userId: string, petId: string): Promise<{
        message: string;
    }>;
    getFavorites(userId: string, skip: number, take: number): Promise<{
        data: ({
            images: {
                id: string;
                url: string;
                petId: string;
                createdAt: Date;
            }[];
            shelter: {
                id: string;
                name: string;
                avatarUrl: string | null;
            } | null;
        } & {
            id: string;
            name: string;
            species: string;
            breed: string | null;
            dob: Date | null;
            microchipNumber: string | null;
            description: string | null;
            status: import("@prisma/client").$Enums.PetStatus;
            gender: import("@prisma/client").$Enums.PetGender | null;
            size: import("@prisma/client").$Enums.PetSize | null;
            weight: number | null;
            color: string | null;
            lostPhotos: string | null;
            isVaccinated: boolean;
            isSpayedNeutered: boolean;
            contactName: string | null;
            contactPhone: string | null;
            contactAddress: string | null;
            traits: string | null;
            idealHome: string | null;
            personalityTags: Prisma.JsonValue | null;
            goodWith: Prisma.JsonValue | null;
            badWith: Prisma.JsonValue | null;
            vaccinationRecordUrls: Prisma.JsonValue | null;
            vetVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
            qrCodeUrl: string | null;
            qrVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
            ownerId: string | null;
            createdAt: Date;
            updatedAt: Date;
            shelterId: string | null;
            lostLatitude: number | null;
            lostLongitude: number | null;
            lostRadius: number | null;
            lostDate: Date | null;
            lostContactName: string | null;
            lostContactPhone: string | null;
            lostContactAddress: string | null;
            lostLocation: string | null;
            lostDateTime: string | null;
            lostDetails: string | null;
            needsQrReplacement: boolean;
        })[];
        meta: {
            skip: number;
            take: number;
            totalCount: number;
        };
    }>;
    getMyPets(userId: string): Promise<{
        avatarUrl: string | null;
        isLost: boolean;
        images: {
            id: string;
            url: string;
            petId: string;
            createdAt: Date;
        }[];
        tags: {
            id: string;
            status: import("@prisma/client").$Enums.TagStatus;
            petId: string | null;
        }[];
        id: string;
        name: string;
        species: string;
        breed: string | null;
        dob: Date | null;
        microchipNumber: string | null;
        description: string | null;
        status: import("@prisma/client").$Enums.PetStatus;
        gender: import("@prisma/client").$Enums.PetGender | null;
        size: import("@prisma/client").$Enums.PetSize | null;
        weight: number | null;
        color: string | null;
        lostPhotos: string | null;
        isVaccinated: boolean;
        isSpayedNeutered: boolean;
        contactName: string | null;
        contactPhone: string | null;
        contactAddress: string | null;
        traits: string | null;
        idealHome: string | null;
        personalityTags: Prisma.JsonValue | null;
        goodWith: Prisma.JsonValue | null;
        badWith: Prisma.JsonValue | null;
        vaccinationRecordUrls: Prisma.JsonValue | null;
        vetVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
        qrCodeUrl: string | null;
        qrVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
        ownerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        shelterId: string | null;
        lostLatitude: number | null;
        lostLongitude: number | null;
        lostRadius: number | null;
        lostDate: Date | null;
        lostContactName: string | null;
        lostContactPhone: string | null;
        lostContactAddress: string | null;
        lostLocation: string | null;
        lostDateTime: string | null;
        lostDetails: string | null;
        needsQrReplacement: boolean;
    }[]>;
    createPet(userId: string, createPetDto: CreatePetDto): Promise<{
        images: {
            id: string;
            url: string;
            petId: string;
            createdAt: Date;
        }[];
    } & {
        id: string;
        name: string;
        species: string;
        breed: string | null;
        dob: Date | null;
        microchipNumber: string | null;
        description: string | null;
        status: import("@prisma/client").$Enums.PetStatus;
        gender: import("@prisma/client").$Enums.PetGender | null;
        size: import("@prisma/client").$Enums.PetSize | null;
        weight: number | null;
        color: string | null;
        lostPhotos: string | null;
        isVaccinated: boolean;
        isSpayedNeutered: boolean;
        contactName: string | null;
        contactPhone: string | null;
        contactAddress: string | null;
        traits: string | null;
        idealHome: string | null;
        personalityTags: Prisma.JsonValue | null;
        goodWith: Prisma.JsonValue | null;
        badWith: Prisma.JsonValue | null;
        vaccinationRecordUrls: Prisma.JsonValue | null;
        vetVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
        qrCodeUrl: string | null;
        qrVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
        ownerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        shelterId: string | null;
        lostLatitude: number | null;
        lostLongitude: number | null;
        lostRadius: number | null;
        lostDate: Date | null;
        lostContactName: string | null;
        lostContactPhone: string | null;
        lostContactAddress: string | null;
        lostLocation: string | null;
        lostDateTime: string | null;
        lostDetails: string | null;
        needsQrReplacement: boolean;
    }>;
    searchPets(params: {
        search?: string;
        type?: string;
        limit?: number;
    }): Promise<{
        success: boolean;
        data: ({
            images: {
                id: string;
                url: string;
                petId: string;
                createdAt: Date;
            }[];
            shelter: {
                id: string;
                name: string;
                avatarUrl: string | null;
                address: string;
            } | null;
        } & {
            id: string;
            name: string;
            species: string;
            breed: string | null;
            dob: Date | null;
            microchipNumber: string | null;
            description: string | null;
            status: import("@prisma/client").$Enums.PetStatus;
            gender: import("@prisma/client").$Enums.PetGender | null;
            size: import("@prisma/client").$Enums.PetSize | null;
            weight: number | null;
            color: string | null;
            lostPhotos: string | null;
            isVaccinated: boolean;
            isSpayedNeutered: boolean;
            contactName: string | null;
            contactPhone: string | null;
            contactAddress: string | null;
            traits: string | null;
            idealHome: string | null;
            personalityTags: Prisma.JsonValue | null;
            goodWith: Prisma.JsonValue | null;
            badWith: Prisma.JsonValue | null;
            vaccinationRecordUrls: Prisma.JsonValue | null;
            vetVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
            qrCodeUrl: string | null;
            qrVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
            ownerId: string | null;
            createdAt: Date;
            updatedAt: Date;
            shelterId: string | null;
            lostLatitude: number | null;
            lostLongitude: number | null;
            lostRadius: number | null;
            lostDate: Date | null;
            lostContactName: string | null;
            lostContactPhone: string | null;
            lostContactAddress: string | null;
            lostLocation: string | null;
            lostDateTime: string | null;
            lostDetails: string | null;
            needsQrReplacement: boolean;
        })[];
    }>;
    getPetById(id: string, userId?: string): Promise<any>;
    replaceQrCode(userId: string, petId: string, dto: ReplaceQrDto): Promise<{
        message: string;
        success?: undefined;
        newTagId?: undefined;
    } | {
        success: boolean;
        message: string;
        newTagId: string;
    }>;
    getPetByTagId(tagId: string): Promise<{
        dob: Date | null;
        avatarUrl: string | null;
        isLost: boolean;
        lostInfo: {
            ownerName: string | null;
            ownerPhone: string | null;
            ownerAddress: string | null;
            note: string | null;
        } | null;
        images: {
            id: string;
            url: string;
            petId: string;
            createdAt: Date;
        }[];
        owner: {
            id: string;
            name: string | null;
            phone: string | null;
            avatarUrl: string | null;
        } | null;
        id: string;
        name: string;
        species: string;
        breed: string | null;
        microchipNumber: string | null;
        description: string | null;
        status: import("@prisma/client").$Enums.PetStatus;
        gender: import("@prisma/client").$Enums.PetGender | null;
        size: import("@prisma/client").$Enums.PetSize | null;
        weight: number | null;
        color: string | null;
        lostPhotos: string | null;
        isVaccinated: boolean;
        isSpayedNeutered: boolean;
        contactName: string | null;
        contactPhone: string | null;
        contactAddress: string | null;
        traits: string | null;
        idealHome: string | null;
        personalityTags: Prisma.JsonValue | null;
        goodWith: Prisma.JsonValue | null;
        badWith: Prisma.JsonValue | null;
        vaccinationRecordUrls: Prisma.JsonValue | null;
        vetVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
        qrCodeUrl: string | null;
        qrVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
        ownerId: string | null;
        createdAt: Date;
        updatedAt: Date;
        shelterId: string | null;
        lostLatitude: number | null;
        lostLongitude: number | null;
        lostRadius: number | null;
        lostDate: Date | null;
        lostContactName: string | null;
        lostContactPhone: string | null;
        lostContactAddress: string | null;
        lostLocation: string | null;
        lostDateTime: string | null;
        lostDetails: string | null;
        needsQrReplacement: boolean;
    }>;
    cancelTransfer(petId: string, userId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    updatePet(userId: string, petId: string, updateData: any): Promise<{
        message: string;
        data: {
            images: {
                id: string;
                url: string;
                petId: string;
                createdAt: Date;
            }[];
        } & {
            id: string;
            name: string;
            species: string;
            breed: string | null;
            dob: Date | null;
            microchipNumber: string | null;
            description: string | null;
            status: import("@prisma/client").$Enums.PetStatus;
            gender: import("@prisma/client").$Enums.PetGender | null;
            size: import("@prisma/client").$Enums.PetSize | null;
            weight: number | null;
            color: string | null;
            lostPhotos: string | null;
            isVaccinated: boolean;
            isSpayedNeutered: boolean;
            contactName: string | null;
            contactPhone: string | null;
            contactAddress: string | null;
            traits: string | null;
            idealHome: string | null;
            personalityTags: Prisma.JsonValue | null;
            goodWith: Prisma.JsonValue | null;
            badWith: Prisma.JsonValue | null;
            vaccinationRecordUrls: Prisma.JsonValue | null;
            vetVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
            qrCodeUrl: string | null;
            qrVerificationStatus: import("@prisma/client").$Enums.VerificationStatus;
            ownerId: string | null;
            createdAt: Date;
            updatedAt: Date;
            shelterId: string | null;
            lostLatitude: number | null;
            lostLongitude: number | null;
            lostRadius: number | null;
            lostDate: Date | null;
            lostContactName: string | null;
            lostContactPhone: string | null;
            lostContactAddress: string | null;
            lostLocation: string | null;
            lostDateTime: string | null;
            lostDetails: string | null;
            needsQrReplacement: boolean;
        };
    }>;
}
