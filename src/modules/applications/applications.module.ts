import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { GoogleMeetModule } from '../google-meet/google-meet.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { PublicApplicationsController } from './public-applications.controller';
@Module({
  imports: [
    GoogleMeetModule,
    MailerModule,
    NotificationsModule, 
  ],
  providers: [ApplicationsService],
  controllers: [ApplicationsController, PublicApplicationsController],
})
export class ApplicationsModule {}
