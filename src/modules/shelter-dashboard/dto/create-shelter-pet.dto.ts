// src/modules/shelter-dashboard/dto/create-shelter-pet.dto.ts
import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PetGender, PetSize, PetStatus } from '@prisma/client';

class BilingualDto { @IsString() vi: string; @IsString() en: string; }

export enum VaccinationStatusDto {
  NOT_VACCINATED = 'NOT_VACCINATED',
  IN_PROGRESS = 'IN_PROGRESS',
  VACCINATED = 'VACCINATED',
}

class MedicalRecordInputDto {
  @IsOptional() @IsString() id?: string;
  @IsString() type: string;
  @IsString() recordName: string;              // 🔧 sửa từ BilingualDto → string
  @IsString() recordDate: string;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsBoolean() hasNextDueDate?: boolean;
  @IsOptional() @IsString() nextDueDate?: string;
  @IsOptional() @IsString() nextDueName?: string;   // 🔧 sửa tương tự
}

export class CreateShelterPetDto {
  @IsString() name: string;
  @IsOptional() species?: any;
  @IsOptional() breed?: any;
  @IsOptional() color?: any;
  @IsOptional() @IsEnum(PetGender) gender?: PetGender;
  @IsOptional() @IsEnum(PetSize) size?: PetSize;
  @IsOptional() @IsNumber() @Type(() => Number) weight?: number;
  @IsOptional() @IsString() dob?: string;
  @IsOptional() @IsString() microchipNumber?: string;
  @IsOptional() description?: any;
  @IsOptional() @IsBoolean() isVaccinated?: boolean;
  @IsOptional() @IsBoolean() isSpayedNeutered?: boolean;
  @IsOptional() @IsArray() healthStatus?: string[];

  // 🔧 SỬA: nhận string[] thuần, KHÔNG phải BilingualDto[]
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  traits?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goodWith?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  badWith?: string[];

  @IsOptional() @IsArray() adoptionRequirementKeys?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MedicalRecordInputDto)
  medicalRecords?: MedicalRecordInputDto[];
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsEnum(PetStatus) status?: PetStatus;

  @IsOptional() @IsString() tagId?: string;

  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() shelterInternalId?: string;
  @IsOptional() @IsEnum(VaccinationStatusDto) vaccinationStatus?: VaccinationStatusDto;
}

export class UpdateShelterPetDto extends CreateShelterPetDto {}