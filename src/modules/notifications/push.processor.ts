import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';

@Processor('push') // Lắng nghe hàng đợi tên 'push'
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(private readonly pushNotificationService: PushNotificationService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'send-push') {
      try {
        await this.pushNotificationService.sendToUser(job.data);
        this.logger.log(`✅ Đã gửi push notification cho user: ${job.data.userId}`);
      } catch (error) {
        this.logger.error(`❌ Lỗi gửi push cho user ${job.data.userId}:`, error);
        throw error; // Để BullMQ tự động retry
      }
    }
  }
}