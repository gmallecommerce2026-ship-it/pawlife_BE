import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../database/redis/redis.service';
export declare class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwtService;
    private readonly redisService;
    server: Server;
    private logger;
    constructor(jwtService: JwtService, redisService: RedisService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    sendNotificationToUser(userId: string, notification: any): void;
    notifyUserSmartly(userId: string, eventName: string, payload: any): Promise<void>;
}
