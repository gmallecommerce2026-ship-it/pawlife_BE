// src/modules/tags/dto/create-tag-report.dto.ts
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateTagReportDto {
  @IsString()
  @IsNotEmpty()
  tagId: string;

  @IsOptional()
  @IsString()
  scannedBy?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  // Đổi latitude thành lat
  @IsOptional()
  @IsNumber()
  lat?: number; 

  // Đổi longitude thành lng
  @IsOptional()
  @IsNumber()
  lng?: number; 

  // Bổ sung thêm radius
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  radius?: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  message?: string;
}