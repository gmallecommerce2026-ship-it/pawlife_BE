// src/modules/pets/pets.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe, Patch, Req } from '@nestjs/common';
import { PetsService } from './pets.service';
import { SwipePetDto } from './dto/swipe-pet.dto';
import { GetFavoritesDto } from './dto/get-favorites.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator'; 
import { PetGender, PetSize } from '@prisma/client';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { Throttle } from '@nestjs/throttler'; // BỔ SUNG IMPORT
import { ToggleLostModeDto } from './dto/toggle-lost-mode.dto';

@Controller('pets')
@UseGuards(JwtAuthGuard) 
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post(':id/link-qr')
  async linkQrCode(
    @User('id') userId: string,
    @Param('id') petId: string,
    @Body('tagId') tagId: string,
  ) {
    return this.petsService.linkQrCode(userId, petId, tagId);
  }

  @Post(':id/transfer-request')
  async requestTransfer(
    @Param('id') petId: string,
    @Body() body: { email?: string; phone?: string },
    @Req() req: any
  ) {
    return this.petsService.requestTransfer(petId, body, req.user.id);
  }

  @Post(':id/cancel-transfer')
  async cancelTransfer(
    @Param('id') petId: string,
    @User('id') userId: string
  ) {
    return this.petsService.cancelTransfer(petId, userId);
  }

  @Post('transfer-confirm/:transferId')
  async confirmTransfer(@Param('transferId') transferId: string, @Req() req: any) {
    return this.petsService.confirmTransfer(transferId, req.user.id);
  }
  
  @Throttle({ default: { limit: 120, ttl: 60000 } }) // BỔ SUNG: Cho phép lướt feed 120 lần/phút (tránh ddos db)
  @Get('feed')
  async getFeed(
    @User('id') userId: string,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
    @Query('gender') gender?: PetGender,
    @Query('size') size?: PetSize,
    @Query('species') species?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;

    return this.petsService.getFeed(
      userId, 
      limit, 
      { gender, size, species }, 
      latitude, 
      longitude
    );
  }

  @Get('favorites')
  async getFavorites(
    @User('id') userId: string,
    @Query() query: GetFavoritesDto,
  ) {
    const skip = query.skip || 0;
    const take = query.take || 10;
    return this.petsService.getFavorites(userId, skip, take);
  }

  @Throttle({ default: { limit: 150, ttl: 60000 } }) // BỔ SUNG: Cho phép quẹt tay tốc độ cao (150 lần/phút)
  @Post(':id/swipe')
  async swipePet(
    @User('id') userId: string,
    @Param('id') petId: string,
    @Body() swipePetDto: SwipePetDto,
  ) {
    return this.petsService.swipePet(userId, petId, swipePetDto);
  }

  @Post(':id/favorite')
  async addFavorite(
    @User('id') userId: string,
    @Param('id') petId: string,
  ) {
    return this.petsService.addFavorite(userId, petId);
  }

  @Delete(':id/favorite')
  async removeFavorite(
    @User('id') userId: string,
    @Param('id') petId: string,
  ) {
    return this.petsService.removeFavorite(userId, petId);
  }

  @Get('my-pets')
  async getMyPets(@User('id') userId: string) {
    return this.petsService.getMyPets(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createPet(
    @User('id') userId: string, 
    @Body() createPetDto: CreatePetDto
  ) {
    return this.petsService.createPet(userId, createPetDto);
  }
  
  @Get(':id')
  async getPetById(@Param('id') id: string) {
    return this.petsService.getPetById(id);
  }

  @Get()
  async searchPets(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.petsService.searchPets({ search, type, limit });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updatePet(
    @User('id') userId: string,
    @Param('id') petId: string,
    @Body() updatePetDto: UpdatePetDto
  ) {
    return this.petsService.updatePet(userId, petId, updatePetDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async removePet(
    @User('id') userId: string,
    @Param('id') petId: string,
  ) {
    return this.petsService.removePet(userId, petId);
  }

  @Patch(':id/lost-mode')
  @UseGuards(JwtAuthGuard)
  async toggleLostMode(
    @Req() req: any, 
    @Param('id') id: string, 
    @Body() dto: ToggleLostModeDto // Lấy toàn bộ payload frontend gửi lên
  ) {
    return this.petsService.toggleLostMode(req.user.id, id, dto);
  }
}