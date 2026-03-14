import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { GetNotificationsDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard) // Đảm bảo đã có JWT Guard để lấy userId
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // API lấy danh sách thông báo
  @Get()
  getMine(@User('id') userId: string, @Query() query: GetNotificationsDto) {
    return this.notificationsService.getUserNotifications(userId, query);
  }

  // API lấy chi tiết 1 thông báo (Bao gồm cả data Tag/Event)
  @Get(':id/detail')
  getDetail(@User('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.getNotificationDetail(userId, id);
  }

  // API đánh dấu đã đọc
  @Patch(':id/read')
  markAsRead(@User('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  // API đánh dấu đọc tất cả
  @Patch('read-all')
  markAllAsRead(@User('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }
}