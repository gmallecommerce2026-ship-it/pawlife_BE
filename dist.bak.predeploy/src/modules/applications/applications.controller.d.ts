import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
export declare class ApplicationsController {
    private readonly applicationsService;
    constructor(applicationsService: ApplicationsService);
    createApplication(userId: string, createApplicationDto: CreateApplicationDto): Promise<{
        success: boolean;
        data: {
            id: string;
            userId: string;
            petId: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            fullName: string;
            phone: string;
            zalo: string;
            adoptFor: string;
            location: string;
            housing: string;
            children: string;
            cage: string;
            petExperience: string;
            prevPetHistory: string;
            employmentStatus: string;
            adoptionReason: string;
            commitments: import(".prisma/client").Prisma.JsonValue;
            verificationPhotos: import(".prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    getMyApplications(userId: string): Promise<{
        success: boolean;
        data: ({
            pet: {
                id: string;
                name: string;
                breed: string | null;
                dob: Date | null;
                images: {
                    id: string;
                    url: string;
                    petId: string;
                    createdAt: Date;
                }[];
                shelter: {
                    id: string;
                    name: string;
                } | null;
            };
        } & {
            id: string;
            userId: string;
            petId: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            fullName: string;
            phone: string;
            zalo: string;
            adoptFor: string;
            location: string;
            housing: string;
            children: string;
            cage: string;
            petExperience: string;
            prevPetHistory: string;
            employmentStatus: string;
            adoptionReason: string;
            commitments: import(".prisma/client").Prisma.JsonValue;
            verificationPhotos: import(".prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        })[];
    }>;
    getApplicationById(userId: string, applicationId: string): Promise<{
        success: boolean;
        data: {
            pet: {
                images: {
                    id: string;
                    url: string;
                    petId: string;
                    createdAt: Date;
                }[];
                shelter: {
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
                status: import(".prisma/client").$Enums.PetStatus;
                gender: import(".prisma/client").$Enums.PetGender | null;
                size: import(".prisma/client").$Enums.PetSize | null;
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
                personalityTags: import(".prisma/client").Prisma.JsonValue | null;
                goodWith: import(".prisma/client").Prisma.JsonValue | null;
                badWith: import(".prisma/client").Prisma.JsonValue | null;
                vaccinationRecordUrls: import(".prisma/client").Prisma.JsonValue | null;
                vetVerificationStatus: import(".prisma/client").$Enums.VerificationStatus;
                qrCodeUrl: string | null;
                qrVerificationStatus: import(".prisma/client").$Enums.VerificationStatus;
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
        } & {
            id: string;
            userId: string;
            petId: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            fullName: string;
            phone: string;
            zalo: string;
            adoptFor: string;
            location: string;
            housing: string;
            children: string;
            cage: string;
            petExperience: string;
            prevPetHistory: string;
            employmentStatus: string;
            adoptionReason: string;
            commitments: import(".prisma/client").Prisma.JsonValue;
            verificationPhotos: import(".prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    updateVerificationPhotos(userId: string, applicationId: string, photos: string[]): Promise<{
        success: boolean;
        message: string;
        data: {
            id: string;
            userId: string;
            petId: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            fullName: string;
            phone: string;
            zalo: string;
            adoptFor: string;
            location: string;
            housing: string;
            children: string;
            cage: string;
            petExperience: string;
            prevPetHistory: string;
            employmentStatus: string;
            adoptionReason: string;
            commitments: import(".prisma/client").Prisma.JsonValue;
            verificationPhotos: import(".prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    withdrawApplication(userId: string, applicationId: string): Promise<{
        success: boolean;
        message: string;
        data: {
            id: string;
            userId: string;
            petId: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            fullName: string;
            phone: string;
            zalo: string;
            adoptFor: string;
            location: string;
            housing: string;
            children: string;
            cage: string;
            petExperience: string;
            prevPetHistory: string;
            employmentStatus: string;
            adoptionReason: string;
            commitments: import(".prisma/client").Prisma.JsonValue;
            verificationPhotos: import(".prisma/client").Prisma.JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
}
