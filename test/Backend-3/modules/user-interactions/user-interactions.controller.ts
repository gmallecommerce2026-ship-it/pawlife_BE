import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { UserInteractionsService } from './user-interactions.service';
import { SwipeAction } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt.guard'; 

@Controller('interactions')
@UseGuards(JwtAuthGuard) 
export class UserInteractionsController {
  constructor(private readonly interactionsService: UserInteractionsService) {}

  @Post('swipe')
  async swipe(
    @Request() req, 
    @Body('petId') petId: string, 
    @Body('action') action: SwipeAction
  ) {
    // Tạm thời hardcode userId nếu chưa gắn Auth Guard, 
    // Khi có Auth Guard, dùng req.user.id
    const userId = req.user?.id || 'TEST_USER_ID'; 
    const data = await this.interactionsService.swipePet(userId, petId, action);
    return { success: true, data };
  }

  @Post('favorite')
  async toggleFavorite(
    @Request() req, 
    @Body('petId') petId: string
  ) {
    const userId = req.user?.id || 'TEST_USER_ID';
    const data = await this.interactionsService.toggleFavorite(userId, petId);
    return { success: true, data };
  }

  @Post('follow-shelter')
  async toggleFollow(
    @Request() req, 
    @Body('shelterId') shelterId: string
  ) {
    const userId = req.user?.id || 'TEST_USER_ID';
    const data = await this.interactionsService.toggleFollowShelter(userId, shelterId);
    return { success: true, data };
  }
}