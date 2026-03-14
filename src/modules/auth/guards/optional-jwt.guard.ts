// src/modules/auth/guards/optional-jwt.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    // Không ném ra lỗi Unauthorized nếu không có token
    // Chỉ trả về user nếu token hợp lệ, ngược lại trả về null
    return user || null;
  }
}