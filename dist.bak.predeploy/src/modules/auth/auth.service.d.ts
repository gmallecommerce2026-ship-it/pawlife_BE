import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegisterDto, LoginDto, SocialLoginDto, SendOtpDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { R2Service } from '../storage/r2.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from 'src/database/redis/redis.service';
import { Queue } from 'bullmq';
export declare class AuthService {
    private prisma;
    private readonly mailerService;
    private jwtService;
    private readonly r2Service;
    private readonly notificationsService;
    private readonly redisService;
    private readonly mailQueue;
    private googleClient;
    constructor(prisma: PrismaService, mailerService: MailerService, jwtService: JwtService, r2Service: R2Service, notificationsService: NotificationsService, redisService: RedisService, mailQueue: Queue);
    sendOtp(dto: SendOtpDto): Promise<{
        message: string;
    }>;
    verifyGoogleSignIn(idToken: string): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            password: string | null;
            role: import("@prisma/client").$Enums.Role;
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
        isNewUser: boolean;
    }>;
    getDevices(userId: string, currentSessionId?: string): Promise<{
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
    private generateOTP;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    register(dto: RegisterDto): Promise<{
        message: string;
        user: {
            id: string;
            email: string;
            password: string | null;
            role: import("@prisma/client").$Enums.Role;
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
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    generateTwoFactorAuthenticationSecret(userId: string, email: string): Promise<{
        secret: string;
        qrCodeUrl: string;
    }>;
    turnOnTwoFactorAuthentication(userId: string, code: string): Promise<{
        message: string;
    }>;
    turnOffTwoFactorAuthentication(userId: string): Promise<{
        message: string;
    }>;
    login(dto: LoginDto, userAgent: string, ip: string, deviceNameHeader?: string, deviceOsHeader?: string, deviceIdHeader?: string): Promise<{
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
    updateProfile(userId: string, updateData: any): Promise<{
        message: string;
        user: {
            id: string;
            email: string;
            password: string | null;
            role: import("@prisma/client").$Enums.Role;
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
    loginWith2fa(tempToken: string, code: string, userAgent: string, ip: string, deviceNameHeader?: string, deviceOsHeader?: string): Promise<{
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
    deleteAccount(userId: string): Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    }>;
    private extractFileKey;
    socialLogin(dto: SocialLoginDto, userAgent: string, ip: string, deviceNameHeader?: string, deviceOsHeader?: string): Promise<{
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
    private generateAuthResponse;
}
