import { IsBoolean, IsOptional, IsString, IsArray } from 'class-validator';

export class ToggleLostModeDto {
  @IsBoolean()
  isLost!: boolean;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  dateTime?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  ownerAddress?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true }) // Đảm bảo mọi phần tử trong mảng đều là chuỗi URL
  photos?: string[];
}