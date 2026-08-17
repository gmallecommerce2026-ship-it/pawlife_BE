import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewDocumentDto {
  @IsIn(['ACCEPTED', 'REJECTED'])
  status: 'ACCEPTED' | 'REJECTED';

  @IsOptional() @IsString() reason?: string;
}