// src/modules/tags/dto/report-tag-report-item.dto.ts
import { IsBoolean, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class ReportTagReportItemDto {
  @IsString()
  @IsNotEmpty()
  tagReportId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsBoolean()
  isHideRequested?: boolean;

  @IsOptional()
  @IsBoolean()
  isBlockRequested?: boolean;
}