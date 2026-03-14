import { Controller, Get, Post, Delete, Param, Query, UseGuards, Req, ParseFloatPipe, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { SheltersService } from './shelters.service';
import { GetSheltersDto } from './dto/get-shelters.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt.guard';
import { User } from 'src/common/decorators/user.decorator';
import { Public } from 'src/common/decorators/public.decorator'; // Giả sử bạn có decorator này cho public routes
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';

@Controller('shelters')
export class SheltersController {
  constructor(private readonly sheltersService: SheltersService) {}

  @Public() // API public cho phép xem danh sách
  @Get()
  findAll(@Query() query: GetSheltersDto) {
    return this.sheltersService.findAll(query);
  }

  @Public()
  @Get('nearby')
  getNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    // Đảm bảo trong sheltersService đã có hàm getSheltersNearBy tương ứng
    return this.sheltersService.getSheltersNearBy(lat, lng, limit);
  }

  @UseGuards(OptionalJwtAuthGuard) 
  @Get(':id')
  findOne(@Param('id') id: string, @User('id') userId?: string) {
    return this.sheltersService.findOne(id, userId);
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