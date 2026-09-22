// src/common/guards/shelter.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class ShelterGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user?.shelterId) {
      throw new ForbiddenException({
        message: 'Tài khoản của bạn không quản lý trạm cứu hộ nào.',
        i18n: { key: 'error.not_a_shelter_manager' },
      });
    }
    return true;
  }
}