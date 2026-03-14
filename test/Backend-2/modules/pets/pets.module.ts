import { Module } from '@nestjs/common';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { DatabaseModule } from '../../database/database.module'; // Import DatabaseModule

@Module({
  imports: [DatabaseModule], 
  controllers: [PetsController],
  providers: [PetsService],
})
export class PetsModule {}