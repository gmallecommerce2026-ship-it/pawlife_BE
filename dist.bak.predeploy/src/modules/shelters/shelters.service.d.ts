import { PrismaService } from 'src/database/prisma/prisma.service';
import { GetSheltersDto } from './dto/get-shelters.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from 'src/database/redis/redis.service';
export declare class SheltersService {
    private readonly prisma;
    private readonly notificationsService;
    private readonly redisService;
    constructor(prisma: PrismaService, notificationsService: NotificationsService, redisService: RedisService);
    getOrganizerProfile(organizerId: string, userId?: string): Promise<{
        success: boolean;
        data: {
            id: string;
            name: string;
            handle: string;
            avatar: string;
            coverImg: string;
            followers: number;
            totalEvents: number;
            about: string;
            isFollowing: boolean;
            events: {
                id: string;
                title: string;
                category: string | null;
                description: string | null;
                bannerUrl: string | null;
                startDate: Date;
                endDate: Date | null;
                locationName: string;
                address: string | null;
                latitude: number | null;
                longitude: number | null;
                interestedCount: number;
                organizerId: string | null;
                createdAt: Date;
                updatedAt: Date;
            }[];
        };
    }>;
    findAll(query: GetSheltersDto): any;
    findOne(id: string, userId?: string): Promise<{
        adoptedCount: number;
        isFollowed: boolean;
        _count: {
            pets: number;
            followers: number;
        };
        pets: ({
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
        })[];
        id: string;
        name: string;
        address: string;
        contactInfo: string;
        emailAddress: string | null;
        isVerified: boolean;
        createdAt: Date;
        verifiedAt: Date | null;
        description: string | null;
        policy: string | null;
        avatarUrl: string | null;
        coverUrl: string | null;
        latitude: number | null;
        longitude: number | null;
    }>;
    follow(shelterId: string, userId: string): Promise<{
        message: string;
    }>;
    unfollow(shelterId: string, userId: string): Promise<{
        message: string;
    }>;
    toggleFollow(shelterId: string, userId: string): Promise<{
        success: boolean;
        isFollowed: boolean;
        followersCount: number;
    }>;
    getFollowedSheltersByUser(userId: string): Promise<{
        id: string;
        name: string;
        address: string;
        imageUrl: string;
        isFollowing: boolean;
        _count: {
            pets: number;
            followers: number;
        };
    }[]>;
    private calculateDistance;
    getSheltersNearBy(lat: number, lng: number, limit?: number): any;
}
