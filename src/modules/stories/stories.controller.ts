import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminEmailGuard } from '../ingredients/guards/admin-email.guard';
import { CreateStoryDto } from './dto/story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  // 1. LẤY DANH SÁCH — public (nhận token nếu có để check user đã like chưa)
  @Get()
  findAll(@Req() req: any) {
    // Nếu app có gắn user qua middleware/guard tuỳ chọn, lấy req.user?.id
    const currentUserId = req.user?.id;
    return this.storiesService.findAll(currentUserId);
  }

  // 2. TOGGLE LIKE — Bắt buộc phải đăng nhập
  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  toggleLike(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.storiesService.toggleLike(id, userId);
  }

  // 3. THÊM MỚI (Admin)
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @Post()
  create(@Body() dto: CreateStoryDto) {
    return this.storiesService.create(dto);
  }

  // 4. CẬP NHẬT (Admin)
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStoryDto) {
    return this.storiesService.update(id, dto);
  }

  // 5. XOÁ (Admin)
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.storiesService.remove(id);
  }
}