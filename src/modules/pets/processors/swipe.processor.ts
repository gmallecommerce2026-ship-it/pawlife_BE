// src/modules/pets/processors/swipe.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';

@Processor('swipe-queue')
export class SwipeProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // Hàm này sẽ tự động chạy ngầm ở Background
  async process(job: Job<any>) {
    const { userId, petId, action } = job.data;

    try {
      // Bắt đầu ghi xuống DB
      await this.prisma.petInteraction.upsert({
        where: {
          userId_petId: { userId, petId },
        },
        update: {
          action: action,
        },
        create: {
          userId: userId,
          petId: petId,
          action: action,
        },
      });
      
      // Bạn có thể log ra để debug (nên tắt khi lên Production)
      // console.log(`[SwipeProcessor] Đã ghi nhận ${action} của user ${userId} cho pet ${petId}`);
    } catch (error) {
      console.error(`[SwipeProcessor] Lỗi khi xử lý swipe userId: ${userId}, petId: ${petId}`, error);
      throw error; // Ném lỗi để BullMQ biết job này thất bại và có thể retry
    }
  }
}