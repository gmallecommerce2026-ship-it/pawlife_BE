// src/modules/auth/mail.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';

@Processor('mail') // Listen to the queue named 'mail'
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  // This function is automatically triggered when AuthService pushes a Job to the queue
  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'send-otp') {
      const { email, subject, otp, isSignUp } = job.data;
      this.logger.log(`Sending OTP email to: ${email}`);

      try {
        await this.mailerService.sendMail({
          to: email,
          subject: subject,
          text: `Your OTP code is: ${otp}. This code will expire in 5 minutes.`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #f97316;">${isSignUp ? 'Welcome!' : 'Password reset request'}</h2>
              <p>You have requested an OTP code to ${isSignUp ? 'register an account' : 'recover your password'}.</p>
              <p>Your verification code is:</p>
              <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 10px 20px; display: inline-block; border-radius: 8px; letter-spacing: 2px;">
                ${otp}
              </div>
              <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">* Note: This code will expire in 5 minutes. Please do not share this code with anyone.</p>
            </div>
          `,
        });
        this.logger.log(`✅ Successfully sent email to: ${email}`);
      } catch (error) {
        this.logger.error(`❌ Error sending email to ${email}:`, error);
        throw error; // Throw error so BullMQ can automatically retry
      }
    } else if (job.name === 'send-contact-message') {
      // ✅ THÊM MỚI: xử lý tin nhắn liên hệ gửi Admin/Developer
      const { toEmail, name, email, subject, message, target } = job.data;
      this.logger.log(`Sending contact message (${target}) from ${email} to ${toEmail}`);

      try {
        await this.mailerService.sendMail({
          to: toEmail,
          replyTo: email, // để Admin/Dev bấm Reply là trả lời thẳng cho người gửi
          subject: `[Liên hệ - ${target === 'ADMIN' ? 'Admin' : 'Developer'}] ${subject}`,
          text: `Người gửi: ${name} (${email})\nTiêu đề: ${subject}\n\n${message}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #f97316;">Tin nhắn liên hệ mới (${target === 'ADMIN' ? 'Admin' : 'Developer'})</h2>
              <p><b>Họ tên:</b> ${name}</p>
              <p><b>Email:</b> ${email}</p>
              <p><b>Tiêu đề:</b> ${subject}</p>
              <div style="margin-top: 16px; padding: 14px 18px; background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
                <p style="white-space: pre-wrap; margin: 0; line-height: 1.6;">${message}</p>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">* Bấm "Reply" để trả lời trực tiếp cho người gửi.</p>
            </div>
          `,
        });
        this.logger.log(`✅ Successfully sent contact message to: ${toEmail}`);
      } catch (error) {
        this.logger.error(`❌ Error sending contact message to ${toEmail}:`, error);
        throw error; // Throw error để BullMQ tự động retry
      }
    }
  }
}