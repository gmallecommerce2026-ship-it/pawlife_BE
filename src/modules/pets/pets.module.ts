import { Module } from '@nestjs/common';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { DatabaseModule } from '../../database/database.module'; // Import DatabaseModule
import { BullModule } from '@nestjs/bullmq'; // Đảm bảo bạn dùng @nestjs/bullmq
import { SwipeProcessor } from './processors/swipe.processor';
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'swipe-queue',
    }),
  ],
  controllers: [PetsController],
  providers: [PetsService, SwipeProcessor],
})
export class PetsModule {}