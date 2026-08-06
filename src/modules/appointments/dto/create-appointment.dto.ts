import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { AppointmentType } from '@prisma/client';

export class CreateAppointmentDto {
  @IsNotEmpty({ message: 'applicationId không được để trống' })
  @IsString()
  applicationId: string;

  @IsNotEmpty({ message: 'appointmentDate không được để trống' })
  @IsDateString({}, { message: 'appointmentDate phải có dạng YYYY-MM-DD' })
  appointmentDate: string;

  @IsNotEmpty({ message: 'startTime không được để trống' })
  @IsString()
  startTime: string; // VD: "09:00"

  @IsNotEmpty({ message: 'endTime không được để trống' })
  @IsString()
  endTime: string; // VD: "10:00"

  @IsOptional()
  @IsEnum(AppointmentType, { message: 'Loại lịch hẹn không hợp lệ' })
  type?: AppointmentType;

  @IsOptional()
  @IsString()
  notes?: string;
}