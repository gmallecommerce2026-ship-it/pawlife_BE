// src/modules/auth/mail.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';

@Processor('mail') // Lắng nghe hàng đợi tên là 'mail'
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  // Hàm này tự động kích hoạt khi AuthService ném Job vào hàng đợi
  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'send-otp') {
      const { email, subject, otp, isSignUp } = job.data;
      this.logger.log(`Đang gửi email OTP tới: ${email}`);

      try {
        await this.mailerService.sendMail({
          to: email,
          subject: subject,
          text: `Mã OTP của bạn là: ${otp}. Mã này sẽ hết hạn sau 5 phút.`,
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
        this.logger.log(`✅ Đã gửi email thành công tới: ${email}`);
      } catch (error) {
        this.logger.error(`❌ Lỗi gửi email tới ${email}:`, error);
        throw error; // Ném lỗi để BullMQ tự động gửi lại (retry)
      }
    }
  }
}