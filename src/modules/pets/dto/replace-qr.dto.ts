import { IsNotEmpty, IsString } from 'class-validator';

export class ReplaceQrDto {
  @IsNotEmpty({ message: 'Mã QR không được để trống' })
  @IsString({ message: 'Mã QR không hợp lệ' })
  // XÓA DÒNG NÀY: @IsUUID('4', { message: 'Mã QR không hợp lệ (Phải là UUID)' })
  newTagId!: string; 
}