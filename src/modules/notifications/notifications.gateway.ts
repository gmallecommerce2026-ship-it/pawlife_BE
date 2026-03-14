import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Lưu trữ map socketId -> userId (trong hệ thống lớn có thể dùng Redis)
  private userSockets = new Map<string, string[]>();

  async handleConnection(client: Socket) {
    // Authenticate client qua token (lấy từ handshake)
    const token = client.handshake.auth.token || client.handshake.headers['authorization'];
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      // Decode token để lấy userId (Giả sử bạn có hàm decode hoặc gọi Auth service)
      const userId = this.extractUserIdFromToken(token); 
      
      // Join room theo userId để dễ broadcast
      client.join(`user_${userId}`);
      
      console.log(`Client connected: ${client.id} - User: ${userId}`);
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

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