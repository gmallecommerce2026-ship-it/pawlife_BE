import { Strategy } from 'passport-jwt';
import { RedisService } from 'src/database/redis/redis.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly redisService;
    constructor(redisService: RedisService);
    validate(payload: any): Promise<{
        id: any;
        email: any;
        role: any;
        sessionId: any;
    }>;
}
export {};
