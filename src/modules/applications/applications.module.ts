import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { GoogleMeetModule } from '../google-meet/google-meet.module';
import { MailerModule } from '@nestjs-modules/mailer';
@Module({
  imports: [
    GoogleMeetModule,
    MailerModule,
    NotificationsModule, 
  ],
  providers: [ApplicationsService],
  controllers: [ApplicationsController],
})
export class ApplicationsModule {}
