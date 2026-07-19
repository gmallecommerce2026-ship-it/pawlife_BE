import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
export declare class MailProcessor extends WorkerHost {
    private readonly mailerService;
    private readonly logger;
    constructor(mailerService: MailerService);
    process(job: Job<any, any, string>): Promise<any>;
}
