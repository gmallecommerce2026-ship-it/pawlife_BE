import { IsOptional, IsString } from 'class-validator';

export class SubmitDocumentDto {
  @IsString() fileUrl: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() fileSizeLabel?: string;
}