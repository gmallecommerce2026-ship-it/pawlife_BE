import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { GoogleMeetModule } from '../google-meet/google-meet.module';

@Module({
  imports: [
    GoogleMeetModule,
    NotificationsModule, 
  ],
  providers: [ApplicationsService],
  controllers: [ApplicationsController],
})
export class ApplicationsModule {}
