import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateStoryDto } from './story.dto';

// Update không cho phép đổi id qua PATCH — id chỉ dùng để xác định record qua param :id
export class UpdateStoryDto extends PartialType(
  OmitType(CreateStoryDto, ['id'] as const),
) {}