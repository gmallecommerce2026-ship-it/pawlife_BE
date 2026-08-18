// src/modules/applications/dto/schedule-appointment.dto.ts
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentType } from '@prisma/client';

class InterviewMemberDto {
  @IsString() id: string;
  @IsString() name: string;
  @IsOptional() @IsString() note?: string;
}

export class ScheduleAppointmentDto {
  @IsString() title: string;
  @IsEnum(AppointmentType) type: AppointmentType;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() meetLink?: string;
  @IsDateString() scheduledAt: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InterviewMemberDto)
  members: InterviewMemberDto[];
  @IsOptional() @IsString() reviewNote?: string;
}