import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export enum ContactTarget {
  ADMIN = 'ADMIN',
  DEVELOPER = 'DEVELOPER',
}

export class SendContactMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @IsEnum(ContactTarget)
  target: ContactTarget;
}