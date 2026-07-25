import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// Dùng chung cho title/subtitle/content/quote/afterQuote — mỗi field bilingual
// đều bắt buộc cả 2 ngôn ngữ, khớp với validate ở FE (viMissing/enMissing).
export class BilingualDto {
  @IsString()
  vi: string;

  @IsString()
  en: string;
}

// Dùng riêng cho fullContent — mỗi ngôn ngữ là 1 mảng các đoạn văn
export class BilingualListDto {
  @IsArray()
  @IsString({ each: true })
  vi: string[];

  @IsArray()
  @IsString({ each: true })
  en: string[];
}

export class CreateStoryDto {
  // FE tự sinh id (slug_timestamp) và gửi kèm cho cả create lẫn update,
  // giữ nguyên logic giống Ingredient để không phải đổi FE.
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @ValidateNested()
  @Type(() => BilingualDto)
  title: BilingualDto;

  @ValidateNested()
  @Type(() => BilingualDto)
  subtitle: BilingualDto;

  @ValidateNested()
  @Type(() => BilingualDto)
  content: BilingualDto;

  @ValidateNested()
  @Type(() => BilingualListDto)
  fullContent: BilingualListDto;

  @ValidateNested()
  @Type(() => BilingualDto)
  quote: BilingualDto;

  @ValidateNested()
  @Type(() => BilingualDto)
  afterQuote: BilingualDto;

  @IsDateString()
  date: string;

  @IsArray()
  @IsString({ each: true })
  images: string[];
}