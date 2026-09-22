import { R2Service } from './r2.service';
import { GetPresignedUrlDto } from './dto/storage.dto';
export declare class StorageController {
    private readonly r2Service;
    constructor(r2Service: R2Service);
    getPresignedUrl(body: {
        fileName: string;
        fileType: string;
    }): Promise<{
        uploadUrl: string;
        fileUrl: string;
    }>;
    getUploadUrl(body: GetPresignedUrlDto): Promise<{
        uploadUrl: string;
        fileUrl: string;
    }>;
}
