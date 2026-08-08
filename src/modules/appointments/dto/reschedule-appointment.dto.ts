// dto/reschedule-appointment.dto.ts
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { AppointmentType } from '@prisma/client';

export class RescheduleAppointmentDto {
  @IsOptional() @IsDateString() appointmentDate?: string;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsEnum(AppointmentType) type?: AppointmentType;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() notes?: string;
}