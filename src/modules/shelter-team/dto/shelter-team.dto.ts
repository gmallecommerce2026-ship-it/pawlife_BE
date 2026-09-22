import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
  @MinLength(6)
  password: string;
}

export class UpdateOwnProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}