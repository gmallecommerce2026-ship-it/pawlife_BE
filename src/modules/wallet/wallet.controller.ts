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
  ) {}


  // Bước 1: App gọi endpoint này (CÓ AUTH) để xin URL tải pass
  @Post('pets/:petId/pass-token')
  @UseGuards(JwtAuthGuard)
  async generatePassDownloadToken(
    @User('id') userId: string,
    @Param('petId') petId: string,
  ) {
    const token = uuidv4();
    
    // Lưu vào Redis, hết hạn sau 60 giây. 
    // Do redisService.set của bạn tự động stringify nên truyền thẳng object vào
    await this.redisService.set(`pass_token:${token}`, { userId, petId }, 60);
    
    // Trả về URL public đính kèm token (Nhớ cấu hình API_BASE_URL trong .env)
    return { 
      url: `${process.env.API_BASE_URL}/wallet/download-pass/${token}` 
    };
  }

  // Bước 2: OS gọi endpoint này (PUBLIC) để tải file binary
  @Get('download-pass/:token')
  @Public()
  async downloadPassByToken(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response, // FIX 1: Thêm passthrough: true
  ): Promise<StreamableFile> { // FIX 2: Khai báo kiểu trả về
    
    const data = await this.redisService.get<{userId: string, petId: string}>(`pass_token:${token}`);
    
    if (!data) {
      throw new HttpException('Token expired or invalid', HttpStatus.FORBIDDEN);
    }
    
    const { userId, petId } = data;
    await this.redisService.del(`pass_token:${token}`);

    try {
      const { buffer, fileName } = await this.walletService.generatePetPass(userId, petId);

      // FIX 3: Thêm Content-Length (Apple Wallet RẤT CẦN header này để hiển thị thanh tiến trình tải)
      res.set({
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Length': buffer.length.toString(), 
      });

      // FIX 4: Trả về StreamableFile thay vì res.send()
      return new StreamableFile(buffer);
      
    } catch (error) {
      // Bắt lỗi để tránh crash app dẫn đến 502
      throw new HttpException('Lỗi khi tạo thẻ', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}