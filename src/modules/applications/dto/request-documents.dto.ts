import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, ValidateNested } from 'class-validator';

export class RequestDocumentItemDto {
  @IsString() key: string;
  @IsString() label: string;
  @IsString() description: string;
}

export class RequestDocumentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RequestDocumentItemDto)
  documents: RequestDocumentItemDto[];
}