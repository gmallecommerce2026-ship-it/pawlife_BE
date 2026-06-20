import { IsNotEmpty, IsString } from 'class-validator';

export class ReplaceQrDto {
  @IsNotEmpty({ message: 'QR code cannot be empty' })
  @IsString({ message: 'Invalid QR code' })
  // REMOVE THIS LINE: @IsUUID('4', { message: 'Invalid QR code (Must be UUID)' })
  newTagId!: string; 
}