import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GetPresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'], {
    message: 'Unsupported file format (Only accepts images or MP4/MOV videos)',
  })
  fileType: string;

  @IsString()
  @IsOptional()
  folder?: string;
}