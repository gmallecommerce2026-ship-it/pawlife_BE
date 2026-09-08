import { Module } from '@nestjs/common';
import { PetHotelController } from './pet-hotel.controller';
import { PetHotelService } from './pet-hotel.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PetHotelController],
  providers: [PetHotelService],
  exports: [PetHotelService],
})
export class PetHotelModule {}