import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReportReviewDto {
  @IsString()
  @IsNotEmpty({ message: 'reviewId không được để trống' })
  reviewId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn lý do báo cáo' })
  reason!: string;

  @IsString()
  @IsOptional()
  details?: string;
}