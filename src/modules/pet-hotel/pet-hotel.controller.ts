import { Controller, Get, Param } from '@nestjs/common';
import { PetHotelService } from './pet-hotel.service';

@Controller('pet-hotels')
export class PetHotelController {
  constructor(private readonly petHotelService: PetHotelService) {}

  @Get('by-country/:countryId')
  async getByCountry(@Param('countryId') countryId: string) {
    return this.petHotelService.findByCountry(countryId);
  }
}