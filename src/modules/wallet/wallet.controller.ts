// src/modules/wallet/wallet.controller.ts
import { Controller, Get, Post, Param, Res, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../database/redis/redis.service'; // Dịch vụ Redis của bạn
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly redisService: RedisService,
  ) {}

  // Bước 1: App gọi endpoint này (CÓ AUTH) để xin URL tải pass
  @Post('pets/:petId/pass-token')
  @UseGuards(JwtAuthGuard)
  async generatePassDownloadToken(
    @User('id') userId: string,
    @Param('petId') petId: string,
  ) {
    const token = uuidv4();
    // Lưu thông tin vào Redis, hết hạn sau 60 giây (ngăn chặn chia sẻ link trái phép)
    await this.redisService.set(`pass_token:${token}`, JSON.stringify({ userId, petId }), 60);
    
    // Trả về URL public đính kèm token
    return { 
      url: `${process.env.API_BASE_URL}/wallet/download-pass/${token}` 
    };
  }

  // Bước 2: OS gọi endpoint này (PUBLIC) để tải file binary
  @Get('download-pass/:token')
  // @Public() - Đảm bảo không gắn JwtAuthGuard
  async downloadPassByToken(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const dataStr = await this.redisService.get(`pass_token:${token}`);
    if (!dataStr) {
      throw new HttpException('Token expired or invalid', HttpStatus.FORBIDDEN);
    }
    
    const { userId, petId } = JSON.parse(dataStr);
    
    // Xóa token ngay lập tức (One-time use)
    await this.redisService.del(`pass_token:${token}`);

    const { buffer, fileName } = await this.walletService.generatePetPass(userId, petId);

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.send(buffer);
  }
}