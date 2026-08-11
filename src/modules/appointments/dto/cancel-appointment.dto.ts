// dto/cancel-appointment.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}