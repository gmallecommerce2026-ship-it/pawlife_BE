// src/modules/applications/dto/schedule-appointment.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class InterviewMemberDto {
  @IsString()
  id: string;

  @IsString()
  @MinLength(1)
  name: string;

  // Dùng để mời làm attendee trong sự kiện Google Calendar (đồng tổ chức buổi Meet).
  // Optional vì thành viên có thể chỉ tham gia offline hoặc chưa cung cấp email.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ScheduleAppointmentDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsIn(['Online', 'Offline'])
  format: 'Online' | 'Offline';

  @IsOptional()
  @IsString()
  location?: string | null;

  // Không còn bắt buộc từ FE — BE tự tạo qua Google Meet API khi format = Online.
  // Chỉ giữ lại để dùng khi Google API lỗi và cần fallback thủ công.
  @IsOptional()
  @IsString()
  meetingLink?: string | null;

  @IsISO8601()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewMemberDto)
  members: InterviewMemberDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  reminderMinutesBefore?: number;

  @IsOptional()
  @IsString()
  reviewNote?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}