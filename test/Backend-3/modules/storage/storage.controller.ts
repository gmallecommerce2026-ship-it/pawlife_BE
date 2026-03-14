import { Controller, Post, Body, UseGuards, Delete, Query, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { R2Service } from './r2.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { GetPresignedUrlDto } from './dto/storage.dto';

@Controller('storage')
export class StorageController {
  constructor(private readonly r2Service: R2Service) {}

  @Public()
  @Post('presigned')
  @UseGuards(JwtAuthGuard) 
  async getPresignedUrl(@Body() body: { fileName: string; fileType: string }) {
    return this.r2Service.generatePresignedUrl(body.fileName, body.fileType);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('presigned-url')
  async getUploadUrl(@Body() body: GetPresignedUrlDto) {
    // 1. IN LOG ĐỂ XEM REQUEST CÓ VÀO TỚI ĐÂY KHÔNG
    console.log('--- [STORAGE] NHẬN REQUEST TẠO URL ---', body);

    // 2. CHỐNG CRASH SERVER NẾU THIẾU DỮ LIỆU
    if (!body || !body.fileType) {
      console.log('❌ Lỗi: Payload Frontend gửi lên bị thiếu fileType!');
      throw new BadRequestException('Thiếu tham số fileType');
    }

    try {
      const defaultFolder = body.fileType.startsWith('video/') ? 'videos' : 'avatars';
      const folder = body.folder || defaultFolder;
      
      console.log(`Đang gọi R2 Service với folder: ${folder}...`);
      
      // 3. GỌI R2 SERVICE
      const result = await this.r2Service.generatePresignedUrl(body.fileName, body.fileType, folder);
      
      console.log('✅ Tạo URL thành công!');
      return result;

    } catch (error) {
      // 4. BẮT LỖI R2 (NẾU CÓ) ĐỂ KHÔNG LÀM SẬP SERVER
      console.error('❌ LỖI KHI GỌI R2 SERVICE:', error);
      throw new InternalServerErrorException('Không thể kết nối đến Cloudflare R2. Vui lòng kiểm tra lại cấu hình .env');
    }
  }
}