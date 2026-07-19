"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const compression_1 = __importDefault(require("compression"));
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = require("express");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    app;
    adapterConstructor;
    constructor(app) {
        super(app);
        this.app = app;
    }
    async connectToRedis() {
        const pubClient = new ioredis_1.Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
        });
        const subClient = pubClient.duplicate();
        pubClient.on('connect', () => console.log('🟢 Redis PubClient: Đã kết nối thành công!'));
        subClient.on('connect', () => console.log('🟢 Redis SubClient: Đã kết nối thành công!'));
        pubClient.on('error', (err) => console.error('🔴 Redis Pub Error:', err.message));
        subClient.on('error', (err) => console.error('🔴 Redis Sub Error:', err.message));
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        server.adapter(this.adapterConstructor);
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, cookie_parser_1.default)());
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: 'Content-Type, Accept, Authorization, x-device-id, user-agent, Cache-Control, Pragma, Expires',
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });
    app.use((0, compression_1.default)());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true }
    }));
    app.use((0, express_1.json)({ limit: '2mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '2mb' }));
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    const port = process.env.PORT ?? 3001;
    await app.listen(port, '0.0.0.0');
    console.log(`✅ Server is listening on all network interfaces (0.0.0.0:${port})`);
}
bootstrap();
//# sourceMappingURL=main.js.map