// src/modules/google-calendar/google-oauth.module.ts
import { Module } from '@nestjs/common';
import { GoogleOAuthController } from './google-oauth.controller';

@Module({
  controllers: [GoogleOAuthController],
})
export class GoogleOAuthModule {}