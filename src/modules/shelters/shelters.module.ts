import { Module } from '@nestjs/common';
import { SheltersController } from './shelters.controller';
import { SheltersService } from './shelters.service';
import { RedisModule } from '../../database/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [SheltersController],
  providers: [SheltersService]
})
export class SheltersModule {}
