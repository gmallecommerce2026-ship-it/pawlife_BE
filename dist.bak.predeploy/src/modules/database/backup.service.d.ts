import { ConfigService } from '@nestjs/config';
import { R2Service } from '../storage/r2.service';
export declare class BackupService {
    private readonly configService;
    private readonly r2Service;
    private readonly logger;
    constructor(configService: ConfigService, r2Service: R2Service);
    handleDatabaseBackup(): Promise<void>;
}
