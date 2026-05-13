import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailerModule } from '@nestjs-modules/mailer'; 
import { RedisModule } from './database/redis/redis.module';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from './modules/storage/storage.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PetsModule } from './modules/pets/pets.module';
import { SheltersModule } from './modules/shelters/shelters.module';
import { UserInteractionsModule } from './modules/user-interactions/user-interactions.module';
import { EventsModule } from './modules/events/events.module';
import { TagsModule } from './modules/tags/tags.module';
import { PawcareModule } from './modules/pawcare/pawcare.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ApplicationsModule } from './modules/applications/applications.module';

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    // 1. Config Module (Nên là module đầu tiên)
    ConfigModule.forRoot({ isGlobal: true }),
    
    // 2. Throttler (Rate Limit) - Đã làm sạch logic
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST') || '127.0.0.1';
        const port = config.get<number>('REDIS_PORT') || 6379;
        const password = config.get<string>('REDIS_PASSWORD');
        const isLocal = host === 'localhost' || host === '127.0.0.1';

        return {
          throttlers: [{ name: 'default', ttl: 60000, limit: 50 }],
          storage: new ThrottlerStorageRedisService(
            new Redis({
              host,
              port,
              password,
              tls: isLocal ? undefined : { rejectUnauthorized: false },
              // Thêm dòng này để ioredis không log lỗi linh tinh khi đang reconnect
              retryStrategy: (times) => Math.min(times * 50, 2000), 
            }),
          ),
        };
      },
    }),

    // 3. Mailer - Giữ log kiểm tra để debug trên VPS
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get('MAIL_HOST'),
          port: 587,
          secure: false,
          auth: {
            user: config.get('MAIL_USER'),
            pass: config.get('MAIL_PASS'), 
          },
        },
        defaults: {
          from: `"PawLife" <${config.get('MAIL_USER')}>`,
        },
      }),
    }),

    // 4. BullMQ - Đảm bảo Connection đồng nhất với Throttler
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST') || '127.0.0.1';
        const isLocal = host === 'localhost' || host === '127.0.0.1';

        return {
          connection: {
            host,
            port: config.get<number>('REDIS_PORT') || 6379,
            password: config.get<string>('REDIS_PASSWORD'),
            tls: isLocal ? undefined : { rejectUnauthorized: false },
          },
        };
      },
    }),

    // 5. App Modules
    DatabaseModule,
    RedisModule,
    AuthModule,
    StorageModule,
    PetsModule,
    SheltersModule,
    UserInteractionsModule,
    EventsModule,
    TagsModule,
    PawcareModule,
    NotificationsModule,
    ApplicationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}