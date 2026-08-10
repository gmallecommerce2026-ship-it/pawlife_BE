import { Module } from '@nestjs/common';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { DatabaseModule } from '../../database/database.module'; // Import DatabaseModule
import { BullModule } from '@nestjs/bullmq'; // Đảm bảo bạn dùng @nestjs/bullmq
import { SwipeProcessor } from './processors/swipe.processor';
import { PetNotesController } from './pet-notes.controller';
import { PetNotesService } from './pet-notes.service';
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'swipe-queue',
    }),
  ],
  controllers: [PetsController, PetNotesController],
  providers: [PetsService, PetNotesService, SwipeProcessor],
  exports: [PetsService], // 🆕 thêm dòng này
})
export class PetsModule {}