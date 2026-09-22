import { Module } from '@nestjs/common';
import { PetParadiseController } from './pet-paradise.controller';
import { PetParadiseService } from './pet-paradise.service';
import { RedisModule } from '../../database/redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule, RedisModule, NotificationsModule],
  controllers: [PetParadiseController],
  providers: [PetParadiseService],
  exports: [PetParadiseService],
})
export class PetParadiseModule {}