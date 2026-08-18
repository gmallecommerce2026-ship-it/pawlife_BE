import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { google } from 'googleapis';

@Controller('google/oauth')
export class GoogleOAuthController {
  private oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  // Mở URL này trên trình duyệt để bắt đầu xin quyền —
  // Google sẽ redirect thẳng về FE (shelter.pawlife.vn/tools/google-callback)
  // kèm ?code=... trên URL, không quay lại backend nữa.
  @Get('start')
  start(@Res() res: Response) {
    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
    });
    return res.redirect(url);
  }

  // FE gọi API này, gửi kèm `code` lấy được từ query string của trang callback
  @Post('exchange')
  async exchange(@Body('code') code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return {
      success: true,
      refreshToken: tokens.refresh_token ?? null,
      accessToken: tokens.access_token ?? null,
    };
  }
}