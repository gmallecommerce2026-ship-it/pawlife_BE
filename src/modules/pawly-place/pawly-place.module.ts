import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisModule } from '../../database/redis/redis.module';
import { PawlyPlacesController } from './pawly-place.controller';
import { PawlyPlacesService } from './pawly-place.service';
import { PawlyPlaceSubmissionsController } from './pawly-place-submissions.controller';
import { PawlyPlaceSubmissionsService } from './pawly-place-submissions.service';
import { PlaceModeratorGuard } from 'src/common/guards/place-moderator.guard';

@Module({
  imports: [RedisModule],
  controllers: [PawlyPlacesController, PawlyPlaceSubmissionsController],
  providers: [PawlyPlacesService, PawlyPlaceSubmissionsService, PlaceModeratorGuard, PrismaService],
  exports: [PawlyPlacesService, PawlyPlaceSubmissionsService],
})
export class PawlyPlacesModule { }