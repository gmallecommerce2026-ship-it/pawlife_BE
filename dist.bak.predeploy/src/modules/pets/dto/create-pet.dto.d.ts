import { PetGender, PetSize } from '@prisma/client';
export declare class CreatePetDto {
    name: string;
    species: string;
    breed?: string;
    dob?: string;
    microchipNumber?: string;
    contactName?: string;
    contactPhone?: string;
    contactAddress?: string;
    description?: string;
    images?: string[];
    gender?: PetGender;
    size?: PetSize;
    weight?: number;
    color?: string;
    isVaccinated?: boolean;
    isSpayedNeutered?: boolean;
    vaccinationRecordUrls?: string[];
    qrCodeUrl?: string;
    traits?: string;
    idealHome?: string;
    personalityTags?: string[];
    tagId?: string;
}
