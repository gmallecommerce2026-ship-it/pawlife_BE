import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.email !== 'hello@pawlife.vn') {
      throw new ForbiddenException('Chỉ tài khoản admin (hello@pawlife.vn) mới có quyền truy cập chức năng này.');
    }

    return true;
  }
}