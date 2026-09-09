import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ProceduresService } from './procedures.service';

@Controller('procedures')
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Get('countries')
  async getAllCountries() {
    return this.proceduresService.getAllCountries();
  }

  @Get(':countryId/milestones')
  async getMilestones(@Param('countryId') countryId: string) {
    return this.proceduresService.getCountryMilestones(countryId);
  }

  @Patch('countries/:id/gallery')
  async updateCountryGallery(@Param('countryId') countryId: string, images: string[]) {
    return this.proceduresService.updateCountryGallery(countryId, images);
  }

  @Get(':countryId/documents')
  async getDocuments(@Param('countryId') countryId: string) {
    return this.proceduresService.getCountryDocuments(countryId);
  }
}