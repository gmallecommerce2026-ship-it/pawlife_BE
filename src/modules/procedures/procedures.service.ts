import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';

@Injectable()
export class ProceduresService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redisService: RedisService,
    ) { }

    async getAllCountries() {
        const cacheKey = 'procedures:countries';
        const cached = await this.redisService.get<any[]>(cacheKey);
        if (cached) return cached;

        const countries = await this.prisma.countryProcedure.findMany({
            orderBy: { sortOrder: 'asc' },
        });

        await this.redisService.set(cacheKey, countries, 3600); // cache 1 giờ
        return countries;
    }

    async getCountryMilestones(countryId: string) {
        const cacheKey = `procedures:milestones:${countryId}`;
        const cached = await this.redisService.get<any[]>(cacheKey);
        if (cached) return cached;

        const milestones = await this.prisma.procedureMilestone.findMany({
            where: { countryId },
            orderBy: { sortOrder: 'asc' },
            include: {
                steps: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        await this.redisService.set(cacheKey, milestones, 3600);
        return milestones;
    }

    async getCountryDocuments(countryId: string) {
        const cacheKey = `procedures:documents:${countryId}`;
        const cached = await this.redisService.get<any[]>(cacheKey);
        if (cached) return cached;

        // Lấy tài liệu của nước này VÀ tài liệu xuất khẩu từ Việt Nam
        const documents = await this.prisma.procedureDocument.findMany({
            where: {
                OR: [
                    { countryId },
                    { category: 'VIETNAM' }, // Tài liệu phía Việt Nam luôn cần cho mọi chuyến bay
                ],
            },
            orderBy: { sortOrder: 'asc' },
        });

        await this.redisService.set(cacheKey, documents, 3600);
        return documents;
    }
}