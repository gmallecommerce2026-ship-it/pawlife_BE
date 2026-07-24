// src/modules/shelter-dashboard/shelter-dashboard.module.ts
import { Module } from '@nestjs/common';
import { ShelterDashboardController } from './shelter-dashboard.controller';
import { ShelterDashboardService } from './shelter-dashboard.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ShelterDashboardController],
  providers: [ShelterDashboardService],
})
export class ShelterDashboardModule {}