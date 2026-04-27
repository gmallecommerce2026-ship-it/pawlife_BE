import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe, Patch, Req } from '@nestjs/common';
import { PetsService } from './pets.service';
import { SwipePetDto } from './dto/swipe-pet.dto';
import { GetFavoritesDto } from './dto/get-favorites.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator'; 
import { PetGender, PetSize } from '@prisma/client';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Controller('pets')
@UseGuards(JwtAuthGuard) 
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

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
  

  @Get('feed')
  async getFeed(
    @User('id') userId: string,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
    @Query('gender') gender?: PetGender,
    @Query('size') size?: PetSize,
    @Query('species') species?: string,
    // THÊM 2 DÒNG NÀY ĐỂ HỨNG TỌA ĐỘ TỪ FRONTEND
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    // Ép kiểu từ string sang number
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;

    // Truyền thêm latitude và longitude xuống Service
    return this.petsService.getFeed(
      userId, 
      limit, 
      { gender, size, species }, 
      latitude, 
      longitude
    );
  }

  // Chú ý: Đặt /pets/favorites TẠI ĐÂY (trước các route chứa /pets/:id)
  @Get('favorites')
  async getFavorites(
    @User('id') userId: string,
    @Query() query: GetFavoritesDto,
  ) {
    const skip = query.skip || 0;
    const take = query.take || 10;
    return this.petsService.getFavorites(userId, skip, take);
  }


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


  @Post() // Định tuyến POST /pets
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
    @User('id') userId: string,
    @Param('id') petId: string,
    @Body('isLost') isLost: boolean,
  ) {
    return this.petsService.toggleLostMode(userId, petId, isLost);
  }
}