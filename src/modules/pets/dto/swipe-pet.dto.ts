import { IsEnum, IsNotEmpty } from 'class-validator';

// Nếu bạn đã định nghĩa enum này trong Prisma (ví dụ: enum SwipeAction { LIKE PASS }) 
// thì có thể import trực tiếp từ @prisma/client. Ở đây mình tạo enum TS để dùng tạm.
export enum SwipeAction {
  LIKE = 'LIKE',
  PASS = 'PASS',
}

export class SwipePetDto {
  @IsEnum(SwipeAction, { message: 'Action phải là LIKE hoặc PASS' })
  @IsNotEmpty()
  action: SwipeAction;
}