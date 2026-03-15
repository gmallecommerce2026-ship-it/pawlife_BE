// src/modules/applications/dto/create-application.dto.ts
import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  petId: string;

  @IsString() @IsNotEmpty() fullName: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() zalo: string;
  @IsString() @IsNotEmpty() adoptFor: string;

  @IsString() @IsNotEmpty() location: string;
  @IsString() @IsNotEmpty() housing: string;
  @IsString() @IsNotEmpty() children: string;
  @IsString() @IsNotEmpty() cage: string;

  @IsString() @IsNotEmpty() petExperience: string;
  @IsString() @IsNotEmpty() prevPetHistory: string;
  @IsString() @IsNotEmpty() employmentStatus: string;
  
  @IsString() @IsNotEmpty() adoptionReason: string;

  @IsObject()
  @IsNotEmpty()
  commitments: Record<string, any>;
}