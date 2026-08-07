import { IsString, IsBoolean, IsNumber, IsOptional, IsObject } from 'class-validator';

export class UpsertAdoptionApplicationDto {
  @IsString()
  fullName: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  zalo?: string;

  @IsOptional()
  @IsString()
  adoptFor?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  housing?: string;

  @IsOptional()
  @IsString()
  children?: string;

  @IsOptional()
  @IsString()
  cage?: string;

  @IsOptional()
  @IsString()
  petExperience?: string;

  @IsOptional()
  @IsString()
  prevPetHistory?: string;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @IsOptional()
  @IsString()
  adoptionReason?: string;

  @IsOptional()
  @IsObject()
  commitments?: {
    vaccine?: string;
    medical?: string;
    expenses?: string;
    updateStatus?: string;
    homeVisit?: string;
    provideID?: string;
  };
}

export class CreateAppointmentDto {
  @IsString()
  requestId: string;

  @IsString()
  scheduledAt: string; // ISO String

  @IsOptional()
  @IsString()
  notes?: string;
}