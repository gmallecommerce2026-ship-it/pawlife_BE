import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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

  // 1. LẤY DANH SÁCH — public, ai cũng xem được (giống Ingredients)
  @Get()
  findAll() {
    return this.storiesService.findAll();
  }

  // 2. THÊM MỚI — bắt buộc đăng nhập + phải là admin
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @Post()
  create(@Body() dto: CreateStoryDto) {
    return this.storiesService.create(dto);
  }

  // 3. CẬP NHẬT — bắt buộc đăng nhập + phải là admin
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStoryDto) {
    return this.storiesService.update(id, dto);
  }

  // 4. XOÁ — bắt buộc đăng nhập + phải là admin
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.storiesService.remove(id);
  }
}