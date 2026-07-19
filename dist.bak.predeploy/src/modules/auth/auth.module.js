"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const jwt_strategy_1 = require("./jwt.strategy");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./controllers/auth.controller");
const cache_manager_1 = require("@nestjs/cache-manager");
const database_module_1 = require("../../database/database.module");
const storage_module_1 = require("../storage/storage.module");
const redis_module_1 = require("../../database/redis/redis.module");
const mail_processor_1 = require("./mail.processor");
const bullmq_1 = require("@nestjs/bullmq");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            redis_module_1.RedisModule,
            database_module_1.DatabaseModule,
            storage_module_1.StorageModule,
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: async (configService) => ({
                    secret: configService.get('JWT_SECRET') || 'secret_mac_dinh_123',
                    signOptions: {
                        expiresIn: (configService.get('JWT_EXPIRATION_TIME') || '1d'),
                    },
                }),
            }),
            cache_manager_1.CacheModule.register(),
            bullmq_1.BullModule.registerQueue({
                name: 'mail',
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, mail_processor_1.MailProcessor, jwt_strategy_1.JwtStrategy],
        exports: [passport_1.PassportModule, auth_service_1.AuthService, jwt_1.JwtModule],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map