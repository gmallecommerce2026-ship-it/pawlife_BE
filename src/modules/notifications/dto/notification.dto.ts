import { IsOptional, IsNumber, Min, IsString, IsNotEmpty, IsObject, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '@prisma/client'; 

export class GetNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  // Đổi thành "body" cho khớp hoàn toàn với schema
  @IsString()
  @IsNotEmpty()
  body: string; 

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType; 

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsObject()
  metadata?: any;
}