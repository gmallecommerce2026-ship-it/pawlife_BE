import { Module } from '@nestjs/common';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { DatabaseModule } from '../../database/database.module'; // Import DatabaseModule
import { BullModule } from '@nestjs/bullmq'; // Đảm bảo bạn dùng @nestjs/bullmq
import { SwipeProcessor } from './processors/swipe.processor';
import { PetNotesController } from './pet-notes.controller';
import { PetNotesService } from './pet-notes.service';
import { PublicPetsController } from './public-pets.controller';
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'swipe-queue',
    }),
  ],
  controllers: [PetsController, PetNotesController, PublicPetsController],
  providers: [PetsService, PetNotesService, SwipeProcessor],
  exports: [PetsService], // 🆕 thêm dòng này
})
export class PetsModule {}