"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
let RedisService = class RedisService {
    client;
    onModuleInit() {
        this.client = new ioredis_1.Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
        });
    }
    onModuleDestroy() {
        this.client.disconnect();
    }
    async set(key, value, ttlSeconds) {
        const data = JSON.stringify(value);
        if (ttlSeconds) {
            await this.client.set(key, data, 'EX', ttlSeconds);
        }
        else {
            await this.client.set(key, data);
        }
    }
    async get(key) {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }
    async del(key) {
        await this.client.del(key);
    }
    async addLocation(key, longitude, latitude, member) {
        await this.client.geoadd(key, longitude, latitude, member);
    }
    async removeLocation(key, member) {
        await this.client.zrem(key, member);
    }
    async getNearby(key, longitude, latitude, radiusKm) {
        const result = await this.client.geosearch(key, 'FROMLONLAT', longitude, latitude, 'BYRADIUS', radiusKm, 'km', 'ASC');
        return result;
    }
    async addSocket(userId, socketId) {
        const key = `online:user:${userId}`;
        await this.client.sadd(key, socketId);
        await this.client.expire(key, 86400);
    }
    async removeSocket(userId, socketId) {
        const key = `online:user:${userId}`;
        await this.client.srem(key, socketId);
    }
    async isUserOnline(userId) {
        const key = `online:user:${userId}`;
        const count = await this.client.scard(key);
        return count > 0;
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)()
], RedisService);
//# sourceMappingURL=redis.service.js.map