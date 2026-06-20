import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from 'src/database/redis/redis.service';

const extractJwtFromCookie = (req: Request) => {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly redisService: RedisService) {
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
        throw new UnauthorizedException('Invalid token');
    }

    const sessionStatus = await this.redisService.get(`auth:session:${payload.sessionId}`);
    if (!sessionStatus) {
      throw new UnauthorizedException('The login session has expired or has been logged out by another device.');
    }

    // 1. FULLY TRUST THE PAYLOAD (NO REDIS/DB CALLS HERE)
    // Extremely lightweight, processing speed < 0.1ms for every request
    return {
        id: payload.userId,
        email: payload.email, // Make sure to pass the email into the payload when signing the token
        role: payload.role || 'USER', 
        sessionId: payload.sessionId,
    };
  }
}