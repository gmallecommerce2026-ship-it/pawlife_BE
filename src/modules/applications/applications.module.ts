import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { AdoptionApplicationService } from './adoption-application.service';
import { AdoptionApplicationController } from './adoption-application.controller';

@Module({
  providers: [ApplicationsService, AdoptionApplicationService],
  controllers: [ApplicationsController, AdoptionApplicationController],
})
export class ApplicationsModule {}
