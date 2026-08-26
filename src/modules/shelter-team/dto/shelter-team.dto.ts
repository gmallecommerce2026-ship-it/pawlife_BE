import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ShelterStaffRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(ShelterStaffRole)
  role: ShelterStaffRole;

  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdateMemberRoleDto {
  @IsEnum(ShelterStaffRole)
  role: ShelterStaffRole;
}

export class AcceptInvitationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(6)
  password: string;
}