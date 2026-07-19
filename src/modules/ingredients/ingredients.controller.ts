import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminEmailGuard } from './guards/admin-email.guard';

@Controller('ingredients')
@UseGuards(JwtAuthGuard, AdminEmailGuard)
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  findAll() {
    return this.ingredientsService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; description?: string; imageUrl?: string }) {
    return this.ingredientsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; description?: string; imageUrl?: string }) {
    return this.ingredientsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ingredientsService.remove(id);
  }
}