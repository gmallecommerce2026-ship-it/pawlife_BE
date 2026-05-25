// src/modules/pets/dto/replace-qr.dto.ts
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ReplaceQrDto {
  @IsNotEmpty()
  @IsUUID('4', { message: 'Mã QR không hợp lệ (Phải là UUID)' })
  newTagId!: string; // ID của mã QR mới quét được
}