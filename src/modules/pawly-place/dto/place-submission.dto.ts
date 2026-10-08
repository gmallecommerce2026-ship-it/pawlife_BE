import { PlaceSubmissionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional,
  IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export const SUBMISSION_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------------------------- Opening hours ----------------------------
export class SubmissionTimeFrameDto {
  @IsString() @Matches(HHMM, { message: 'open must be HH:mm' }) open!: string;
  @IsString() @Matches(HHMM, { message: 'close must be HH:mm' }) close!: string;
}

export class SubmissionDayHoursDto {
  @IsIn(SUBMISSION_DAYS) day!: string;
  @IsBoolean() isOpen!: boolean;
  @IsBoolean() is24Hours!: boolean;

  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => SubmissionTimeFrameDto)
  timeFrames!: SubmissionTimeFrameDto[];
}

// ---------------------------- Menu ----------------------------
export class SubmissionMenuItemDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(200) subtext?: string;
  @IsOptional() @IsString() @MaxLength(40) priceLabel?: string;
  @IsOptional() @IsString() @MaxLength(500) image?: string;
}

export class SubmissionMenuSectionDto {
  @IsString() @MinLength(1) @MaxLength(100) title!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SubmissionMenuItemDto)
  items!: SubmissionMenuItemDto[];
}

// ---------------------------- Create ----------------------------
export class CreatePlaceSubmissionDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;

  @IsOptional() @IsString() @MaxLength(1000) description?: string;

  @IsString() @MinLength(5) @MaxLength(300) address!: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;

  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;

  @IsOptional() @IsString() @Matches(/^[0-9+\s().-]{6,20}$/, { message: 'phone is invalid' }) phone?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  categoryKeys!: string[];

  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => SubmissionDayHoursDto)
  operatingHours!: SubmissionDayHoursDto[];

  @IsOptional() @IsBoolean() isUncertainHours?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional() @IsString() @MaxLength(500) extraRules?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SubmissionMenuSectionDto)
  menuSections?: SubmissionMenuSectionDto[];
}

// ---------------------------- Admin ----------------------------
export class ListSubmissionsDto {
  @IsOptional() @IsEnum(PlaceSubmissionStatus) status?: PlaceSubmissionStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsString() lang?: string;
}

export class RejectSubmissionDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}