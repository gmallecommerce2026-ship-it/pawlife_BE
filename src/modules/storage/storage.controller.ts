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
    // 1. PRINT LOG TO SEE IF THE REQUEST REACHES HERE
    console.log('--- [STORAGE] RECEIVED REQUEST TO GENERATE URL ---', body);

    // 2. PREVENT SERVER CRASH IF DATA IS MISSING
    if (!body || !body.fileType) {
      console.log('❌ Error: Payload sent from Frontend is missing fileType!');
      throw new BadRequestException('Missing fileType parameter');
    }

    try {
      const defaultFolder = body.fileType.startsWith('video/') ? 'videos' : 'avatars';
      const folder = body.folder || defaultFolder;
      
      console.log(`Calling R2 Service with folder: ${folder}...`);
      
      // 3. CALL R2 SERVICE
      const result = await this.r2Service.generatePresignedUrl(body.fileName, body.fileType, folder);
      
      console.log('✅ Successfully generated URL!');
      return result;

    } catch (error) {
      // 4. CATCH R2 ERROR (IF ANY) TO AVOID CRASHING THE SERVER
      console.error('❌ ERROR WHEN CALLING R2 SERVICE:', error);
      throw new InternalServerErrorException('Cannot connect to Cloudflare R2. Please check your .env configuration');
    }
  }
}