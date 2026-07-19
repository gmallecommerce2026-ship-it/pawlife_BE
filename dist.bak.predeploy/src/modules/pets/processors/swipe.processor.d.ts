import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma/prisma.service';
export declare class SwipeProcessor extends WorkerHost {
    private readonly prisma;
    constructor(prisma: PrismaService);
    process(job: Job<any>): Promise<void>;
}
