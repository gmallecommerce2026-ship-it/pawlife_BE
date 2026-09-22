"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const config_1 = require("@nestjs/config");
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./modules/auth/auth.module");
const mailer_1 = require("@nestjs-modules/mailer");
const redis_module_1 = require("./database/redis/redis.module");
const bullmq_1 = require("@nestjs/bullmq");
const storage_module_1 = require("./modules/storage/storage.module");
const throttler_1 = require("@nestjs/throttler");
const pets_module_1 = require("./modules/pets/pets.module");
const shelters_module_1 = require("./modules/shelters/shelters.module");
const user_interactions_module_1 = require("./modules/user-interactions/user-interactions.module");
const events_module_1 = require("./modules/events/events.module");
const tags_module_1 = require("./modules/tags/tags.module");
const pawcare_module_1 = require("./modules/pawcare/pawcare.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const applications_module_1 = require("./modules/applications/applications.module");
const throttler_storage_redis_1 = require("@nest-lab/throttler-storage-redis");
const ioredis_1 = require("ioredis");
const core_1 = require("@nestjs/core");
const schedule_1 = require("@nestjs/schedule");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const host = config.get('REDIS_HOST') || '127.0.0.1';
                    const port = config.get('REDIS_PORT') || 6379;
                    const password = config.get('REDIS_PASSWORD');
                    const isLocal = host === 'localhost' || host === '127.0.0.1';
                    return {
                        throttlers: [{ name: 'default', ttl: 60000, limit: 50 }],
                        storage: new throttler_storage_redis_1.ThrottlerStorageRedisService(new ioredis_1.Redis({
                            host,
                            port,
                            password,
                            tls: isLocal ? undefined : { rejectUnauthorized: false },
                            retryStrategy: (times) => Math.min(times * 50, 2000),
                        })),
                    };
                },
            }),
            mailer_1.MailerModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: async (config) => ({
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
            bullmq_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: async (config) => {
                    const host = config.get('REDIS_HOST') || '127.0.0.1';
                    const isLocal = host === 'localhost' || host === '127.0.0.1';
                    return {
                        connection: {
                            host,
                            port: config.get('REDIS_PORT') || 6379,
                            password: config.get('REDIS_PASSWORD'),
                            tls: isLocal ? undefined : { rejectUnauthorized: false },
                        },
                    };
                },
            }),
            database_module_1.DatabaseModule,
            redis_module_1.RedisModule,
            auth_module_1.AuthModule,
            storage_module_1.StorageModule,
            pets_module_1.PetsModule,
            shelters_module_1.SheltersModule,
            user_interactions_module_1.UserInteractionsModule,
            events_module_1.EventsModule,
            tags_module_1.TagsModule,
            pawcare_module_1.PawcareModule,
            notifications_module_1.NotificationsModule,
            applications_module_1.ApplicationsModule,
            schedule_1.ScheduleModule.forRoot(),
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map