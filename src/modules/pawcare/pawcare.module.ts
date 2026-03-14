import { Module } from '@nestjs/common';
import { PawcareController } from './pawcare.controller';
import { PawcareService } from './pawcare.service';
import { PrismaService } from '../../database/prisma/prisma.service';

@Module({
  controllers: [PawcareController],
  providers: [PawcareService, PrismaService],
})
export class PawcareModule {}