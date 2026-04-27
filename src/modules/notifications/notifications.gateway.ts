import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications', 
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private logger = new Logger('NotificationsGateway');

  // <-- Inject JwtService vào constructor
  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.auth.token || client.handshake.headers['authorization'];
      if (!authHeader) {
        throw new Error('No token provided');
      }

      // Xử lý token (cắt bỏ chữ 'Bearer ' nếu có)
      const token = authHeader.replace('Bearer ', '');
      
      // Decode token để lấy userId
      const payload = this.jwtService.verify(token); 
      // Tùy vào payload bạn thiết kế ở AuthModule, thường là payload.id hoặc payload.sub
      const userId = payload.id || payload.sub; 

      client.join(`user_${userId}`);
      this.logger.log(`Client connected: ${client.id} - Joined room: user_${userId}`);
    } catch (error: any) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Lưu trữ map socketId -> userId (trong hệ thống lớn có thể dùng Redis)
  private userSockets = new Map<string, string[]>();

  // Hàm phát event tới 1 user cụ thể
  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('new_notification', notification);
  }

  private extractUserIdFromToken(token: string): string {
    // Logic decode JWT token của bạn (ví dụ: dùng jwt.verify)
    // Return userId
    return 'user-id-from-token'; // Thay thế bằng logic thực tế
  }
}