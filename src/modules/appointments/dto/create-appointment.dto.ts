// dto/create-appointment.dto.ts
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { AppointmentType } from '@prisma/client';

export class CreateAppointmentDto {
  @IsNotEmpty() @IsString() applicationId: string;
  @IsNotEmpty() @IsDateString() appointmentDate: string;
  @IsNotEmpty() @IsString() startTime: string;
  @IsNotEmpty() @IsString() endTime: string;
  @IsOptional() @IsEnum(AppointmentType) type?: AppointmentType;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() notes?: string;
}