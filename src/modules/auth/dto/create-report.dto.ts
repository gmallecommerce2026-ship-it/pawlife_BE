// src/modules/reports/dto/create-report.dto.ts
import { IsString, IsOptional, IsBoolean, IsIn, IsNotEmpty } from 'class-validator';

export const REPORT_TYPES = ['pet', 'shelter', 'user', 'event', 'medical_record', 'matching'] as const;
export type ReportType = typeof REPORT_TYPES[number];

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsIn(REPORT_TYPES)
  type: ReportType;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsBoolean()
  isBlockRequested?: boolean;
}