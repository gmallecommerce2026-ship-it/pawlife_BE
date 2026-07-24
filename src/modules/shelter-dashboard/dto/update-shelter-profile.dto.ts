// src/modules/shelter-dashboard/dto/update-shelter-profile.dto.ts
import { IsOptional, IsString, IsNumber, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class OpeningHourDto {
  @IsString() day!: string;
  @IsString() openTime!: string;
  @IsString() closeTime!: string;
  isOpen!: boolean;
}

export class UpdateShelterProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() @MaxLength(100) bio?: string;
  @IsOptional() @IsString() shelterType?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() @Type(() => Number) latitude?: number;
  @IsOptional() @IsNumber() @Type(() => Number) longitude?: number;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logoUrl?: string;  // 🆕 URL trả về từ /storage/presigned-url
  @IsOptional() @IsString() coverUrl?: string; // 🆕
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OpeningHourDto)
  openingHours?: OpeningHourDto[];
}