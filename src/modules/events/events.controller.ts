import { Controller, Get, Post, Param, Query, ParseIntPipe, DefaultValuePipe, Body, Res, Req } from '@nestjs/common';
import { EventsService } from './events.service';
import type { Request, Response } from 'express';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) { }

  // 1. Lấy danh sách sự kiện sắp tới (dùng cho Home Screen)
  @Get('upcoming')
  async getUpcomingEvents(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Query('userId') userId?: string, // BỔ SUNG DÒNG NÀY
  ) {
    // TRUYỀN USERID XUỐNG SERVICE
    return this.eventsService.getUpcomingEvents(limit, userId); 
  }

  @Get(':id')
  async getEventDetailOrPreview(
    @Param('id') id: string,
    @Req() req: Request,                         // Lấy header thông qua req an toàn hơn
    @Res({ passthrough: true }) res: Response,   // Đã fix lỗi nhờ "import type"
    @Query('userId') userId?: string,
  ) {
    // 1. Kiểm tra header an toàn, không bị nhầm lẫn class hệ thống
    const acceptHeader = req.headers['accept'];
    const acceptsHTML = acceptHeader && acceptHeader.includes('text/html');

    if (acceptsHTML) {
      const html = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sự kiện PawLife</title>
          <style>
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                  text-align: center; 
                  padding: 40px 20px; 
                  background-color: #FDF5EF; 
                  margin: 0;
              }
              .container { 
                  background: white; 
                  padding: 40px 30px; 
                  border-radius: 24px; 
                  box-shadow: 0 10px 25px rgba(232, 155, 90, 0.15); 
                  max-width: 400px; 
                  margin: 0 auto; 
              }
              h1 { color: #E89B5A; margin-bottom: 10px; font-size: 28px; }
              p { color: #8E8E93; line-height: 1.6; font-size: 16px; margin-bottom: 20px; }
              .badge {
                  display: inline-block;
                  background-color: #E89B5A;
                  color: white;
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-weight: bold;
                  font-size: 14px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🐾 PawLife</h1>
              <p>Chi tiết sự kiện này hiện chỉ có thể xem được bên trong ứng dụng PawLife.</p>
              <div class="badge">Coming Soon</div>
          </div>
      </body>
      </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      return;
    }

    // 2. Nếu là App Mobile gọi API, trả về JSON data
    return this.eventsService.getEventDetail(id, userId);
  }
  @Post(':id/report')
  async reportEvent(
    @Param('id') eventId: string,
    @Body() body: any, // Ở dự án thực tế nên dùng DTO validation
  ) {
    const userId = body.userId;
    return this.eventsService.reportEvent(eventId, userId, body);
  }

  @Post(':id/hide')
  async hideEvent(
    @Param('id') eventId: string,
    @Body('userId') userId: string,
  ) {
    return this.eventsService.hideEvent(eventId, userId);
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