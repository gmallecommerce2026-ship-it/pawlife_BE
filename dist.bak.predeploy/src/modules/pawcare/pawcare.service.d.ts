import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
export declare class PawcareService {
    private readonly prisma;
    private readonly redisService;
    constructor(prisma: PrismaService, redisService: RedisService);
    getVideosByCategory(category: string): Promise<any[]>;
    getPlaylistsByCategory(category: string): Promise<any[]>;
}
