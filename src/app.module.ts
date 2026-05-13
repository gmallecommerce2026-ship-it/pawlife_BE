// src/app.module.ts
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

// IMPORT THƯ VIỆN RATE LIMIT REDIS MỚI
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    
    // 1. CẤU HÌNH RATE LIMIT BẰNG REDIS
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST') || 'localhost';
        const isLocal = host === 'localhost' || host === '127.0.0.1';

        return {
          throttlers: [
            {
              name: 'default',
              ttl: 60000, // 60 giây
              limit: 50,  // Mặc định 30 request / 1 phút (Có thể override bằng @Throttle ở Controller)
            },
          ],
          storage: new ThrottlerStorageRedisService(
            new Redis({
              host: host,
              port: Number(configService.get<number>('REDIS_PORT')) || 6379,
              password: configService.get<string>('REDIS_PASSWORD'),
              tls: isLocal ? undefined : { rejectUnauthorized: false }, // Xử lý bảo mật đồng nhất với BullMQ
            })
          ),
        };
      },
    }),

    // 2. CẤU HÌNH MAIL
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const mailHost = configService.get<string>('MAIL_HOST');
        const mailUser = configService.get<string>('MAIL_USER');
        const mailPass = configService.get<string>('MAIL_PASS');

        console.log('--- KIỂM TRA MAIL CONFIG ---');
        console.log('HOST:', mailHost);
        console.log('USER:', mailUser); 
        console.log('PASS:', mailPass ? '****** (Đã có pass)' : 'MISSING (Thiếu pass)');
        console.log('----------------------------');

        return {
          transport: {
            host: mailHost,
            port: 587,
            secure: false,
            auth: {
              user: mailUser,
              pass: mailPass, 
            },
          },
          defaults: {
            from: `"PawLife" <${mailUser}>`,
          },
        };
      },
    }),

    // 3. CẤU HÌNH BULLMQ CHO BACKGROUND JOBS
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const isLocal = host === 'localhost' || host === '127.0.0.1';

        return {
          connection: {
            host: host,
            port: configService.get<number>('REDIS_PORT'),
            password: configService.get<string>('REDIS_PASSWORD'),
            tls: isLocal ? undefined : { rejectUnauthorized: false },
          },
        };
      },
      inject: [ConfigService],
    }),

    // 4. CÁC MODULE CỦA ỨNG DỤNG
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
    ApplicationsModule
  ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },],
})
export class AppModule {}