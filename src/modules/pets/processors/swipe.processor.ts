// src/modules/pets/processors/swipe.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';

@Processor('swipe-queue')
export class SwipeProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // This function will automatically run in the Background
  async process(job: Job<any>) {
    const { userId, petId, action } = job.data;

    try {
      // Start writing to DB
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
      
      // You can log this for debugging (should be disabled in Production)
      // console.log(`[SwipeProcessor] Recorded ${action} by user ${userId} for pet ${petId}`);
    } catch (error) {
      console.error(`[SwipeProcessor] Error processing swipe userId: ${userId}, petId: ${petId}`, error);
      throw error; // Throw error so BullMQ knows this job failed and can retry
    }
  }
}