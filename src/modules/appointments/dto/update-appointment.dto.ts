import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus, AppointmentType } from '@prisma/client';

export class UpdateAppointmentStatusDto {
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  @IsEnum(AppointmentStatus, { message: 'Trạng thái lịch hẹn không hợp lệ' })
  status: AppointmentStatus;

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RescheduleAppointmentDto {
  @IsNotEmpty({ message: 'appointmentDate không được để trống' })
  @IsString()
  appointmentDate: string;

  @IsNotEmpty({ message: 'startTime không được để trống' })
  @IsString()
  startTime: string;

  @IsNotEmpty({ message: 'endTime không được để trống' })
  @IsString()
  endTime: string;

  @IsOptional()
  @IsEnum(AppointmentType)
  type?: AppointmentType;

  @IsOptional()
  @IsString()
  notes?: string;
}