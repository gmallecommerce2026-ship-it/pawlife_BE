// src/modules/shelter-dashboard/shelter-dashboard.controller.ts
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ShelterGuard } from 'src/common/guards/shelter.guard';
import { User } from 'src/common/decorators/user.decorator';

@Controller('shelter-dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, ShelterGuard)
@Roles(Role.SHELTER)
export class ShelterDashboardController {
  constructor(private readonly service: ShelterDashboardService) {}

  @Get('profile')
  getProfile(@User('shelterId') shelterId: string) {
    return this.service.getMyProfile(shelterId);
  }

  @Patch('profile')
  updateProfile(@User('shelterId') shelterId: string, @Body() dto: UpdateShelterProfileDto) {
    return this.service.updateMyProfile(shelterId, dto);
  }

  @Get('pets')
  getPets(@User('shelterId') shelterId: string, @Query() q: any) {
    return this.service.getMyPets(shelterId, q);
  }

  @Post('pets')
  createPet(@User('shelterId') shelterId: string, @Body() dto: CreateShelterPetDto) {
    return this.service.createPet(shelterId, dto);
  }

  @Patch('pets/:id')
  updatePet(@User('shelterId') shelterId: string, @Param('id') id: string, @Body() dto: UpdateShelterPetDto) {
    return this.service.updatePet(shelterId, id, dto);
  }

  @Delete('pets/:id')
  deletePet(@User('shelterId') shelterId: string, @Param('id') id: string) {
    return this.service.deletePet(shelterId, id);
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