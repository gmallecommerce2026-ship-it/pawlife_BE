import { Module } from '@nestjs/common';
import { PawlyPlacesController } from './pawly-places.controller';
import { PawlyPlacesService } from './pawly-places.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisModule } from '../../database/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [PawlyPlacesController],
  providers: [PawlyPlacesService, PrismaService],
  exports: [PawlyPlacesService],
})
export class PawlyPlacesModule { }