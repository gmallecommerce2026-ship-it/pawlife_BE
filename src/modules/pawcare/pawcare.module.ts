import { Module } from '@nestjs/common';
import { PawcareController } from './pawcare.controller';
import { PawcareService } from './pawcare.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisModule } from 'src/database/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [PawcareController],
  providers: [PawcareService, PrismaService],
})
export class PawcareModule {}