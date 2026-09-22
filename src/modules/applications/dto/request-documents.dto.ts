import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsString, ValidateNested } from 'class-validator';
import { DocumentCategory } from '@prisma/client';

export class RequestDocumentItemDto {
  @IsString() key: string;
  @IsString() label: string;
  @IsString() description: string;
  @IsEnum(DocumentCategory) category: DocumentCategory;
}

export class RequestDocumentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RequestDocumentItemDto)
  documents: RequestDocumentItemDto[];
}