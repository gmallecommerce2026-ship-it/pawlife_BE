import { Controller, Get, Post, Param, Query, ParseIntPipe, DefaultValuePipe, Body } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // 1. Lấy danh sách sự kiện sắp tới (dùng cho Home Screen)
  @Get('upcoming')
  async getUpcomingEvents(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.eventsService.getUpcomingEvents(limit);
  }

  @Get('interested/user')
  async getInterestedEvents(@Query('userId') userId: string) {
    if (!userId) {
      return { success: false, message: 'Missing userId' };
    }
    return this.eventsService.getInterestedEvents(userId);
  }

  // 2. Lấy chi tiết sự kiện (dùng cho EventDetailScreen)
  @Get(':id')
  async getEventDetail(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    return this.eventsService.getEventDetail(id, userId);
  }

  // 3. API bấm nút "Interesting" ở cuối màn hình
  // Lưu ý: Trong thực tế userId nên lấy từ Token (thông qua Guard/Decorator), 
  // ở đây truyền qua Body để dễ hình dung logic.
  @Post(':id/interest')
  async toggleInterest(
    @Param('id') eventId: string,
    @Body('userId') userId: string, 
  ) {
    return this.eventsService.toggleInterest(eventId, userId);
  }

  @Get()
  async searchEvents(
    @Query('search') search?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.eventsService.searchEvents({ search, limit });
  }
}