import { Module } from '@nestjs/common';
import { UserInteractionsController } from './user-interactions.controller';
import { UserInteractionsService } from './user-interactions.service';
import { RedisModule } from 'src/database/redis/redis.module'; // 👈 Import module
@Module({
  imports: [RedisModule],
  controllers: [UserInteractionsController],
  providers: [UserInteractionsService]
})
export class UserInteractionsModule {}
