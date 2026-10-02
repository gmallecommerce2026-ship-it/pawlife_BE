// src/modules/shelter-dashboard/dto/update-shelter-profile.dto.ts
import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

class OpeningHourDto {
  @IsIn(WEEKDAYS)
  day!: string;

  @IsBoolean()
  isOpen!: boolean;

  @IsString()
  openTime!: string;

  @IsString()
  closeTime!: string;
}

export class UpdateShelterProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() @MaxLength(360) bio?: string;          // 100 → 160
  @IsOptional() @IsString() shelterType?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() @Type(() => Number) latitude?: number;
  @IsOptional() @IsNumber() @Type(() => Number) longitude?: number;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() policy?: string;                       // 🆕
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() coverUrl?: string;
  @IsOptional() @IsString() website?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHourDto)
  openingHours?: OpeningHourDto[];
}