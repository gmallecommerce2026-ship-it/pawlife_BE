// src/auth/dto/auth.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, Length, IsOptional, IsEnum, IsIn, IsBoolean } from 'class-validator';

export enum OtpType {
  SIGNUP = 'SIGNUP',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
}

export class SocialLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Provider cannot be empty' })
  @IsIn(['GOOGLE', 'APPLE', 'FACEBOOK'], { message: 'Invalid provider' })
  provider: 'GOOGLE' | 'APPLE' | 'FACEBOOK';

  @IsString()
  @IsNotEmpty({ message: 'Token cannot be empty' })
  token: string;

  // Add these fields so the React Native App can pass them down
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  dob?: string | Date; 
}

// Used for Registration
export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'The OTP code must be 6 characters long' }) // Added this field
  otp: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Please enter your full name' })
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;  // Added

  @IsString()
  @IsOptional()
  gender?: string; // Added

  @IsString()
  @IsOptional()
  dob?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

// Used for Login
export class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Please enter your password' })
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class SendOtpDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @IsEnum(OtpType, { message: 'Invalid OTP type (SIGNUP or FORGOT_PASSWORD)' })
  @IsNotEmpty()
  type: OtpType;
}

// Used for OTP Verification
export class VerifyOtpDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'The OTP code must be 6 characters long' })
  otp: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'The OTP code must be 6 characters long' })
  otp: string;

  @IsString()
  @MinLength(6, { message: 'New password must be at least 6 characters long' })
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Please enter your current password' })
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'New password must be at least 6 characters long' })
  newPassword: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}