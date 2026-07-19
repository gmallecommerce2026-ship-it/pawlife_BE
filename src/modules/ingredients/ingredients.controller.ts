// src/modules/ingredients/ingredients.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminEmailGuard } from './guards/admin-email.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  // 1. API LẤY DANH SÁCH: Cho phép mọi người đều xem được (Sử dụng OptionalJwtAuthGuard hoặc không dùng Guard)
  @Get()
  findAll() {
    return this.ingredientsService.findAll();
  }

  // 2. API THÊM MỚI: Bắt buộc đăng nhập + Phải là Admin
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @Post()
  create(@Body() body: any) {
    return this.ingredientsService.create(body);
  }

  // 3. API CẬP NHẬT: Bắt buộc đăng nhập + Phải là Admin
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.ingredientsService.update(id, body);
  }

  // 4. API XOÁ: Bắt buộc đăng nhập + Phải là Admin
  @UseGuards(JwtAuthGuard, AdminEmailGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ingredientsService.remove(id);
  }
}