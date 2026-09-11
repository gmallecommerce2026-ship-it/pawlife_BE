import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest để không ném ngoại lệ 401 nếu chưa có token / token không hợp lệ
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      return null;
    }
    return user;
  }
}