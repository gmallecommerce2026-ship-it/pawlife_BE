// src/modules/wallet/wallet.controller.ts
import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // Tải thẻ định danh .pkpass của 1 bé pet để thêm vào Apple Wallet
  // FE (React Native) gọi kèm Bearer token rồi present file qua PassKit
  @Get('pets/:petId/pass')
  async downloadPetPass(
    @User('id') userId: string,
    @Param('petId') petId: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.walletService.generatePetPass(
      userId,
      petId,
    );

    res.set({
      // Content-Type chuẩn Apple — Safari/iOS dựa vào header này để mở preview "Add to Wallet"
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      // Thẻ là snapshot tại thời điểm tải — không cho cache để lần tải sau luôn là data mới nhất
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.send(buffer);
  }
}
