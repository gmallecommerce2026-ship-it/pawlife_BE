// src/modules/integrations/google-meet/google-meet.module.ts
import { Module } from '@nestjs/common';
import { GoogleMeetService } from './google-meet.service';

@Module({
  providers: [GoogleMeetService],
  exports: [GoogleMeetService], // bắt buộc, để module khác import và dùng được
})
export class GoogleMeetModule {}