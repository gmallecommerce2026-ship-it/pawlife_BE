// dto/delegate-booking.dto.ts
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class DelegateBookingDto {
  @IsNotEmpty() @IsBoolean() delegated: boolean;
}