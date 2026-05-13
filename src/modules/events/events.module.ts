import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { RedisModule } from '../../database/redis/redis.module';
@Module({
  imports: [RedisModule],
  providers: [EventsService],
  controllers: [EventsController]
})
export class EventsModule {}
