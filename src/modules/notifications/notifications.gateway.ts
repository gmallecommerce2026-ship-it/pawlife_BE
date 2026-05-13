// src/modules/notifications/notifications.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { RedisService } from '../../database/redis/redis.service'; // IMPORT REDIS

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications', 
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;
  
  private logger = new Logger('NotificationsGateway');

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService // INJECT REDIS
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.auth.token || client.handshake.headers['authorization'];
      if (!authHeader) {
        throw new Error('No token provided');
      }

      const token = authHeader.replace('Bearer ', '');
      const payload = this.jwtService.verify(token); 
      
      // Lấy userId từ token (bổ sung thêm payload.userId đề phòng cấu trúc auth đổi)
      const userId = payload.id || payload.sub || payload.userId; 

      // 1. LƯU LẠI userId VÀO DATA CỦA SOCKET (để dùng lúc disconnect)
      client.data.userId = userId;

      client.join(`user_${userId}`);
      
      // 2. LƯU TRẠNG THÁI ONLINE VÀO REDIS
      await this.redisService.addSocket(userId, client.id);

      this.logger.log(`[Online] Client connected: ${client.id} - User: ${userId}`);
    } catch (error: any) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    // 3. LẤY LẠI userId KHI USER MẤT MẠNG / TẮT APP
    const userId = client.data.userId;
    
    if (userId) {
      // Xóa socket khỏi thiết bị hiện tại
      await this.redisService.removeSocket(userId, client.id);

      // Kiểm tra xem User còn mở app trên máy khác (VD: máy tính, ipad) không
      const isStillOnline = await this.redisService.isUserOnline(userId);
      
      if (!isStillOnline) {
        this.logger.log(`[Offline] User ${userId} is fully offline.`);
      } else {
        this.logger.log(`[Partial Disconnect] Socket ${client.id} closed, but User ${userId} is still online on another device.`);
      }
    } else {
      this.logger.log(`Client disconnected before authentication: ${client.id}`);
    }
  }

  // Hàm phát event tới 1 user cụ thể (Giữ nguyên - Tự động đồng bộ nhờ Redis Adapter ở main.ts)
  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('new_notification', notification);
  }

  // --- TÍNH NĂNG MỚI: GỬI THÔNG BÁO THÔNG MINH ---
  async notifyUserSmartly(userId: string, eventName: string, payload: any) {
    const isOnline = await this.redisService.isUserOnline(userId);
    
    if (isOnline) {
      // Nếu user đang online -> Bắn socket ngay lập tức để app tự rung/đổ chuông
      this.server.to(`user_${userId}`).emit(eventName, payload);
    } else {
      // Nếu user đang offline -> Tương lai bạn gắn code bắn Push Notification (FCM Firebase) vào đây
      this.logger.debug(`User ${userId} is offline. Target for Push Notification (FCM).`);
    }
  }
}