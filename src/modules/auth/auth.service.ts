// src/modules/auth/auth.service.ts
import { Injectable, BadRequestException, UnauthorizedException, InternalServerErrorException, ConflictException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegisterDto, LoginDto, SocialLoginDto, SendOtpDto, OtpType, ResetPasswordDto, ChangePasswordDto, RegisterShelterDirectDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import appleSignin from 'apple-signin-auth';
import { MailerService } from '@nestjs-modules/mailer';
import { R2Service } from '../storage/r2.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import { UAParser } from 'ua-parser-js';
import * as geoip from 'geoip-lite';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { RedisService } from 'src/database/redis/redis.service';
import { InjectQueue } from '@nestjs/bullmq'; // <-- ADDED
import { Queue } from 'bullmq'; // <-- ADDED
import { formatNameFromEmail, buildFallbackAvatarUrl } from 'src/common/utils/avatar.util';
import * as https from 'https';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private readonly mailerService: MailerService,
    private jwtService: JwtService,
    private readonly r2Service: R2Service,
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService,
    @InjectQueue('mail') private readonly mailQueue: Queue // <-- ADDED
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // =======================================================
  // UPGRADED FUNCTION: USE BULLMQ TO SEND OTP EMAIL IN BACKGROUND
  // =======================================================
  async sendOtp(dto: SendOtpDto) {
    const { email, type } = dto;

    if (type === OtpType.FORGOT_PASSWORD) {
      const userExists = await this.prisma.user.findUnique({ where: { email } });
      if (!userExists) throw new BadRequestException('Email not found');
    }

    const otp = this.generateOTP();
    const redisKey = `auth:otp:${type}:${email}`; // Create unique key for redis

    // 1. Save OTP to Redis with a TTL of 300 seconds (5 minutes)
    await this.redisService.set(redisKey, { otp }, 300);

    const isSignUp = type === OtpType.SIGNUP;
    const subject = isSignUp ? 'Verification code' : 'Password reset verification code';

    // 2. PUSH TASK TO BACKGROUND JOB
    // Server will dispatch immediately (1ms) without waiting for MailerService to finish
    await this.mailQueue.add(
      'send-otp', // Job name
      { email, subject, otp, isSignUp }, // Data payload
      {
        removeOnComplete: true, // Remove from RAM when completed
        attempts: 3, // Retry 3 times if Google SMTP encounters a network error
      }
    );

    // 3. Return success to the phone immediately
    return { message: 'The OTP code is being sent to your email.' };
  }

  // =======================================================
  // ALL FUNCTIONS BELOW REMAIN COMPLETELY UNCHANGED
  // =======================================================
  async verifyGoogleSignIn(idToken: string) {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID, });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) throw new Error('Invalid Google Token');
    const { email, name, picture } = payload;
    let user = await this.prisma.user.findUnique({ where: { email } });
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({ data: { email: email, name: name, avatarUrl: picture, }, });
    }
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
    return { accessToken, user, isNewUser, };
  }
  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself.');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: blockedId } });
    if (!targetUser) {
      throw new BadRequestException('User to block does not exist.');
    }

    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });

    await this.prisma.transferRequest.updateMany({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: blockedId, receiverId: blockerId },
          { senderId: blockerId, receiverId: blockedId },
        ],
      },
      data: { status: 'CANCELED' },
    });

    return { success: true, message: 'User blocked successfully.' };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    return { success: true, message: 'User unblocked successfully.' };
  }
  async reportUser(
    reporterId: string,
    targetId: string,
    reason: string,
    detail?: string,
    isBlockRequested?: boolean,
  ) {
    if (reporterId === targetId) {
      throw new BadRequestException('You cannot report yourself.');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      throw new BadRequestException('Reported user does not exist.');
    }

    const report = await this.prisma.report.create({
      data: {
        userId: reporterId,
        targetId,
        type: 'user',
        reason,
        detail,
      },
    });

    // Nếu người dùng tick "Chặn" khi report -> block luôn
    if (isBlockRequested) {
      await this.blockUser(reporterId, targetId);
    }

    return { success: true, message: 'Report submitted successfully.', data: report };
  }

  async getBlockedUsers(blockerId: string) {
    // 1. Lấy danh sách bản ghi block (không include vì không có relation)
    const blocks = await this.prisma.userBlock.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
    });

    if (blocks.length === 0) return [];

    // 2. Lấy thông tin User tương ứng
    const blockedIds = blocks.map((b) => b.blockedId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: blockedIds } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // 3. Map lại theo đúng thứ tự blockedAt desc, bỏ qua user đã bị xoá (nếu có)
    return blocks
      .map((b) => {
        const u = userMap.get(b.blockedId);
        if (!u) return null;
        return {
          id: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          blockedAt: b.createdAt,
        };
      })
      .filter(Boolean);
  }


  async getDevices(userId: string, currentSessionId?: string) {
    const devices = await this.prisma.deviceSession.findMany({ where: { userId }, orderBy: { lastActive: 'desc' }, });
    return devices.map(device => ({ id: device.id, name: device.deviceName || 'Unknown Device', os: device.os || 'Unknown OS', location: device.location || 'Unknown Location', type: device.deviceType, isCurrentDevice: device.id === currentSessionId, lastActive: device.lastActive.toISOString(), }));
  }

  async logoutDevice(userId: string, deviceId: string) {
    const device = await this.prisma.deviceSession.findUnique({ where: { id: deviceId }, });
    if (!device || device.userId !== userId) throw new BadRequestException('The device does not exist or does not belong to you.');
    await this.prisma.deviceSession.delete({ where: { id: deviceId } });
    // INVALIDATE SESSION IN REDIS
    await this.redisService.del(`auth:session:${deviceId}`);
    return { success: true, message: 'Logged out of device.' };
  }

  private generateOTP(): string { return Math.floor(100000 + Math.random() * 900000).toString(); }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { currentPassword, newPassword } = dto;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, });
    if (!user) throw new UnauthorizedException('User does not exist.');
    if (!user.password) throw new BadRequestException('This account was created using a social login and cannot change its password.');
    const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordMatch) throw new BadRequestException('The current password is incorrect.');
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashedNewPassword }, });
    await this.notificationsService.createAndSendNotification({ userId: user.id, title: '🔒 Update password', body: 'You have successfully changed your password. If you did not initiate this change, please contact support immediately.', type: NotificationType.SECURITY, });
    await this.redisService.del(`auth:user_profile:${userId}`);
    return { message: 'Your password has been successfully changed.' };
  }

  async register(dto: RegisterDto) {
    const { email, otp, password, name, phone, gender, dob, avatarUrl } = dto;
    const existingUser = await this.prisma.user.findUnique({ where: { email: email } });
    if (existingUser) throw new ConflictException('This email address is already in use!');
    const redisKey = `auth:otp:${OtpType.SIGNUP}:${email}`;
    const otpRecord = await this.redisService.get<{ otp: string }>(redisKey);
    if (!otpRecord) throw new BadRequestException('Please request a new OTP before registering, as the previous one has expired.');
    if (otpRecord.otp !== otp) throw new BadRequestException('The OTP is incorrect');
    const hashedPassword = await bcrypt.hash(password, 10);

    const finalName = name?.trim() || formatNameFromEmail(email);
    const finalAvatarUrl = avatarUrl || buildFallbackAvatarUrl(finalName);

    const newUser = await this.prisma.$transaction(async (tx) => {
      return await tx.user.create({ data: { email, password: hashedPassword, name: finalName, phone, gender, dob, avatarUrl: finalAvatarUrl, }, });
    });
    await this.redisService.del(redisKey);
    await this.notificationsService.createAndSendNotification({ userId: newUser.id, title: '🎉 Welcome to PawLife', body: 'Your account has been securely set up. Let the pet journey begin!', type: NotificationType.SECURITY, });
    return { message: 'Registration successful', user: newUser };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;
    const redisKey = `auth:otp:${OtpType.FORGOT_PASSWORD}:${email}`;
    const otpRecord = await this.redisService.get<{ otp: string }>(redisKey);

    if (!otpRecord) throw new BadRequestException('Please submit a new password reset request or the code has expired.');
    if (otpRecord.otp !== otp) throw new BadRequestException('The OTP you entered is invalid.');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      return await tx.user.update({
        where: { email },
        data: { password: hashedPassword },
      });
    });

    // 1. Delete used OTP
    await this.redisService.del(redisKey);

    // =========================================================================
    // 2. ADDED: CLEAR USER PROFILE CACHE TO INVALIDATE OLD JWT TOKEN
    // =========================================================================
    await this.redisService.del(`auth:user_profile:${updatedUser.id}`);

    // 3. Send notification
    await this.notificationsService.createAndSendNotification({
      userId: updatedUser.id,
      title: '🔒 Password changed successfully',
      body: 'Your account password has just been updated. If you did not do this, please contact us immediately.',
      type: NotificationType.SECURITY,
    });

    return { message: 'Password has been changed successfully. You can log in with the new password.' };
  }

  async generateTwoFactorAuthenticationSecret(userId: string, email: string) {
    const secret = speakeasy.generateSecret({ name: `PawLife (${email})`, });
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret.base32 }, });
    if (!secret.otpauth_url) throw new InternalServerErrorException('System error: Cannot generate URL for 2FA.');
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    return { secret: secret.base32, qrCodeUrl: qrCodeDataUrl };
  }

  async turnOnTwoFactorAuthentication(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new BadRequestException('2FA secret code has not been generated.');
    const isCodeValid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1, });
    if (!isCodeValid) throw new BadRequestException('Incorrect 2FA code.');
    await this.prisma.user.update({ where: { id: userId }, data: { isTwoFactorEnabled: true }, });
    return { message: 'Two-factor authentication enabled successfully.' };
  }

  async turnOffTwoFactorAuthentication(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { isTwoFactorEnabled: false, twoFactorSecret: null }, });
    return { message: 'Two-factor authentication disabled.' };
  }
  async registerShelterDirect(dto: RegisterShelterDirectDto, userAgent: string, ip: string) {
    const { email, password, name, phone, address, lat, lng } = dto;

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException('Email này đã được sử dụng!');

    const hashedPassword = await bcrypt.hash(password, 10);
    const finalName = name?.trim() || formatNameFromEmail(email);
    const finalAvatarUrl = buildFallbackAvatarUrl(finalName);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const shelter = await tx.shelter.create({
        data: { name, address, contactInfo: phone, latitude: lat, longitude: lng, isVerified: false },
      });
      return tx.user.create({
        data: { email, password: hashedPassword, name: finalName, avatarUrl: finalAvatarUrl, phone, role: 'SHELTER', shelterId: shelter.id, shelterRole: 'ADMIN' },
      });
    });

    if (lat != null && lng != null && newUser.shelterId) {
      await this.redisService.addLocation('shelters:locations', lng, lat, newUser.shelterId);
    }
    const currentGlobalVersion = (await this.redisService.get<number>('shelters:cache_version:global')) || 0;
    await this.redisService.set('shelters:cache_version:global', currentGlobalVersion + 1, 0);

    return this.generateAuthResponse(newUser, userAgent, ip);
  }
  async login(
    dto: LoginDto,
    userAgent: string,
    ip: string,
    deviceNameHeader?: string,
    deviceOsHeader?: string,
    deviceIdHeader?: string // <-- 1. ADD THIS PARAMETER
  ) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { shelter: true } });

    if (!user || !user.password) throw new UnauthorizedException('Incorrect account or password.');

    const isPasswordMatch = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordMatch) throw new UnauthorizedException('Incorrect account or password.');

    if (user.isTwoFactorEnabled) {
      const tempToken = this.jwtService.sign({ userId: user.id, is2FAPending: true }, { expiresIn: '5m' });
      return { requires2FA: true, tempToken, message: 'Please enter the Authenticator code to continue.', };
    }

    if (user.role === 'SHELTER' && user.shelter && !user.shelter.isVerified) {
      throw new UnauthorizedException('Tài khoản trạm cứu hộ của bạn đang chờ Admin xét duyệt. Vui lòng thử lại sau.');
    }
    // <-- 2. PASS DOWN TO MAIN HANDLER FUNCTION
    return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader, deviceIdHeader, dto.rememberMe);
  }

  async updateProfile(userId: string, updateData: any) {
    // Prevent users from sending sensitive fields like password, role, isDeleted...
    const allowedUpdates = {
      name: updateData.name,
      phone: updateData.phone,
      gender: updateData.gender,
      dob: updateData.dob,
      avatarUrl: updateData.avatarUrl,
    };

    // Remove undefined keys
    Object.keys(allowedUpdates).forEach(key => allowedUpdates[key] === undefined && delete allowedUpdates[key]);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: allowedUpdates,
    });

    // =========================================================================
    // FIX BUG HERE: Clear Redis cache to invalidate old data. 
    // The next /me or login API call will force a fresh DB query.
    // =========================================================================
    await this.redisService.del(`auth:user_profile:${userId}`);

    return {
      message: 'Update successful',
      user: updatedUser
    };
  }

  async loginWith2fa(tempToken: string, code: string, userAgent: string, ip: string, deviceNameHeader?: string, deviceOsHeader?: string) {
    let decoded;
    try { decoded = this.jwtService.verify(tempToken); } catch (error) { throw new UnauthorizedException('The 2FA session has expired. Please log in again.'); }
    if (!decoded.is2FAPending) throw new UnauthorizedException('Invalid token.');
    const user = await this.prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw new UnauthorizedException('User does not exist.');
    if (!user.twoFactorSecret) throw new UnauthorizedException('This account has not set up a 2FA security code.');
    const isCodeValid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1, });
    if (!isCodeValid) throw new UnauthorizedException('Incorrect 2FA code.');
    return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader);
  }

  async deleteAccount(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, });
      if (!user) return { success: true };
      if (user.avatarUrl) {
        const fileKey = this.extractFileKey(user.avatarUrl);
        await this.r2Service.deleteFile(fileKey);
      }
      await this.prisma.$transaction(async (tx) => {
        const deletedEmail = `deleted_${Date.now()}_${user.email}`;
        await tx.user.update({ where: { id: userId }, data: { email: deletedEmail, password: '', avatarUrl: null, name: 'Deleted User', phone: null, isDeleted: true, deletedAt: new Date(), }, });
      });
      await this.redisService.del(`auth:user_profile:${userId}`);
      return { success: true, message: 'Account has been permanently deleted.' };
    } catch (error) { throw new InternalServerErrorException('Cannot delete account at this time'); }
  }

  private extractFileKey(url: string): string { const urlObj = new URL(url); return urlObj.pathname.substring(1); }

  async socialLogin(dto: SocialLoginDto, userAgent: string, ip: string, deviceNameHeader?: string, deviceOsHeader?: string) {
    let email: string; let name: string = dto.name || ''; let picture: string | null = null; let gender: string | null = dto.gender || null; let dob: Date | null = dto.dob ? new Date(dto.dob) : null;
    try {
      switch (dto.provider) {
        case 'GOOGLE': {
          const ticket = await this.googleClient.verifyIdToken({ idToken: dto.token, audience: process.env.GOOGLE_CLIENT_ID, });
          const payload = ticket.getPayload();
          if (!payload || !payload.email) throw new BadRequestException('Invalid Google token.');
          email = payload.email; if (!name) name = payload.name || email.split('@')[0]; picture = payload.picture || null; break;
        }
        case 'FACEBOOK': {
          // Call Facebook API to get info
          const httpsAgent = new https.Agent({ family: 4 }); // Force IPv4
          const { data } = await axios.get(
            `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${dto.token}`,
            { httpsAgent }
          );

          if (!data) throw new BadRequestException('Cannot connect to the Facebook system.');

          // EMAIL FALLBACK STRATEGY: 
          // Many users create FB with a phone number so they won't have an email. We create a dummy email to avoid disrupting the login flow.
          email = data.email || `${data.id}@facebook.pawlife.local`;

          if (!name) name = data.name || `User_${data.id.substring(0, 6)}`;
          picture = data.picture?.data?.url || null;
          break;
        }
        case 'APPLE': {
          const payload = await appleSignin.verifyIdToken(dto.token, { audience: process.env.APPLE_CLIENT_ID, ignoreExpiration: true, });
          if (!payload || typeof payload.email !== 'string') throw new BadRequestException('Apple token error.');
          email = payload.email; if (!name) name = email.split('@')[0]; break;
        }
        default: throw new BadRequestException('Unsupported provider.');
      }
    } catch (error: any) {
      // 1. Log detailed errors from Axios (Facebook API) for easy debugging
      const realError = error?.response?.data?.error?.message || error?.message || 'Unknown error';
      console.error('Real Social Login Error:', realError);

      if (error instanceof HttpException) {
        throw error;
      }

      // TEMPORARILY RETURN REAL ERROR TO FRONTEND TO FIX BUG
      throw new UnauthorizedException(`Real error: ${realError}`);
    }

    let user = await this.prisma.user.findUnique({ where: { email }, });
    if (!user) {
      const finalName = name?.trim() || formatNameFromEmail(email);
      const finalAvatarUrl = picture || buildFallbackAvatarUrl(finalName);
      user = await this.prisma.user.create({ data: { email, name: finalName, avatarUrl: finalAvatarUrl, gender: gender, dob: dob, }, });
    } else {
      const updateData: any = {};
      if (!user.name || user.name === 'User') updateData.name = name?.trim() || formatNameFromEmail(email);
      if (!user.avatarUrl) updateData.avatarUrl = picture || buildFallbackAvatarUrl(updateData.name || user.name);
      if (!user.gender && gender) updateData.gender = gender;
      if (!user.dob && dob) updateData.dob = dob;
      if (Object.keys(updateData).length > 0) { user = await this.prisma.user.update({ where: { email }, data: updateData }); }
    }
    return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader);
  }

  private async generateAuthResponse(
    user: any,
    userAgent: string,
    ip: string,
    deviceNameHeader?: string,
    deviceOsHeader?: string,
    deviceIdHeader?: string, // <-- ADDED 6TH PARAMETER: Physical device ID
    rememberMe?: boolean // <-- ADDED 7TH PARAMETER: Remember login
  ) {

    let updatedData: any = {}; let needsUpdate = false;
    if (!user.name || user.name.trim() === '' || user.name === 'User') { updatedData.name = formatNameFromEmail(user.email); user.name = updatedData.name; needsUpdate = true; }
    if (!user.gender) { updatedData.gender = 'UNKNOWN'; user.gender = updatedData.gender; needsUpdate = true; }
    if (!user.avatarUrl) { updatedData.avatarUrl = buildFallbackAvatarUrl(user.name); user.avatarUrl = updatedData.avatarUrl; needsUpdate = true; }
    if (needsUpdate) { await this.prisma.user.update({ where: { id: user.id }, data: updatedData, }); }
    const parser = new UAParser(userAgent);
    const os = parser.getOS();
    const device = parser.getDevice();

    let deviceType = 'smartphone';
    if (device.type === 'tablet') deviceType = 'tablet';
    if (!device.type && (os.name === 'Mac OS' || os.name === 'Windows' || os.name === 'Linux' || os.name === 'Ubuntu')) {
      deviceType = 'laptop';
    }

    const geo = geoip.lookup(ip);
    const location = geo ? `${geo.city || ''}, ${geo.country || ''}`.replace(/^, |, $/g, '') || 'Unknown Location' : 'Unknown Location';

    // Prioritize Header sent from Mobile because it is more accurate than the default User-Agent
    const finalDeviceName = deviceNameHeader || device.model || os.name || 'Unknown Device';
    const finalOsName = deviceOsHeader || `${os.name || ''} ${os.version || ''}`.trim() || 'Unknown OS';

    // =========================================================================
    // 🔴 START FIX: MOST ACCURATE DEVICE SESSION LOGIC
    // =========================================================================
    let session: any = null;

    // 1. Highest priority: Find by the unique physical ID of the device
    if (deviceIdHeader) {
      session = await this.prisma.deviceSession.findFirst({
        where: {
          userId: user.id,
          deviceIdentifier: deviceIdHeader,
        }
      });
    }

    // 2. Fallback: For web browsers or old App versions that do not send ID
    if (!session) {
      session = await this.prisma.deviceSession.findFirst({
        where: {
          userId: user.id,
          deviceName: finalDeviceName,
          os: finalOsName,
        }
      });
    }

    if (session) {
      // IF EXISTS: Update to the latest state
      session = await this.prisma.deviceSession.update({
        where: { id: session.id },
        data: {
          lastActive: new Date(),
          ipAddress: ip,
          location: location,
          deviceIdentifier: deviceIdHeader || session.deviceIdentifier, // Sync ID to DB if old record does not have it
          deviceName: finalDeviceName,
          os: finalOsName // Always update OS in case they just updated iOS/Android
        }
      });
    } else {
      // IF NOT EXISTS: Check system capacity (Limit 10 sessions)
      const currentSessionsCount = await this.prisma.deviceSession.count({ where: { userId: user.id } });
      if (currentSessionsCount >= 10) {
        // Delete the oldest device if the limit is exceeded
        const oldestSession = await this.prisma.deviceSession.findFirst({
          where: { userId: user.id },
          orderBy: { lastActive: 'asc' }
        });
        if (oldestSession) {
          await this.prisma.deviceSession.delete({ where: { id: oldestSession.id } });
        }
      }

      // Create a new device on first login
      session = await this.prisma.deviceSession.create({
        data: {
          userId: user.id,
          deviceIdentifier: deviceIdHeader, // Save additional device ID to DB
          deviceName: finalDeviceName,
          deviceType: deviceType,
          os: finalOsName,
          ipAddress: ip,
          location: location,
        }
      });
    }
    // =========================================================================
    const expiresIn = rememberMe ? '30d' : '1d';
    const redisTtlSeconds = rememberMe ? (30 * 24 * 60 * 60) : (24 * 60 * 60);
    await this.redisService.set(`auth:session:${session.id}`, "active", redisTtlSeconds); // TTL equals JWT lifespan

    const payload = { userId: user.id, sessionId: session.id, email: user.email, role: user.role, shelterId: user.shelterId ?? undefined, };
    const accessToken = this.jwtService.sign(payload, { expiresIn });

    const isProfileComplete = !!(
      user.name &&
      user.name !== 'User' &&
      user.name !== user.email.split('@')[0] && // Exclude the case of default name taken from email
      user.phone &&
      user.gender &&
      user.gender !== 'UNKNOWN' &&
      user.dob &&
      user.avatarUrl
    );

    return {
      message: 'Login successful',
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, gender: user.gender, dob: user.dob, avatarUrl: user.avatarUrl, isTwoFactorEnabled: user.isTwoFactorEnabled, isProfileComplete, },
    };
  }
}