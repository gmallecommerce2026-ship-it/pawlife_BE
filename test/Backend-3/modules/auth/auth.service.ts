// src/modules/auth/auth.service.ts
import { Injectable, BadRequestException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegisterDto, LoginDto, SocialLoginDto, SendOtpDto, OtpType } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import appleSignin from 'apple-signin-auth';
import { MailerService } from '@nestjs-modules/mailer';
import { R2Service } from '../storage/r2.service';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private readonly mailerService: MailerService,
    private jwtService: JwtService,
    private readonly r2Service: R2Service,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

    return { message: 'Đăng ký thành công', user: newUser };
  }

  // --- LUỒNG ĐĂNG NHẬP TRUYỀN THỐNG ---
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Nếu user đăng nhập bằng social thì có thể không có password
    if (!user || !user.password) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.');
    }

    const isPasswordMatch = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.');
    }

    return this.generateAuthResponse(user);
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
  async socialLogin(dto: SocialLoginDto) {
    let email: string;
    let name: string = 'User';
    try {
      switch (dto.provider) {
        case 'GOOGLE': {
          const ticket = await this.googleClient.verifyIdToken({
            idToken: dto.token,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          
          // SỬA LỖI TS: Kiểm tra payload và email trước khi gán
          if (!payload) {
            throw new BadRequestException('Google token payload rỗng.');
          }
          if (!payload.email) {
            throw new BadRequestException('Google token không chứa email.');
          }

          email = payload.email; // TypeScript giờ đã biết email chắc chắn là string
          name = payload.name || 'Google User';
          break;
        }

        case 'FACEBOOK': {
          const { data } = await axios.get(
            `https://graph.facebook.com/me?fields=id,name,email&access_token=${dto.token}`,
          );
          if (!data || !data.email) {
            throw new BadRequestException('Facebook không trả về email.');
          }
          
          email = data.email;
          name = data.name || 'Facebook User';
          break;
        }

        case 'APPLE': {
          const payload = await appleSignin.verifyIdToken(dto.token, {
            audience: process.env.APPLE_CLIENT_ID,
            ignoreExpiration: true, 
          });

          // SỬA LỖI TS: Ép kiểu hoặc kiểm tra email từ Apple
          if (!payload || typeof payload.email !== 'string') {
            throw new BadRequestException('Apple token không chứa email hợp lệ.');
          }

          email = payload.email;
          break;
        }

        default:
          throw new BadRequestException('Provider không được hỗ trợ.');
      }
    } catch (error) {
      console.error(`[SocialLogin] Error verifying ${dto.provider} token:`, error);
      // Ném lỗi cụ thể ra ngoài nếu có, thay vì gộp chung
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException('Token mạng xã hội không hợp lệ hoặc đã hết hạn.');
    }

    // Double check một lần nữa cho an toàn
    if (!email) {
      throw new BadRequestException('Không thể lấy được thông tin email từ nền tảng này.');
    }

    // Kiểm tra user đã tồn tại chưa (Upsert logic)
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name
        },
      });
    }

    return this.generateAuthResponse(user);
  }

  // --- HÀM HELPER TẠO TOKEN ---
  private generateAuthResponse(user: any) {
    const payload = { userId: user.id };
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
      },
    };
  }
}