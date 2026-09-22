import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

// If you have defined this enum in Prisma (e.g.: enum SwipeAction { LIKE PASS }) 
// you can import it directly from @prisma/client. Here I created a TS enum for temporary use.
export enum SwipeAction {
  LIKE = 'LIKE',
  PASS = 'PASS',
}

export class SwipePetDto {
  @IsEnum(SwipeAction, { message: 'Action must be LIKE or PASS' })
  @IsNotEmpty()
  action: SwipeAction;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  radius?: number;
}