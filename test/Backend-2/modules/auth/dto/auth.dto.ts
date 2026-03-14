// src/auth/dto/auth.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, Length, IsOptional, IsEnum } from 'class-validator';

export enum OtpType {
  SIGNUP = 'SIGNUP',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
}

export class SocialLoginDto {
  provider: 'GOOGLE' | 'APPLE' | 'FACEBOOK';
  token: string; // Token nhận được từ SDK ở Frontend
}
// Dùng cho Đăng ký
export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải có 6 ký tự' }) // Bổ sung trường này
  otp: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;  // Bổ sung

  @IsString()
  @IsOptional()
  gender?: string; // Bổ sung

  @IsString()
  @IsOptional()
  dob?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}


// Dùng cho Đăng nhập
export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  password: string;
}

export class SendOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsEnum(OtpType, { message: 'Loại OTP không hợp lệ (SIGNUP hoặc FORGOT_PASSWORD)' })
  @IsNotEmpty()
  type: OtpType;
}

// Dùng cho Xác thực OTP
export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải có 6 ký tự' })
  otp: string;
}