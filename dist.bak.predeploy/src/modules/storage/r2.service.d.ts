import { ConfigService } from '@nestjs/config';
export declare class R2Service {
    private configService;
    private s3Client;
    private bucketName;
    private publicDomain;
    constructor(configService: ConfigService);
    generatePresignedUrl(fileName: string, fileType: string, folder?: string): Promise<{
        uploadUrl: string;
        fileUrl: string;
    }>;
    uploadBuffer(buffer: Buffer, key: string, contentType?: string): Promise<string>;
    deleteFile(key: string): Promise<void>;
}
