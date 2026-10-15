import { Controller, Get, Param, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { PetsService } from './pets.service';

@Public()
@Controller('public/pets')
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class PublicPetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get()
  list(@Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number, @Query('species') species?: string) {
    return this.petsService.getPublicPets(Math.min(limit, 500), species);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.petsService.getPetById(id, undefined, true);
  }
}