// src/modules/shelter-dashboard/shelter-dashboard.controller.ts
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ShelterGuard } from 'src/common/guards/shelter.guard';
import { User } from 'src/common/decorators/user.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { ShelterDashboardService } from './shelter-dashboard.service';
import { UpdateShelterProfileDto } from './dto/update-shelter-profile.dto';
import { PetsService } from '../pets/pets.service';
import { CreatePetDto } from '../pets/dto/create-pet.dto';
import { UpdatePetDto } from '../pets/dto/update-pet.dto';

@Controller('shelter-dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, ShelterGuard)
@Roles(Role.SHELTER)
export class ShelterDashboardController {
  constructor(
    private readonly service: ShelterDashboardService,
    private readonly petsService: PetsService,
  ) {}

  @Get('profile')
  getProfile(@User('shelterId') shelterId: string) {
    return this.service.getMyProfile(shelterId);
  }

  @Patch('profile')
  updateProfile(@User('shelterId') shelterId: string, @Body() dto: UpdateShelterProfileDto) {
    return this.service.updateMyProfile(shelterId, dto);
  }

  @Get('pets/:id')
  async getPetById(@User('id') userId: string, @Param('id') id: string) {
    const pet = await this.petsService.getPetById(id, userId);
    return { ...pet, code: pet.idSetByShelter }; // alias để PetForm.tsx không cần sửa
  }

  @Get('pets')
  getPets(@User('shelterId') shelterId: string, @Query() q: any) {
    return this.service.getMyPets(shelterId, q);
  }

  @Post('pets')
  createPet(@User('id') userId: string, @Body() dto: CreatePetDto) {
    return this.petsService.createPet(userId, dto);
  }

  @Patch('pets/:id')
  updatePet(@User('id') userId: string, @Param('id') id: string, @Body() dto: UpdatePetDto) {
    return this.petsService.updatePet(userId, id, dto);
  }

  @Delete('pets/:id')
  deletePet(@User('id') userId: string, @Param('id') id: string) {
    return this.petsService.removePet(userId, id);
  }

  @Get('applications')
  getApplications(@User('shelterId') shelterId: string, @Query() q: any) {
    return this.service.getMyApplications(shelterId, q);
  }

  @Patch('applications/:id/status')
  moveApplication(@User('shelterId') shelterId: string, @Param('id') id: string, @Body() body: any) {
    return this.service.moveApplication(shelterId, id, body.status, body.reviewNote);
  }
}