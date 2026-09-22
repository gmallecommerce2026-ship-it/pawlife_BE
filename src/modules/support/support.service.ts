// src/modules/support/support.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ContactTarget, SendContactMessageDto } from './dto/support.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectQueue('mail') private readonly mailQueue: Queue,
  ) {}

  async sendContactMessage(dto: SendContactMessageDto) {
    const { name, email, subject, message, target } = dto;

    const toEmail =
      target === ContactTarget.ADMIN
        ? process.env.ADMIN_CONTACT_EMAIL
        : process.env.DEVELOPER_CONTACT_EMAIL;

    if (!toEmail) {
      throw new InternalServerErrorException(
        'Chưa cấu hình email nhận tin nhắn cho mục tiêu này.',
      );
    }

    await this.mailQueue.add(
      'send-contact-message', // ✅ đúng job.name mà processor đang bắt
      { toEmail, name, email, subject, message, target },
      {
        removeOnComplete: true,
        attempts: 3,
      },
    );

    return { message: 'Tin nhắn của bạn đang được gửi đi.' };
  }
}