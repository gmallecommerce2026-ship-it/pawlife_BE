// src/modules/google-meet/google-meet.module.ts
import { Module } from '@nestjs/common';
import { GoogleMeetService } from './google-meet.service';

@Module({
  providers: [GoogleMeetService],
  exports: [GoogleMeetService],
})
export class GoogleMeetModule {}