import { Module } from '@nestjs/common';
import { ShelterTeamService } from './shelter-team.service';
import { ShelterTeamController, InvitationsController } from './shelter-team.controller';

@Module({
  controllers: [ShelterTeamController, InvitationsController],
  providers: [ShelterTeamService],
})
export class ShelterTeamModule {}