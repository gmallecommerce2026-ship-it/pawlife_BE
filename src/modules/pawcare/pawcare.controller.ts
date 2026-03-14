import { Controller, Get, Query } from '@nestjs/common';
import { PawcareService } from './pawcare.service';

@Controller('pawcare')
export class PawcareController {
  constructor(private readonly pawcareService: PawcareService) {}

  @Get('videos')
  getVideos(@Query('category') category: string) {
    return this.pawcareService.getVideosByCategory(category);
  }

  @Get('playlists')
  getPlaylists(@Query('category') category: string) {
    return this.pawcareService.getPlaylistsByCategory(category);
  }
}