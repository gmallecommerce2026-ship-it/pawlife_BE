import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddApplicationTagDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên tag không được để trống' })
  @MinLength(1, { message: 'Tên tag tối thiểu 1 ký tự' })
  @MaxLength(50, { message: 'Tên tag không được vượt quá 50 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;
}