import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Import ConfigService
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailerModule } from '@nestjs-modules/mailer'; 
import { RedisModule } from './database/redis/redis.module';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from './modules/storage/storage.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { config } from 'dotenv';
import { PetsModule } from './modules/pets/pets.module';
import { SheltersModule } from './modules/shelters/shelters.module';
import { UserInteractionsModule } from './modules/user-interactions/user-interactions.module';
import { EventsModule } from './modules/events/events.module';
import { TagsModule } from './modules/tags/tags.module';
import { PawcareModule } from './modules/pawcare/pawcare.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 giây (1 phút)
      limit: 10,  // Tối đa 10 request / 1 phút / 1 IP
    }]),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // --- ĐOẠN DEBUG QUAN TRỌNG ---
        const mailHost = configService.get<string>('MAIL_HOST');
        const mailUser = configService.get<string>('MAIL_USER');
        const mailPass = configService.get<string>('MAIL_PASS');

        console.log('--- KIỂM TRA MAIL CONFIG ---');
        console.log('HOST:', mailHost);
        console.log('USER:', mailUser); // Nếu hiện undefined -> Lỗi chưa đọc được .env
        console.log('PASS:', mailPass ? '****** (Đã có pass)' : 'MISSING (Thiếu pass)');
        console.log('----------------------------');

        return {
          transport: {
            host: mailHost,
            port: 587,
            secure: false,
            auth: {
              user: mailUser,
              pass: mailPass, // Nodemailer dùng key là 'pass', không phải 'password'
            },
          },
          defaults: {
            from: `"PawLife" <${mailUser}>`,
          },
        };
      },
    }),

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
            // Tắt TLS nếu chạy local
            tls: isLocal ? undefined : { rejectUnauthorized: false },
          },
        };
      },
      inject: [ConfigService],
    },),
    DatabaseModule,
    AuthModule,
    StorageModule,
    PetsModule,
    SheltersModule,
    UserInteractionsModule,
    EventsModule,
    TagsModule,
    PawcareModule,
    NotificationsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
