// src/database/redis/redis.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  async set(key: string, value: any, ttlSeconds?: number) {
    const data = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, data, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, data);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key: string) {
    await this.client.del(key);
  }

  // Thêm tọa độ của một thẻ (Tag)
  async addLocation(key: string, longitude: number, latitude: number, member: string) {
    // GEOADD key longitude latitude member
    await this.client.geoadd(key, longitude, latitude, member);
  }

  // Xóa tọa độ (khi thú cưng đã được tìm thấy)
  // Trong Redis, GEO dùng cấu trúc Sorted Set nên ta dùng lệnh zrem để xóa
  async removeLocation(key: string, member: string) {
    await this.client.zrem(key, member);
  }

  // Tìm kiếm quanh một điểm (Bán kính)
  async getNearby(key: string, longitude: number, latitude: number, radiusKm: number): Promise<string[]> {
    // GEOSEARCH key FROMLONLAT lng lat BYRADIUS radius km ASC
    const result = await this.client.geosearch(
      key, 
      'FROMLONLAT', longitude, latitude, 
      'BYRADIUS', radiusKm, 'km', 
      'ASC'
    );
    return result as string[];
  }

  async addSocket(userId: string, socketId: string) {
    const key = `online:user:${userId}`;
    await this.client.sadd(key, socketId);
    await this.client.expire(key, 86400); // Tự động xóa sau 24h đề phòng kẹt bộ nhớ
  }

  async removeSocket(userId: string, socketId: string) {
    const key = `online:user:${userId}`;
    await this.client.srem(key, socketId);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const key = `online:user:${userId}`;
    const count = await this.client.scard(key);
    return count > 0;
  }
}