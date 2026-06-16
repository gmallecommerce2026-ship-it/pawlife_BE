// src/modules/wallet/wallet.module.ts
import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { DatabaseModule } from '../../database/database.module';
import { PET_DATA_PROVIDER } from './ports/pet-data.port';
import { PrismaPetDataAdapter } from './adapters/prisma-pet-data.adapter';

@Module({
  // DatabaseModule ở đây CHỈ phục vụ adapter bên dưới — wallet.service không
  // đụng tới Prisma. Muốn đổi nguồn dữ liệu pet (vd HTTP) thì chỉ thay class
  // bind cho PET_DATA_PROVIDER, không sửa gì khác trong module.
  imports: [DatabaseModule],
  controllers: [WalletController],
  providers: [
    WalletService,
    { provide: PET_DATA_PROVIDER, useClass: PrismaPetDataAdapter },
  ],
})
export class WalletModule {}
