// src/modules/auth/auth.service.ts
import { Injectable, BadRequestException, UnauthorizedException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegisterDto, LoginDto, SocialLoginDto, SendOtpDto, OtpType, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
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
import { InjectQueue } from '@nestjs/bullmq'; // <-- BỔ SUNG
import { Queue } from 'bullmq'; // <-- BỔ SUNG

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
    @InjectQueue('mail') private readonly mailQueue: Queue // <-- BỔ SUNG
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // =======================================================
  // HÀM ĐÃ NÂNG CẤP: DÙNG BULLMQ CHẠY NGẦM GỬI EMAIL OTP
  // =======================================================
  async sendOtp(dto: SendOtpDto) {
    const { email, type } = dto;
    
    if (type === OtpType.FORGOT_PASSWORD) {
      const userExists = await this.prisma.user.findUnique({ where: { email } });
      if (!userExists) throw new BadRequestException('Email không tồn tại trong hệ thống');
    }

    const otp = this.generateOTP();
    const redisKey = `auth:otp:${type}:${email}`; // Tạo key duy nhất cho redis

    // 1. Lưu OTP vào Redis với TTL là 300 giây (5 phút)
    await this.redisService.set(redisKey, { otp }, 300);

    const isSignUp = type === OtpType.SIGNUP;
    const subject = isSignUp ? 'Mã xác nhận đăng ký tài khoản' : 'Mã xác nhận khôi phục mật khẩu';
    
    // 2. NÉM CÔNG VIỆC VÀO BACKGROUND JOB
    // Server sẽ đẩy đi ngay lập tức (1ms) mà không cần đợi MailerService chạy xong
    await this.mailQueue.add(
      'send-otp', // Tên job
      { email, subject, otp, isSignUp }, // Payload dữ liệu
      {
        removeOnComplete: true, // Chạy xong xóa khỏi RAM
        attempts: 3, // Thử gửi lại 3 lần nếu Google SMTP bị lỗi mạng
      }
    );

    // 3. Trả về thành công cho điện thoại ngay lập tức
    return { message: 'Mã OTP đang được gửi đến email của bạn.' };
  }

  // =======================================================
  // TOÀN BỘ CÁC HÀM BÊN DƯỚI GIỮ NGUYÊN HOÀN TOÀN
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

  async getDevices(userId: string, currentSessionId?: string) {
    const devices = await this.prisma.deviceSession.findMany({ where: { userId }, orderBy: { lastActive: 'desc' }, });
    return devices.map(device => ({ id: device.id, name: device.deviceName || 'Unknown Device', os: device.os || 'Unknown OS', location: device.location || 'Unknown Location', type: device.deviceType, isCurrentDevice: device.id === currentSessionId, lastActive: device.lastActive.toISOString(), }));
  }

  async logoutDevice(userId: string, deviceId: string) {
    const device = await this.prisma.deviceSession.findUnique({ where: { id: deviceId }, });
    if (!device || device.userId !== userId) throw new BadRequestException('Thiết bị không tồn tại hoặc không thuộc quyền sở hữu của bạn.');
    await this.prisma.deviceSession.delete({ where: { id: deviceId }, });
    return { success: true, message: 'Đã đăng xuất khỏi thiết bị.' };
  }

  private generateOTP(): string { return Math.floor(100000 + Math.random() * 900000).toString(); }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { currentPassword, newPassword } = dto;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại.');
    if (!user.password) throw new BadRequestException('Tài khoản này đăng nhập bằng mạng xã hội, không thể đổi mật khẩu.');
    const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordMatch) throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashedNewPassword }, });
    await this.notificationsService.createAndSendNotification({ userId: user.id, title: '🔒 Cập nhật mật khẩu', body: 'Bạn vừa thay đổi mật khẩu thành công. Nếu không phải bạn thực hiện, vui lòng liên hệ hỗ trợ ngay.', type: NotificationType.SECURITY, });
    await this.redisService.del(`auth:user_profile:${userId}`);
    return { message: 'Mật khẩu của bạn đã được thay đổi thành công.' };
  }

  async register(dto: RegisterDto) {
    const { email, otp, password, name, phone, gender, dob, avatarUrl } = dto;
    const existingUser = await this.prisma.user.findUnique({ where: { email: email } });
    if (existingUser) throw new ConflictException('Địa chỉ email này đã được sử dụng!');
    const redisKey = `auth:otp:${OtpType.SIGNUP}:${email}`;
    const otpRecord = await this.redisService.get<{ otp: string }>(redisKey);
    if (!otpRecord) throw new BadRequestException('Vui lòng gửi mã OTP trước khi đăng ký hoặc mã đã hết hạn');
    if (otpRecord.otp !== otp) throw new BadRequestException('Mã OTP không chính xác');
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await this.prisma.$transaction(async (tx) => {
      return await tx.user.create({ data: { email, password: hashedPassword, name, phone, gender, dob, avatarUrl, }, });
    });
    await this.redisService.del(redisKey);
    await this.notificationsService.createAndSendNotification({ userId: newUser.id, title: '🎉 Chào mừng đến với PawLife', body: 'Tài khoản của bạn đã được bảo mật thành công. Hãy bắt đầu hành trình cùng thú cưng nhé!', type: NotificationType.SECURITY, });
    return { message: 'Đăng ký thành công', user: newUser };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;
    const redisKey = `auth:otp:${OtpType.FORGOT_PASSWORD}:${email}`;
    const otpRecord = await this.redisService.get<{ otp: string }>(redisKey);
    
    if (!otpRecord) throw new BadRequestException('Vui lòng gửi yêu cầu quên mật khẩu trước hoặc mã đã hết hạn.');
    if (otpRecord.otp !== otp) throw new BadRequestException('Mã OTP không chính xác.');
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await this.prisma.$transaction(async (tx) => { 
      return await tx.user.update({ 
        where: { email }, 
        data: { password: hashedPassword }, 
      }); 
    });
    
    // 1. Xóa OTP đã sử dụng
    await this.redisService.del(redisKey);
    
    // =========================================================================
    // 2. BỔ SUNG: XÓA CACHE USER PROFILE ĐỂ VÔ HIỆU HÓA JWT TOKEN CŨ
    // =========================================================================
    await this.redisService.del(`auth:user_profile:${updatedUser.id}`);
    
    // 3. Gửi thông báo
    await this.notificationsService.createAndSendNotification({ 
      userId: updatedUser.id, 
      title: '🔒 Đổi mật khẩu thành công', 
      body: 'Mật khẩu tài khoản của bạn vừa được cập nhật. Nếu bạn không thực hiện việc này, vui lòng liên hệ với chúng tôi ngay lập tức.', 
      type: NotificationType.SECURITY, 
    });
    
    return { message: 'Mật khẩu đã được thay đổi thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' };
  }
  
  async generateTwoFactorAuthenticationSecret(userId: string, email: string) {
    const secret = speakeasy.generateSecret({ name: `PawLife (${email})`, });
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret.base32 }, });
    if (!secret.otpauth_url) throw new InternalServerErrorException('Lỗi hệ thống: Không thể tạo URL cho 2FA.');
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    return { secret: secret.base32, qrCodeUrl: qrCodeDataUrl };
  }

  async turnOnTwoFactorAuthentication(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new BadRequestException('Chưa tạo mã bí mật 2FA.');
    const isCodeValid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1, });
    if (!isCodeValid) throw new BadRequestException('Mã 2FA không chính xác.');
    await this.prisma.user.update({ where: { id: userId }, data: { isTwoFactorEnabled: true }, });
    return { message: 'Đã bật xác thực 2 bước thành công.' };
  }

  async turnOffTwoFactorAuthentication(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { isTwoFactorEnabled: false, twoFactorSecret: null }, });
    return { message: 'Đã tắt xác thực 2 bước.' };
  }

  async login(dto: LoginDto, userAgent: string, ip: string, deviceNameHeader?: string, deviceOsHeader?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.password) throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.');
    const isPasswordMatch = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordMatch) throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.');
    if (user.isTwoFactorEnabled) {
      const tempToken = this.jwtService.sign({ userId: user.id, is2FAPending: true }, { expiresIn: '5m' });
      return { requires2FA: true, tempToken, message: 'Vui lòng nhập mã Authenticator để tiếp tục.', };
    }
    return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader);
  }

  async loginWith2fa(tempToken: string, code: string, userAgent: string, ip: string, deviceNameHeader?: string, deviceOsHeader?: string) {
    let decoded;
    try { decoded = this.jwtService.verify(tempToken); } catch (error) { throw new UnauthorizedException('Phiên đăng nhập 2FA đã hết hạn. Vui lòng đăng nhập lại.'); }
    if (!decoded.is2FAPending) throw new UnauthorizedException('Token không hợp lệ.');
    const user = await this.prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại.');
    if (!user.twoFactorSecret) throw new UnauthorizedException('Tài khoản này chưa cài đặt mã bảo mật 2FA.');
    const isCodeValid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1, });
    if (!isCodeValid) throw new UnauthorizedException('Mã 2FA không chính xác.');
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
      return { success: true, message: 'Tài khoản đã được xóa vĩnh viễn.' };
    } catch (error) { throw new InternalServerErrorException('Không thể xóa tài khoản lúc này'); }
  }

  private extractFileKey(url: string): string { const urlObj = new URL(url); return urlObj.pathname.substring(1); }

  async socialLogin(dto: SocialLoginDto, userAgent: string, ip: string, deviceNameHeader?: string, deviceOsHeader?: string) {
    let email: string; let name: string = dto.name || ''; let picture: string | null = null; let gender: string | null = dto.gender || null; let dob: Date | null = dto.dob ? new Date(dto.dob) : null;
    try {
      switch (dto.provider) {
        case 'GOOGLE': {
          const ticket = await this.googleClient.verifyIdToken({ idToken: dto.token, audience: process.env.GOOGLE_CLIENT_ID, });
          const payload = ticket.getPayload();
          if (!payload || !payload.email) throw new BadRequestException('Google token không hợp lệ.');
          email = payload.email; if (!name) name = payload.name || email.split('@')[0]; picture = payload.picture || null; break;
        }
        case 'FACEBOOK': {
          const { data } = await axios.get(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large),gender,birthday&access_token=${dto.token}`);
          if (!data || !data.email) throw new BadRequestException('Facebook không trả về email.');
          email = data.email; if (!name) name = data.name || email.split('@')[0]; picture = data.picture?.data?.url || null;
          if (!gender && data.gender) gender = data.gender; if (!dob && data.birthday) dob = new Date(data.birthday); break;
        }
        case 'APPLE': {
          const payload = await appleSignin.verifyIdToken(dto.token, { audience: process.env.APPLE_CLIENT_ID, ignoreExpiration: true, });
          if (!payload || typeof payload.email !== 'string') throw new BadRequestException('Apple token lỗi.');
          email = payload.email; if (!name) name = email.split('@')[0]; break;
        }
        default: throw new BadRequestException('Provider không được hỗ trợ.');
      }
    } catch (error) { throw new UnauthorizedException('Token mạng xã hội không hợp lệ hoặc đã hết hạn.'); }

    let user = await this.prisma.user.findUnique({ where: { email }, });
    if (!user) {
      user = await this.prisma.user.create({ data: { email, name, avatarUrl: picture, gender: gender, dob: dob, }, });
    } else {
      const updateData: any = {};
      if (!user.name || user.name === 'User') updateData.name = name;
      if (!user.avatarUrl && picture) updateData.avatarUrl = picture;
      if (!user.gender && gender) updateData.gender = gender;
      if (!user.dob && dob) updateData.dob = dob;
      if (Object.keys(updateData).length > 0) { user = await this.prisma.user.update({ where: { email }, data: updateData }); }
    }
    return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader);
  }

  private async generateAuthResponse(user: any, userAgent: string, ip: string, deviceNameHeader?: string, deviceOsHeader?: string) {
    let updatedData: any = {}; let needsUpdate = false;
    if (!user.name || user.name.trim() === '' || user.name === 'User') { updatedData.name = user.email.split('@')[0]; user.name = updatedData.name; needsUpdate = true; }
    if (!user.gender) { updatedData.gender = 'UNKNOWN'; user.gender = updatedData.gender; needsUpdate = true; }
    if (needsUpdate) { await this.prisma.user.update({ where: { id: user.id }, data: updatedData, }); }

    const parser = new UAParser(userAgent); const os = parser.getOS(); const device = parser.getDevice();
    let deviceType = 'smartphone';
    if (device.type === 'tablet') deviceType = 'tablet';
    if (!device.type && (os.name === 'Mac OS' || os.name === 'Windows' || os.name === 'Linux' || os.name === 'Ubuntu')) { deviceType = 'laptop'; }
    const geo = geoip.lookup(ip);
    const location = geo ? `${geo.city || ''}, ${geo.country || ''}`.replace(/^, |, $/g, '') || 'Unknown Location' : 'Unknown Location';
    const deviceName = deviceNameHeader || device.model || os.name || 'Unknown Device';
    const finalOsName = deviceOsHeader || `${os.name || ''} ${os.version || ''}`.trim() || 'Unknown OS';
    const session = await this.prisma.deviceSession.create({ data: { userId: user.id, deviceName: deviceName, deviceType: deviceType, os: finalOsName, ipAddress: ip, location: location, } });
    const payload = { userId: user.id, sessionId: session.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Đăng nhập thành công',
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, gender: user.gender, dob: user.dob, avatarUrl: user.avatarUrl, isTwoFactorEnabled: user.isTwoFactorEnabled, },
    };
  }
}