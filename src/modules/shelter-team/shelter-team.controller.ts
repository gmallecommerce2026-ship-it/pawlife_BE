import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User } from '../../common/decorators/user.decorator';
import { ShelterTeamService } from './shelter-team.service';
import { InviteMemberDto, UpdateMemberRoleDto, AcceptInvitationDto } from './dto/shelter-team.dto';

@Controller('shelter-dashboard/team')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SHELTER)
export class ShelterTeamController {
  constructor(private readonly shelterTeamService: ShelterTeamService) { }
  @Get('me')
  async getMe(@User('id') userId: string) {
    const data = await this.shelterTeamService.getMe(userId);
    return { success: true, data };
  }

  @Patch('me')
  async updateMe(@User('id') userId: string, @Body() dto: UpdateOwnProfileDto) {
    const data = await this.shelterTeamService.updateOwnProfile(userId, dto);
    return { success: true, data };
  }
  @Get()
  async getTeam(@User('shelterId') shelterId: string) {
    const data = await this.shelterTeamService.getTeam(shelterId);
    return { success: true, data };
  }

  @Post('invite')
  async inviteMember(
    @User('shelterId') shelterId: string,
    @User('id') inviterId: string,
    @Body() dto: InviteMemberDto,
  ) {
    const data = await this.shelterTeamService.inviteMember(shelterId, inviterId, dto);
    return { success: true, data };
  }

  @Patch(':userId/role')
  async updateMemberRole(
    @User('shelterId') shelterId: string,
    @User('id') requesterId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const data = await this.shelterTeamService.updateMemberRole(shelterId, requesterId, userId, dto.role);
    return { success: true, data };
  }

  @Delete(':userId')
  async removeMember(
    @User('shelterId') shelterId: string,
    @User('id') requesterId: string,
    @Param('userId') userId: string,
  ) {
    await this.shelterTeamService.removeMember(shelterId, requesterId, userId);
    return { success: true, message: 'Đã xoá thành viên khỏi trạm.' };
  }

  @Delete('invitations/:invitationId')
  async cancelInvitation(
    @User('shelterId') shelterId: string,
    @User('id') requesterId: string,
    @Param('invitationId') invitationId: string,
  ) {
    await this.shelterTeamService.cancelInvitation(shelterId, requesterId, invitationId);
    return { success: true, message: 'Đã thu hồi lời mời.' };
  }
}

// Controller riêng, KHÔNG guard — dùng cho người được mời (chưa đăng nhập)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly shelterTeamService: ShelterTeamService) { }

  @Get(':token')
  async getInvitation(@Param('token') token: string) {
    const data = await this.shelterTeamService.getInvitationByToken(token);
    return { success: true, data };
  }

  @Post(':token/accept')
  async acceptInvitation(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    const data = await this.shelterTeamService.acceptInvitation(token, dto);
    return { success: true, data };
  }
}