import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private client;
    onModuleInit(): void;
    onModuleDestroy(): void;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    del(key: string): Promise<void>;
    addLocation(key: string, longitude: number, latitude: number, member: string): Promise<void>;
    removeLocation(key: string, member: string): Promise<void>;
    getNearby(key: string, longitude: number, latitude: number, radiusKm: number): Promise<string[]>;
    addSocket(userId: string, socketId: string): Promise<void>;
    removeSocket(userId: string, socketId: string): Promise<void>;
    isUserOnline(userId: string): Promise<boolean>;
}
