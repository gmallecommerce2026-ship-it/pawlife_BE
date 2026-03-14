import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GetPresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'], {
    message: 'Định dạng file không được hỗ trợ (Chỉ nhận ảnh hoặc video MP4/MOV)',
  })
  fileType: string;

  @IsString()
  @IsOptional()
  folder?: string;
}