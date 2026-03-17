import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { PetGender, PetSize } from '@prisma/client'; // Import Enum từ Prisma

export class CreatePetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  species: string; // Dog, Cat...

  @IsString()
  @IsOptional()
  breed?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsString()
  @IsOptional()
  microchipNumber?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  contactAddress?: string;

  @IsString()
  @IsOptional()
  description?: string; // Tương đương "Notes"

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  // --- CÁC TRƯỜNG MỚI THÊM ---
  
  @IsEnum(PetGender)
  @IsOptional()
  gender?: PetGender; // MALE, FEMALE, UNKNOWN

  @IsEnum(PetSize)
  @IsOptional()
  size?: PetSize; // SMALL, MEDIUM, LARGE

  @IsNumber()
  @IsOptional()
  weight?: number; // Cân nặng (kg)

  @IsString()
  @IsOptional()
  color?: string; // Màu sắc (VD: Gray & White)

  @IsBoolean()
  @IsOptional()
  isVaccinated?: boolean; 

  @IsBoolean()
  @IsOptional()
  isSpayedNeutered?: boolean; 

  @IsString()
  @IsOptional()
  vaccinationRecordUrl?: string; 

  @IsString()
  @IsOptional()
  qrCodeUrl?: string;

  @IsOptional()
  @IsString()
  traits?: string;

  @IsOptional()
  @IsString()
  idealHome?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personalityTags?: string[];
}