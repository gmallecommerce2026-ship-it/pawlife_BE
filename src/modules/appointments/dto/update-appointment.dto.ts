// dto/update-appointment-status.dto.ts
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class UpdateAppointmentStatusDto {
  @IsNotEmpty() @IsEnum(AppointmentStatus) status: AppointmentStatus;
  @IsOptional() @IsString() cancellationReason?: string;
}