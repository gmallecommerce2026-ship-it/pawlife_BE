import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsArray, IsNumber, IsDateString } from 'class-validator';

export class ToggleLostModeDto {
  @IsBoolean()
  isLost!: boolean;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  dateTime?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  ownerAddress?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true }) // Đảm bảo mọi phần tử trong mảng đều là chuỗi URL
  photos?: string[];

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  radius?: number;

  // BỔ SUNG:
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsDateString()
  lostDate?: string;
}