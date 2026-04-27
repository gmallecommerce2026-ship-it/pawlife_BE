// src/modules/tags/dto/create-tag-report.dto.ts
import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

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