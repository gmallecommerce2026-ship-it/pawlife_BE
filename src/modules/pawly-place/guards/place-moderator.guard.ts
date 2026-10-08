import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

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