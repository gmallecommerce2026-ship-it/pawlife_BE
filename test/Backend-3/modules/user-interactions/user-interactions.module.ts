import { Module } from '@nestjs/common';
import { UserInteractionsController } from './user-interactions.controller';
import { UserInteractionsService } from './user-interactions.service';

@Module({
  controllers: [UserInteractionsController],
  providers: [UserInteractionsService]
})
export class UserInteractionsModule {}
