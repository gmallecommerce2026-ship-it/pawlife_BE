import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PetHotelService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCountry(countryId: string) {
    return this.prisma.petHotel.findMany({
      where: { countryId: countryId.toLowerCase() },
      orderBy: { sortOrder: 'asc' },
    });
  }
}