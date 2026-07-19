export declare enum OtpType {
    SIGNUP = "SIGNUP",
    FORGOT_PASSWORD = "FORGOT_PASSWORD"
}
export declare class SocialLoginDto {
    provider: 'GOOGLE' | 'APPLE' | 'FACEBOOK';
    token: string;
    name?: string;
    gender?: string;
    dob?: string | Date;
}
export declare class RegisterDto {
    email: string;
    otp: string;
    password: string;
    name: string;
    phone?: string;
    gender?: string;
    dob?: string;
    avatarUrl?: string;
}
export declare class LoginDto {
    email: string;
    password: string;
    rememberMe?: boolean;
}
export declare class SendOtpDto {
    email: string;
    type: OtpType;
}
export declare class VerifyOtpDto {
    email: string;
    otp: string;
}
export declare class ResetPasswordDto {
    email: string;
    otp: string;
    newPassword: string;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
export declare class UpdateProfileDto {
    name?: string;
    phone?: string;
    gender?: string;
    dob?: string;
    avatarUrl?: string;
}
