import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisModule } from '../../database/redis/redis.module';
import { PawlyPlacesController } from './pawly-place.controller';
import { PawlyPlacesService } from './pawly-place.service';

@Module({
  imports: [RedisModule],
  controllers: [PawlyPlacesController],
  providers: [PawlyPlacesService, PrismaService],
  exports: [PawlyPlacesService],
})
export class PawlyPlacesModule { }