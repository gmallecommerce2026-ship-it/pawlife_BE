// src/modules/shelter-dashboard/dto/create-shelter-pet.dto.ts
import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PetGender, PetSize, PetStatus } from '@prisma/client';

class BilingualDto { @IsString() vi: string; @IsString() en: string; }

class MedicalRecordInputDto {
  @IsOptional() @IsString() id?: string;
  @IsString() type: string;
  @ValidateNested() @Type(() => BilingualDto) recordName: BilingualDto;
  @IsString() recordDate: string;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsBoolean() hasNextDueDate?: boolean;
  @IsOptional() @IsString() nextDueDate?: string;
  @IsOptional() @ValidateNested() @Type(() => BilingualDto) nextDueName?: BilingualDto;
}

export class CreateShelterPetDto {
  @IsString() name: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => BilingualDto)
  species?: BilingualDto;              // 'Dog' | 'Cat' | Bilingual — service tự chuẩn hoá
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
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BilingualDto)
  traits?: BilingualDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BilingualDto)
  goodWith?: BilingualDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BilingualDto)
  badWith?: BilingualDto[];

  @IsOptional() @IsArray() adoptionRequirementKeys?: string[]; // key trong bảng AdoptionRequirement
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MedicalRecordInputDto)
  medicalRecords?: MedicalRecordInputDto[];
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsEnum(PetStatus) status?: PetStatus; // shelter được set AVAILABLE/PENDING/ADOPTED
}

export class UpdateShelterPetDto extends CreateShelterPetDto { }