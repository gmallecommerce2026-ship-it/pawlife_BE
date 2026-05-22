// src/modules/shelters/dto/shelter-response.dto.ts
import { Expose } from 'class-transformer';

export class ShelterResponseDto {
  @Expose()
  id!: string; // Thêm dấu ! ở đây

  @Expose()
  name!: string; // Thêm dấu ! ở đây

  // Luôn luôn map về avatarUrl cho toàn bộ hệ thống
  @Expose()
  avatarUrl!: string; // Thêm dấu ! ở đây

  @Expose()
  coverUrl!: string; // Thêm dấu ! ở đây
}