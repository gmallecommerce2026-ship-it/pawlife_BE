import { BadRequestException, Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ProceduresService } from './procedures.service';

@Controller('procedures')
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) { }

  @Get('countries')
  async getAllCountries() {
    return this.proceduresService.getAllCountries();
  }

  @Get(':countryId/milestones')
  async getMilestones(@Param('countryId') countryId: string) {
    return this.proceduresService.getCountryMilestones(countryId);
  }

  @Patch('countries/:id/gallery')
  async updateCountryGallery(
    @Param('id') id: string,          // 👉 BẮT BUỘC là 'id' để khớp với :id trên route
    @Body('images') images: string[], // 👉 BẮT BUỘC là 'images' để khớp với { images: [...] } từ FE
  ) {
    if (!id || id === 'undefined') {
      throw new BadRequestException('ID quốc gia không hợp lệ');
    }
    if (!images || !Array.isArray(images)) {
      throw new BadRequestException('Danh sách ảnh (images) không hợp lệ');
    }
    return this.proceduresService.updateCountryGallery(id, images);
  }

  @Get(':countryId/documents')
  async getDocuments(@Param('countryId') countryId: string) {
    return this.proceduresService.getCountryDocuments(countryId);
  }
}