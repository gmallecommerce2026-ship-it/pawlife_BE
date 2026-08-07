import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsEnum, IsBoolean, IsDateString, ValidateNested, IsNotEmptyObject } from 'class-validator';
import { PetGender, PetSize, PetStatus, VerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';

// 1. Tạo Class DTO chuẩn cho dữ liệu Song Ngữ
export class LocalizedStringDto {
  @IsString()
  @IsOptional()
  vi?: string;

  @IsString()
  @IsOptional()
  en?: string;
}

export class MedicalRecordDto {
  @IsString()
  @IsOptional()
  id?: string;

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

  // 2. Thay đổi các trường Song ngữ sang ValidateNested và type LocalizedStringDto
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsNotEmptyObject()
  species!: LocalizedStringDto; // Bắt buộc phải có Object ngôn ngữ

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsOptional()
  breed?: LocalizedStringDto;

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

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsOptional()
  description?: LocalizedStringDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsEnum(PetGender)
  @IsOptional()
  gender?: PetGender;

  @IsEnum(PetSize)
  @IsOptional()
  size?: PetSize;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsOptional()
  color?: LocalizedStringDto;

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

  @IsArray()
  @IsOptional()
  traits?: (string | LocalizedStringDto)[];

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  @IsOptional()
  idealHome?: LocalizedStringDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personalityTags?: string[];

  // 🔧 SỬA — lý do y hệt traits ở trên
  @IsArray()
  @IsOptional()
  goodWith?: (string | LocalizedStringDto)[];

  @IsArray()
  @IsOptional()
  badWith?: (string | LocalizedStringDto)[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  adoptionRequirementKeys?: string[];

  @IsString()
  @IsOptional()
  tagId?: string;

  @IsOptional()
  @IsEnum(PetStatus)
  status?: PetStatus;
}