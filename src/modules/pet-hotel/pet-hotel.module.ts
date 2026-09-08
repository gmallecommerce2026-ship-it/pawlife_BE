import { Module } from '@nestjs/common';
import { PetHotelController } from './pet-hotel.controller';
import { PetHotelService } from './pet-hotel.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PetHotelController],
  providers: [PetHotelService],
  exports: [PetHotelService],
})
export class PetHotelModule {}