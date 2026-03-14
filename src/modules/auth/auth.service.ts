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
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private readonly mailerService: MailerService,
    private jwtService: JwtService,
    private readonly r2Service: R2Service,
    private readonly notificationsService: NotificationsService
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  async googleLogin(
    googleUserData: { email: string; name: string; picture?: string },
    userAgent: string, 
    ip: string, 
    deviceNameHeader?: string, 
    deviceOsHeader?: string
  ) {
    const { email, name, picture } = googleUserData;

    // Sử dụng upsert để: Nếu có thì update (hoặc bỏ qua), nếu chưa thì tạo mới
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {}, // Nếu đăng nhập lại, không ghi đè dữ liệu user đã sửa
      create: {
        email,
        name: name,
        avatarUrl: picture,
        provider: 'google',
      },
    });

    // SỬ DỤNG CHUNG HÀM TẠO PHIÊN VÀ TOKEN (Đồng bộ hoàn toàn với login thường)
    return await this.generateAuthResponse(
      user, 
      userAgent, 
      ip, 
      deviceNameHeader, 
      deviceOsHeader
    );
  }
  async verifyGoogleSignIn(idToken: string) {
    // 1. Verify token với Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    if (!payload || !payload.email) {
      throw new Error('Invalid Google Token');
    }

    const { email, name, picture } = payload;

    // 2. Tìm user trong hệ thống
    let user = await this.prisma.user.findUnique({ where: { email } });
    let isNewUser = false;

    // 3. Nếu user chưa tồn tại (Đăng nhập lần đầu)
    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          email: email,
          name: name, // Có thể dùng name làm default nickname
          avatarUrl: picture,
        },
      });
    }

    // 4. Tạo JWT Token của hệ thống
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      accessToken,
      user,
      isNewUser, // Trả về flag này để Frontend biết đường xử lý
    };
  }
  async getDevices(userId: string, currentSessionId?: string) {
    const devices = await this.prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { lastActive: 'desc' },
    });

    return devices.map(device => ({
      id: device.id,
      name: device.deviceName || 'Unknown Device',
      os: device.os || 'Unknown OS',
      location: device.location || 'Unknown Location',
      type: device.deviceType,
      isCurrentDevice: device.id === currentSessionId, // Dùng để FE hiện "Thiết bị này"
      // Format thời gian hiển thị thân thiện (có thể dùng date-fns hoặc moment)
      lastActive: device.lastActive.toISOString(), 
    }));
  }

  // --- ĐĂNG XUẤT 1 THIẾT BỊ ---
  async logoutDevice(userId: string, deviceId: string) {
    const device = await this.prisma.deviceSession.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.userId !== userId) {
      throw new BadRequestException('Thiết bị không tồn tại hoặc không thuộc quyền sở hữu của bạn.');
    }

    await this.prisma.deviceSession.delete({
      where: { id: deviceId },
    });

    // TODO: Nếu dùng Redis để chặn Token (Blacklist), bạn thêm logic xóa key redis tại đây
    return { success: true, message: 'Đã đăng xuất khỏi thiết bị.' };
  }
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    // 1. Lấy OTP từ Database
    const otpRecord = await this.prisma.otp.findUnique({
      where: {
        email_type: { email, type: OtpType.FORGOT_PASSWORD },
      },
    });

    // 2. Validate OTP
    if (!otpRecord) {
      throw new BadRequestException('Vui lòng gửi yêu cầu quên mật khẩu trước.');
    }
    if (otpRecord.otp !== otp) {
      throw new BadRequestException('Mã OTP không chính xác.');
    }
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('Mã OTP đã hết hạn.');
    }

    // 3. Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4. Cập nhật mật khẩu, xóa OTP trong 1 Transaction và LẤY THÔNG TIN USER
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      // Xóa OTP
      await tx.otp.delete({
        where: { id: otpRecord.id },
      });

      // Cập nhật user và return ra ngoài transaction
      return await tx.user.update({
        where: { email },
        data: {
          password: hashedPassword,
        },
      });
    });

    // 5. BẮN THÔNG BÁO BẢO MẬT SAU KHI ĐỔI MẬT KHẨU THÀNH CÔNG
    await this.notificationsService.createAndSendNotification({
      userId: updatedUser.id,
      title: '🔒 Đổi mật khẩu thành công',
      body: 'Mật khẩu tài khoản của bạn vừa được cập nhật. Nếu bạn không thực hiện việc này, vui lòng liên hệ với chúng tôi ngay lập tức.',
      type: NotificationType.SECURITY,
    });

    return { message: 'Mật khẩu đã được thay đổi thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' };
  }
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { currentPassword, newPassword } = dto;

    // 1. Tìm user trong database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại.');
    }

    // Nếu user đăng nhập bằng Google/Apple/FB thì có thể không có mật khẩu
    if (!user.password) {
      throw new BadRequestException('Tài khoản này đăng nhập bằng mạng xã hội, không thể đổi mật khẩu.');
    }

    // 2. Kiểm tra mật khẩu hiện tại xem có khớp không
    const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
    }

    // 3. Hash mật khẩu mới
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 4. Lưu mật khẩu mới vào database
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // 5. Bắn thông báo bảo mật cho user
    await this.notificationsService.createAndSendNotification({
      userId: user.id,
      title: '🔒 Cập nhật mật khẩu',
      body: 'Bạn vừa thay đổi mật khẩu thành công. Nếu không phải bạn thực hiện, vui lòng liên hệ hỗ trợ ngay.',
      type: NotificationType.SECURITY,
    });

    return { message: 'Mật khẩu của bạn đã được thay đổi thành công.' };
  }
  async sendOtp(dto: SendOtpDto) {
    const { email, type } = dto;
    
    // Nếu là Forgot Password, phải check user có tồn tại không
    if (type === OtpType.FORGOT_PASSWORD) {
      const userExists = await this.prisma.user.findUnique({ where: { email } });
      if (!userExists) throw new BadRequestException('Email không tồn tại trong hệ thống');
    }

    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Hết hạn sau 5 phút

    // Lưu/Cập nhật OTP trong Database
    await this.prisma.otp.upsert({
      where: {
        email_type: { email, type },
      },
      update: {
        otp,
        expiresAt,
      },
      create: {
        email,
        otp,
        type,
        expiresAt,
      },
    });

    // Xác định tiêu đề và nội dung email dựa trên Type
    const isSignUp = type === OtpType.SIGNUP;
    const subject = isSignUp ? 'Mã xác nhận đăng ký tài khoản' : 'Mã xác nhận khôi phục mật khẩu';
    
    // GỬI EMAIL THỰC TẾ QUA DỊCH VỤ
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: subject,
        text: `Mã OTP của bạn là: ${otp}. Mã này sẽ hết hạn sau 5 phút.`, // Chữ thuần cho các email client không hỗ trợ HTML
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #f97316;">${isSignUp ? 'Chào mừng bạn!' : 'Yêu cầu đặt lại mật khẩu'}</h2>
            <p>Bạn đã yêu cầu một mã OTP để ${isSignUp ? 'đăng ký tài khoản' : 'khôi phục mật khẩu'}.</p>
            <p>Mã xác nhận của bạn là:</p>
            <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 10px 20px; display: inline-block; border-radius: 8px; letter-spacing: 2px;">
              ${otp}
            </div>
            <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">* Lưu ý: Mã này sẽ hết hạn sau 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
          </div>
        `,
      });
    } catch (error) {
      // Bắt lỗi nếu cấu hình SMTP sai hoặc dịch vụ email lỗi
      console.error('Lỗi gửi email:', error);
      throw new BadRequestException('Hệ thống không thể gửi email lúc này. Vui lòng thử lại sau.');
    }

    return { message: 'Mã OTP đã được gửi đến email của bạn.' };
  }

  // --- LUỒNG ĐĂNG KÝ TRUYỀN THỐNG ---
  async register(dto: RegisterDto) {
    const { email, otp, password, name, phone, gender, dob, avatarUrl } = dto;

    // 1. Lấy OTP từ Database
    const otpRecord = await this.prisma.otp.findUnique({
      where: {
        email_type: { email, type: OtpType.SIGNUP },
      },
    });

    const existingUser = await this.prisma.user.findUnique({
      where: { email: email }, // Thay data.email bằng biến chứa email của bạn
    });

    if (existingUser) {
      throw new ConflictException('Địa chỉ email này đã được sử dụng!');
    }

    // 2. Validate OTP
    if (!otpRecord) {
      throw new BadRequestException('Vui lòng gửi mã OTP trước khi đăng ký');
    }
    if (otpRecord.otp !== otp) {
      throw new BadRequestException('Mã OTP không chính xác');
    }
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('Mã OTP đã hết hạn');
    }

    // 3. Nếu hợp lệ, hash password và tạo User trong 1 Transaction
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await this.prisma.$transaction(async (tx) => {
      // Xóa OTP để tránh tái sử dụng
      await tx.otp.delete({
        where: { id: otpRecord.id },
      });

      // Tạo user mới
      return await tx.user.create({
        data: {
          email,
          password: hashedPassword, // Thay bằng hashedPassword thực tế
          name,
          phone,
          gender,
          dob,
          avatarUrl,
        },
      });
    });

    await this.notificationsService.createAndSendNotification({
      userId: newUser.id,
      title: '🎉 Chào mừng đến với PawLife',
      body: 'Tài khoản của bạn đã được bảo mật thành công. Hãy bắt đầu hành trình cùng thú cưng nhé!',
      type: NotificationType.SECURITY,
    });
    return { message: 'Đăng ký thành công', user: newUser };
  }
  
  // --- TẠO MÃ BÍ MẬT & QR CODE ---
  async generateTwoFactorAuthenticationSecret(userId: string, email: string) {
    const secret = speakeasy.generateSecret({
      name: `PawLife (${email})`,
    });
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    // 1. KIỂM TRA XEM URL CÓ ĐƯỢC SINH RA KHÔNG
    if (!secret.otpauth_url) {
      throw new InternalServerErrorException('Lỗi hệ thống: Không thể tạo URL cho 2FA.');
    }

    // 2. TYPESCRIPT SẼ KHÔNG CÒN BÁO LỖI Ở ĐÂY NỮA
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    
    return { 
      secret: secret.base32, 
      qrCodeUrl: qrCodeDataUrl 
    };
  }

  // --- BẬT 2FA ---
  async turnOnTwoFactorAuthentication(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new BadRequestException('Chưa tạo mã bí mật 2FA.');

    const isCodeValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1, // FIX: Bổ sung window để tránh lỗi lệch thời gian
    });

    if (!isCodeValid) throw new BadRequestException('Mã 2FA không chính xác.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });

    return { message: 'Đã bật xác thực 2 bước thành công.' };
  }

  // --- TẮT 2FA ---
  async turnOffTwoFactorAuthentication(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: false, twoFactorSecret: null },
    });
    return { message: 'Đã tắt xác thực 2 bước.' };
  }

  // --- LUỒNG ĐĂNG NHẬP TRUYỀN THỐNG ---
  async login(
    dto: LoginDto, 
    userAgent: string, 
    ip: string, 
    deviceNameHeader?: string,
    deviceOsHeader?: string
  ) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.password) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.');
    }

    const isPasswordMatch = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.');
    }

    // NẾU USER ĐÃ BẬT 2FA -> Trả về token tạm thời
    if (user.isTwoFactorEnabled) {
      const tempToken = this.jwtService.sign(
        { userId: user.id, is2FAPending: true },
        { expiresIn: '5m' } // Token tạm chỉ sống 5 phút
      );
      return {
        requires2FA: true,
        tempToken,
        message: 'Vui lòng nhập mã Authenticator để tiếp tục.',
      };
    }

    return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader);
  }
  async loginWith2fa(
    tempToken: string, 
    code: string, 
    userAgent: string, 
    ip: string,
    deviceNameHeader?: string,
    deviceOsHeader?: string
  ) {
    let decoded;
    try {
      decoded = this.jwtService.verify(tempToken);
    } catch (error) {
      throw new UnauthorizedException('Phiên đăng nhập 2FA đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (!decoded.is2FAPending) throw new UnauthorizedException('Token không hợp lệ.');

    const user = await this.prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại.');

    // THÊM DÒNG KIỂM TRA NÀY VÀO ĐÂY ĐỂ FIX LỖI TYPE
    if (!user.twoFactorSecret) {
      throw new UnauthorizedException('Tài khoản này chưa cài đặt mã bảo mật 2FA.');
    }

    // Lúc này TypeScript đã tự động hiểu user.twoFactorSecret là 'string' 
    // thay vì 'string | null' nên sẽ không báo lỗi nữa.
    const isCodeValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret, 
      encoding: 'base32',
      token: code,
      window: 1, 
    });

    if (!isCodeValid) throw new UnauthorizedException('Mã 2FA không chính xác.');

    return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader);
  }

  async deleteAccount(userId: string) {
    try {
      // 1. Lấy thông tin user hiện tại và các liên kết cần xóa (ví dụ: avatar)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) return { success: true };

      // 2. Xóa hình ảnh trên Storage (Cloudflare R2 / S3) để tiết kiệm dung lượng
      if (user.avatarUrl) {
        // Giả sử hàm extractKey lấy ra key file từ URL
        const fileKey = this.extractFileKey(user.avatarUrl); 
        await this.r2Service.deleteFile(fileKey);
      }

      // 3. Xử lý Database trong một Transaction để đảm bảo an toàn
      await this.prisma.$transaction(async (tx) => {
        const deletedEmail = `deleted_${Date.now()}_${user.email}`;

        // Cập nhật thông tin user: Giải phóng email, ẩn danh thông tin, đánh dấu xóa
        await tx.user.update({
          where: { id: userId },
          data: {
            email: deletedEmail, 
            password: '', 
            avatarUrl: null, // khớp với avatarUrl trong model
            name: 'Deleted User',
            phone: null,
            isDeleted: true,       // Đánh dấu là đã xóa
            deletedAt: new Date(), // Ghi lại thời điểm xóa
          },
        });
      });

      // 4. Xóa toàn bộ Cache & Session trên Redis
      // Đảm bảo user bị văng khỏi tất cả các thiết bị đang đăng nhập
      // const sessionKey = `user_session:${userId}`;
      // await this.redis.del(sessionKey);
      
      // Blacklist token hiện tại nếu dùng JWT stateless (lưu jti vào redis)
      
      return { success: true, message: 'Tài khoản đã được xóa vĩnh viễn.' };
    } catch (error) {
      throw new InternalServerErrorException('Không thể xóa tài khoản lúc này');
    }
  }

  private extractFileKey(url: string): string {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Cắt bỏ '/' ở đầu
  }

  // --- LUỒNG ĐĂNG NHẬP SOCIAL ---
  async socialLogin(
    dto: SocialLoginDto, 
    userAgent: string, 
    ip: string,
    deviceNameHeader?: string,
    deviceOsHeader?: string
  ) {
    let email: string;
    let name: string = 'User';
    let picture: string | null = null; // 1. Thêm biến hứng avatar
    
    try {
      switch (dto.provider) {
        case 'GOOGLE': {
          const ticket = await this.googleClient.verifyIdToken({
            idToken: dto.token,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          
          if (!payload || !payload.email) {
            throw new BadRequestException('Google token không hợp lệ.');
          }

          email = payload.email;
          name = payload.name || 'Google User';
          picture = payload.picture || null; // 2. Lấy avatar từ Google
          break;
        }

        case 'FACEBOOK': {
          const { data } = await axios.get(
            `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${dto.token}`,
          );
          if (!data || !data.email) throw new BadRequestException('Facebook không trả về email.');
          
          email = data.email;
          name = data.name || 'Facebook User';
          picture = data.picture?.data?.url || null; // Lấy avatar từ FB nếu có
          break;
        }

        case 'APPLE': {
          // Apple thường chỉ gửi email/name ở lần đăng nhập đầu tiên
          const payload = await appleSignin.verifyIdToken(dto.token, {
            audience: process.env.APPLE_CLIENT_ID,
            ignoreExpiration: true, 
          });
          if (!payload || typeof payload.email !== 'string') throw new BadRequestException('Apple token lỗi.');
          email = payload.email;
          break;
        }

        default:
          throw new BadRequestException('Provider không được hỗ trợ.');
      }
    } catch (error) {
      throw new UnauthorizedException('Token mạng xã hội không hợp lệ hoặc đã hết hạn.');
    }

    // 3. Tìm hoặc tạo user mới với dữ liệu lấy được
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          avatarUrl: picture, // Tự động set avatar
          // gender và dob tạm thời để null, user sẽ cập nhật sau
        },
      });
    } else {
      // (Tùy chọn) Nếu user đã tồn tại nhưng chưa có avatar/name, bạn có thể update thêm ở đây
      if (!user.avatarUrl && picture) {
         user = await this.prisma.user.update({
             where: { email },
             data: { avatarUrl: picture, name: user.name === 'User' ? name : user.name }
         });
      }
    }

    return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader);
  }

  // --- HÀM HELPER TẠO TOKEN ---
  // --- HÀM HELPER TẠO TOKEN & LƯU PHIÊN THIẾT BỊ ---
  private async generateAuthResponse(
    user: any, 
    userAgent: string, 
    ip: string, 
    deviceNameHeader?: string, 
    deviceOsHeader?: string
  ) {
    const parser = new UAParser(userAgent);
    const os = parser.getOS();
    const device = parser.getDevice();
    
    let deviceType = 'smartphone';
    // Logic xác định tablet/laptop của bạn giữ nguyên...
    if (device.type === 'tablet') deviceType = 'tablet';
    if (!device.type && (os.name === 'Mac OS' || os.name === 'Windows' || os.name === 'Linux' || os.name === 'Ubuntu')) {
      deviceType = 'laptop';
    }

    // XỬ LÝ VỊ TRÍ (LOCATION)
    // Lưu ý: Nếu IP là ::1 hoặc 192.168.x.x thì geoip sẽ luôn trả về null. 
    // Khi deploy lên server thật có IP Public thì nó mới hoạt động.
    const geo = geoip.lookup(ip);
    const location = geo ? `${geo.city || ''}, ${geo.country || ''}`.replace(/^, |, $/g, '') || 'Unknown Location' : 'Unknown Location';

    // XỬ LÝ TÊN THIẾT BỊ
    // Ưu tiên lấy từ header do React Native gửi lên. Nếu không có (ví dụ login từ Web), fallback về ua-parser
    const deviceName = deviceNameHeader || device.model || os.name || 'Unknown Device';
    const finalOsName = deviceOsHeader || `${os.name || ''} ${os.version || ''}`.trim() || 'Unknown OS';

    const session = await this.prisma.deviceSession.create({
      data: {
        userId: user.id,
        deviceName: deviceName, // Sẽ lưu "Ân - Hà Nội" hoặc "iPhone 14 Pro"
        deviceType: deviceType,
        os: finalOsName,        // Sẽ lưu "ios 16.0"
        ipAddress: ip,
        location: location,
      }
    });

    const payload = { userId: user.id, sessionId: session.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Đăng nhập thành công',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        gender: user.gender, 
        dob: user.dob,       
        avatarUrl: user.avatarUrl, 
        isTwoFactorEnabled: user.isTwoFactorEnabled, 
      },
    };
  }
}