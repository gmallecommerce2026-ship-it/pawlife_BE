// src/modules/pets/dto/update-pet.dto.ts
import { PartialType } from '@nestjs/mapped-types'; // Hoặc từ '@nestjs/swagger' nếu bạn dùng swagger
import { CreatePetDto } from './create-pet.dto';

export class UpdatePetDto extends PartialType(CreatePetDto) {}