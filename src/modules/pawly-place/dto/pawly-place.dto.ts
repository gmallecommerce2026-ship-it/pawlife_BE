import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min,
} from 'class-validator';

export class LangQueryDto {
  @IsOptional() @IsIn(['vi', 'en']) lang?: 'vi' | 'en';
}

export class GeoLangDto extends LangQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lng?: number;
}

export class LimitGeoDto extends GeoLangDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) limit?: number;
}

export class SearchPlacesDto extends GeoLangDto {
  /** bán kính km, mặc định 20 */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.1) @Max(25000) radius?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  /** category key: viet | milk_tea | fast_food | chinese | breakfast */
  @IsOptional() @IsString() category?: string;
  /** "pawlife_friend,pet_allowed" — AND giữa các filter */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value,
  )
  @IsArray() @IsString({ each: true })
  filters?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class ListReviewsDto extends LangQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class UpsertReviewDto extends LangQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(2000) content?: string;
  /** URL ảnh đã upload (R2). Tối đa 4 */
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsUrl({ require_tld: false }, { each: true })
  images?: string[];
}

export class ReactReviewDto {
  @IsIn(['huuich', 'camon', 'huhu']) type!: 'huuich' | 'camon' | 'huhu';
}

export class ReportReviewDto {
  @IsString() @MaxLength(100) reason!: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}