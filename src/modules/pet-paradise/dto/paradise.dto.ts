import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional, IsArray, IsEnum } from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty()
  @IsString()
  paradiseId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  images?: string[];
}

export enum ReactionTypeDto {
  HUUICH = 'HUUICH',
  CAMON = 'CAMON',
  HUHU = 'HUHU',
}

export class ToggleReactionDto {
  @IsEnum(ReactionTypeDto)
  type: ReactionTypeDto;
}

export class ReportReviewDto {
  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  details?: string;
}