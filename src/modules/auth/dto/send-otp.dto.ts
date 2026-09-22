// send-otp.dto.ts
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export enum OtpType {
  SIGNUP = 'SIGNUP',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
}

export class SendOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(OtpType)
  @IsNotEmpty()
  type: OtpType;
}

// signup.dto.ts
export class SignUpDto {
  @IsEmail() email: string;
  @IsNotEmpty() otp: string;
  @IsNotEmpty() password: string;
  // Các field khác như name...
}