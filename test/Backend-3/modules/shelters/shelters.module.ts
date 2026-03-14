import { Module } from '@nestjs/common';
import { SheltersController } from './shelters.controller';
import { SheltersService } from './shelters.service';

@Module({
  controllers: [SheltersController],
  providers: [SheltersService]
})
export class SheltersModule {}
