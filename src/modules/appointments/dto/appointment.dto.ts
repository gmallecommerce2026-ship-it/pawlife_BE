import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { AppointmentStatus, AppointmentType } from '@prisma/client';

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @IsNotEmpty()
  @IsDateString()
  appointmentDate: string;

  @IsNotEmpty()
  @IsString()
  startTime: string; // VD: "09:00"

  @IsNotEmpty()
  @IsString()
  endTime: string; // VD: "10:00"

  @IsOptional()
  @IsEnum(AppointmentType)
  type?: AppointmentType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAppointmentStatusDto {
  @IsNotEmpty()
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  location?: string;
}