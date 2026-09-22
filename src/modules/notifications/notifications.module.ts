// src/modules/notifications/notifications.module.ts
import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { PushNotificationService } from './push-notification.service';
import { PushProcessor } from './push.processor';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../../database/redis/redis.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'push', // 🆕 Hàng đợi riêng cho việc gửi Expo Push Notification
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    PushNotificationService, // 🆕
    PushProcessor,           // 🆕
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}