import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * ⚠️ ADAPT — Mình không thấy cấu trúc user/role của bạn nên guard hỗ trợ 2 cách (cái nào khớp thì dùng):
 *  1) req.user.role ∈ ADMIN | SUPER_ADMIN | MODERATOR
 *  2) Whitelist id trong .env:  PLACE_MODERATOR_IDS=id1,id2
 * Chạy sau JwtAuthGuard (đã có req.user).
 */
@Injectable()
export class PlaceModeratorGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user;
    if (!user) throw new UnauthorizedException();

    const role = String(user.role ?? '').toUpperCase();
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'];
    const ids = (process.env.PLACE_MODERATOR_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

    if (allowedRoles.includes(role) || ids.includes(String(user.id))) return true;

    throw new ForbiddenException({
      message: 'You do not have permission to moderate places.',
      i18n: { key: 'error.forbidden' },
    });
  }
}