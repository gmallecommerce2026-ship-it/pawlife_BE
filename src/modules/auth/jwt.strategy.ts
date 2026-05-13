import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

const extractJwtFromCookie = (req: Request) => {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super_secret_key',
    });
  }

  async validate(payload: any) {
    if (!payload.userId) {
        console.error('[JwtStrategy] Token invalid: missing userId');
        throw new UnauthorizedException('Token không hợp lệ');
    }

    // 1. TIN TƯỞNG HOÀN TOÀN VÀO PAYLOAD (KHÔNG GỌI REDIS/DB Ở ĐÂY)
    // Cực kỳ nhẹ, tốc độ xử lý < 0.1ms cho mọi request
    return {
        id: payload.userId,
        email: payload.email, // Cần đảm bảo lúc sign token có truyền email vào payload
        role: payload.role || 'USER', 
        sessionId: payload.sessionId,
    };
  }
}