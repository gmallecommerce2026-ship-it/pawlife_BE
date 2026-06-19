import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsEnum, IsBoolean, IsDateString, ArrayMaxSize, ValidateNested } from 'class-validator';
import { PetGender, PetSize, VerificationStatus } from '@prisma/client'; // Import Enum từ Prisma
import { Type } from 'class-transformer';
export class MedicalRecordDto {
  @IsString()
  @IsNotEmpty()
  type: string = "";

  @IsString()
  @IsNotEmpty()
  recordName: string = "";

  @IsDateString()
  recordDate: string = "";

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  hasNextDueDate?: boolean;

  @IsDateString()
  @IsOptional()
  nextDueDate?: string;

  @IsString()
  @IsOptional()
  nextDueName?: string;

  @IsEnum(VerificationStatus)
  @IsOptional()
  verificationStatus?: VerificationStatus;
}
export class CreatePetDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  species!: string; // Dog, Cat...

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicalRecordDto)
  @IsOptional()
  medicalRecords?: MedicalRecordDto[];

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

  @IsString()
  @IsOptional()
  tagId?: string;
}