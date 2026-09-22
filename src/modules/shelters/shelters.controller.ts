import { Controller, Get, Post, Delete, Param, Query, UseGuards, Req, ParseFloatPipe, DefaultValuePipe, ParseIntPipe, Body } from '@nestjs/common';
import { SheltersService } from './shelters.service';
import { GetSheltersDto } from './dto/get-shelters.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { User } from 'src/common/decorators/user.decorator';
import { Public } from 'src/common/decorators/public.decorator'; // Giả sử bạn có decorator này cho public routes
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';

@Controller('shelters')
export class SheltersController {
  constructor(private readonly sheltersService: SheltersService) { }

  @Public()
  @Get(':id/organizer-profile')
  async getOrganizerProfile(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    return this.sheltersService.getOrganizerProfile(id, userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@Query() query: GetSheltersDto, @User('id') userId?: string) {
    return this.sheltersService.findAll(query, userId);
  }


  @UseGuards(OptionalJwtAuthGuard)
  @Get('nearby')
  getNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @User('id') userId?: string,
  ) {
    return this.sheltersService.getSheltersNearBy(lat, lng, limit, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('followed')
  getFollowedShelters(@User('id') userId: string) {
    // Gọi đến service để xử lý logic lấy danh sách (bạn cần viết hàm này trong sheltersService)
    return this.sheltersService.getFollowedSheltersByUser(userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @User('id') userId?: string) {
    return this.sheltersService.findOne(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/block')
  async block(@Param('id') id: string, @User('id') userId: string) {
    return this.sheltersService.blockShelter(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async report(
    @Param('id') id: string,
    @User('id') userId: string,
    @Body() reportData: { reason: string; detail?: string; isBlockRequested?: boolean }
  ) {
    return this.sheltersService.reportShelter(id, userId, reportData);
  }


  @UseGuards(JwtAuthGuard) // Yêu cầu đăng nhập để follow
  @Post(':id/follow')
  follow(@Param('id') id: string, @User('id') userId: string) {
    return this.sheltersService.follow(id, userId);
  }

  @UseGuards(JwtAuthGuard) // Yêu cầu đăng nhập để unfollow
  @Delete(':id/follow')
  unfollow(@Param('id') id: string, @User('id') userId: string) {
    return this.sheltersService.unfollow(id, userId);
  }


  @UseGuards(JwtAuthGuard)
  @Post(':id/toggle-follow')
  toggleFollow(@Param('id') id: string, @User('id') userId: string) {
    return this.sheltersService.toggleFollow(id, userId);
  }
}