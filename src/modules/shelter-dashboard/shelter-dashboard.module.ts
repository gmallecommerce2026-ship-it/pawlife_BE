import { Module } from '@nestjs/common';
import { ShelterDashboardController } from './shelter-dashboard.controller';
import { ShelterDashboardService } from './shelter-dashboard.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PetsModule } from '../pets/pets.module'; // 🆕

@Module({
  imports: [NotificationsModule, PetsModule], // 🆕 thêm PetsModule
  controllers: [ShelterDashboardController],
  providers: [ShelterDashboardService],
})
export class ShelterDashboardModule {}