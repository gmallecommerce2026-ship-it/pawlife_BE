import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'mail' })], // reuse queue 'mail' đã có sẵn
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}