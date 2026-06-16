// src/modules/wallet/wallet.controller.ts
import { Controller, Get, Post, Param, Res, UseGuards, HttpException, HttpStatus, StreamableFile } from '@nestjs/common';
import type { Response } from 'express'; // FIX: Lấy Response từ express để dùng được res.set và res.send
import { v4 as uuidv4 } from 'uuid';
import { WalletService } from './wallet.service';
import { RedisService } from '../../database/redis/redis.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator'; // FIX: Import decorator @User
import { Public } from '../../common/decorators/public.decorator'; // Thêm nếu bạn có decorator @Public để bypass JwtAuthGuard

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly redisService: RedisService,
  ) { }


  // Bước 1: App gọi endpoint này (CÓ AUTH) để xin URL tải pass
  @Post('pets/:petId/pass-token')
  @UseGuards(JwtAuthGuard)
  async generatePassDownloadToken(
    @User('id') userId: string,
    @Param('petId') petId: string,
  ) {
    const token = uuidv4();
    await this.redisService.set(`pass_token:${token}`, { userId, petId }, 60);

    // Chỉ trả về token, không trả về URL đầy đủ
    return { token };
  }

  // Bước 2: OS gọi endpoint này (PUBLIC) để tải file binary
  @Get('download-pass/:token')
  @Public()
  async downloadPassByToken(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {

    const data = await this.redisService.get<{ userId: string; petId: string }>(
      `pass_token:${token}`,
    );

    if (!data) {
      throw new HttpException('Token expired or invalid', HttpStatus.FORBIDDEN);
    }

    const { userId, petId } = data;
    await this.redisService.del(`pass_token:${token}`);

    const { buffer, fileName } = await this.walletService.generatePetPass(userId, petId);

    res.set({
      // ① MIME type chính xác — iOS dùng cái này để quyết định mở PassKit
      'Content-Type': 'application/vnd.apple.pkpass',
      // ② inline thay vì attachment — không trigger "save file" dialog
      'Content-Disposition': `inline; filename="${fileName}"`,
      // ③ Content-Length bắt buộc — thiếu thì iOS timeout hoặc hiện lỗi
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-store',
    });

    return new StreamableFile(buffer);
  }
}