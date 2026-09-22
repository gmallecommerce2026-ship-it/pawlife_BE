import { PetsService } from './pets.service';
import { SwipePetDto } from './dto/swipe-pet.dto';
import { GetFavoritesDto } from './dto/get-favorites.dto';
import { PetGender, PetSize } from '@prisma/client';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { ToggleLostModeDto } from './dto/toggle-lost-mode.dto';
import { ReplaceQrDto } from './dto/replace-qr.dto';
export declare class PetsController {
    private readonly petsService;
    constructor(petsService: PetsService);
    linkQrCode(userId: string, petId: string, tagId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    requestTransfer(petId: string, body: {
        email?: string;
        phone?: string;
    }, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    cancelTransfer(petId: string, userId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    confirmTransfer(transferId: string, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    getFeed(userId: string, limit: number, gender?: PetGender, size?: PetSize, species?: string, lat?: string, lng?: string): Promise<{
        data: any[];
        meta: {
            limit: number;
            count: number;
            filters: import("./pets.service").FeedFilters | undefined;
        };
    }>;
    getFavorites(userId: string, query: GetFavoritesDto): Promise<{
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
            personalityTags: import("@prisma/client").Prisma.JsonValue | null;
            goodWith: import("@prisma/client").Prisma.JsonValue | null;
            badWith: import("@prisma/client").Prisma.JsonValue | null;
            vaccinationRecordUrls: import("@prisma/client").Prisma.JsonValue | null;
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
    removeFavorite(userId: string, petId: string): Promise<{
        message: string;
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
        personalityTags: import("@prisma/client").Prisma.JsonValue | null;
        goodWith: import("@prisma/client").Prisma.JsonValue | null;
        badWith: import("@prisma/client").Prisma.JsonValue | null;
        vaccinationRecordUrls: import("@prisma/client").Prisma.JsonValue | null;
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
        personalityTags: import("@prisma/client").Prisma.JsonValue | null;
        goodWith: import("@prisma/client").Prisma.JsonValue | null;
        badWith: import("@prisma/client").Prisma.JsonValue | null;
        vaccinationRecordUrls: import("@prisma/client").Prisma.JsonValue | null;
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
    replaceQrCode(req: any, petId: string, replaceQrDto: ReplaceQrDto): Promise<{
        message: string;
        success?: undefined;
        newTagId?: undefined;
    } | {
        success: boolean;
        message: string;
        newTagId: string;
    }>;
    getPetById(userId: string, id: string): Promise<any>;
    searchPets(search?: string, type?: string, limit?: number): Promise<{
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
            personalityTags: import("@prisma/client").Prisma.JsonValue | null;
            goodWith: import("@prisma/client").Prisma.JsonValue | null;
            badWith: import("@prisma/client").Prisma.JsonValue | null;
            vaccinationRecordUrls: import("@prisma/client").Prisma.JsonValue | null;
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
    updatePet(userId: string, petId: string, updatePetDto: UpdatePetDto): Promise<{
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
            personalityTags: import("@prisma/client").Prisma.JsonValue | null;
            goodWith: import("@prisma/client").Prisma.JsonValue | null;
            badWith: import("@prisma/client").Prisma.JsonValue | null;
            vaccinationRecordUrls: import("@prisma/client").Prisma.JsonValue | null;
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
    removePet(userId: string, petId: string): Promise<{
        message: string;
    }>;
    toggleLostMode(req: any, id: string, dto: ToggleLostModeDto): Promise<{
        message: string;
        isLost: boolean;
    }>;
}
