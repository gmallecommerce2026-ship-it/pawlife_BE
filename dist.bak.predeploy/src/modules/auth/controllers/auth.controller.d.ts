import { AuthService } from '../auth.service';
import { RegisterDto, LoginDto, SocialLoginDto, SendOtpDto, ResetPasswordDto, ChangePasswordDto, UpdateProfileDto } from '../dto/auth.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    sendOtp(sendOtpDto: SendOtpDto): Promise<{
        message: string;
    }>;
    register(registerDto: RegisterDto): Promise<{
        message: string;
        user: {
            id: string;
            email: string;
            password: string | null;
            role: import(".prisma/client").$Enums.Role;
            name: string | null;
            phone: string | null;
            gender: string | null;
            dob: Date | null;
            avatarUrl: string | null;
            provider: string;
            isDeleted: boolean;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            shelterId: string | null;
            twoFactorSecret: string | null;
            isTwoFactorEnabled: boolean;
        };
    }>;
    resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    getProfile(user: any): Promise<any>;
    changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    login(loginDto: LoginDto, userAgent: string, deviceNameHeader: string, deviceOsHeader: string, deviceIdHeader: string, forwardedIp: string, ip: string): Promise<{
        message: string;
        accessToken: string;
        user: {
            id: any;
            email: any;
            name: any;
            phone: any;
            gender: any;
            dob: any;
            avatarUrl: any;
            isTwoFactorEnabled: any;
            isProfileComplete: boolean;
        };
    } | {
        requires2FA: boolean;
        tempToken: string;
        message: string;
    }>;
    register2FA(user: any): Promise<{
        secret: string;
        qrCodeUrl: string;
    }>;
    turnOn2FA(userId: string, code: string): Promise<{
        message: string;
    }>;
    turnOff2FA(userId: string): Promise<{
        message: string;
    }>;
    loginWith2fa(tempToken: string, code: string, userAgent: string, deviceNameHeader: string, deviceOsHeader: string, forwardedIp: string, ip: string): Promise<{
        message: string;
        accessToken: string;
        user: {
            id: any;
            email: any;
            name: any;
            phone: any;
            gender: any;
            dob: any;
            avatarUrl: any;
            isTwoFactorEnabled: any;
            isProfileComplete: boolean;
        };
    }>;
    updateMyProfile(userId: string, updateData: UpdateProfileDto): Promise<{
        message: string;
        user: {
            id: string;
            email: string;
            password: string | null;
            role: import(".prisma/client").$Enums.Role;
            name: string | null;
            phone: string | null;
            gender: string | null;
            dob: Date | null;
            avatarUrl: string | null;
            provider: string;
            isDeleted: boolean;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            shelterId: string | null;
            twoFactorSecret: string | null;
            isTwoFactorEnabled: boolean;
        };
    }>;
    socialLogin(socialLoginDto: SocialLoginDto, userAgent: string, deviceNameHeader: string, deviceOsHeader: string, forwardedIp: string, ip: string): Promise<{
        message: string;
        accessToken: string;
        user: {
            id: any;
            email: any;
            name: any;
            phone: any;
            gender: any;
            dob: any;
            avatarUrl: any;
            isTwoFactorEnabled: any;
            isProfileComplete: boolean;
        };
    }>;
    getDevices(user: any): Promise<{
        id: string;
        name: string;
        os: string;
        location: string;
        type: string;
        isCurrentDevice: boolean;
        lastActive: string;
    }[]>;
    logoutDevice(userId: string, deviceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    deleteAccount(userId: string): Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    }>;
}
