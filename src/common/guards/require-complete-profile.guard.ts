import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_SKIP_PROFILE_CHECK } from '../decorators/skip-profile-check.decorator';

@Injectable()
export class RequireCompleteProfileGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Kiểm tra xem route này có được gắn @SkipProfileCheck() không
    const isSkip = this.reflector.getAllAndOverride<boolean>(IS_SKIP_PROFILE_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isSkip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Nếu không có user (có thể là public route), để JwtGuard lo
    if (!user) return true; 

    // Kiểm tra thông tin bắt buộc
    if (!user.phone || !user.dob || !user.gender) {
      throw new ForbiddenException({
        statusCode: 4032,
        message: 'PROFILE_INCOMPLETE',
        error: 'Forbidden'
      });
    }

    return true;
  }
}