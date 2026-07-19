"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2Service = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const config_1 = require("@nestjs/config");
const uuid_1 = require("uuid");
let R2Service = class R2Service {
    configService;
    s3Client;
    bucketName;
    publicDomain;
    constructor(configService) {
        this.configService = configService;
        this.bucketName = this.configService.get('R2_BUCKET_NAME') ?? '';
        this.publicDomain = this.configService.get('R2_PUBLIC_DOMAIN') ?? '';
        const accountId = this.configService.get('R2_ACCOUNT_ID') ?? '';
        const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID') ?? '';
        const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY') ?? '';
        this.s3Client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
            forcePathStyle: true,
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
    }
    async generatePresignedUrl(fileName, fileType, folder = 'products') {
        try {
            const fileExtension = fileName.split('.').pop();
            const safeFileName = (0, uuid_1.v4)();
            const key = `${folder}/${safeFileName}.${fileExtension}`;
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                ContentType: fileType,
            });
            const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn: 300 });
            return {
                uploadUrl,
                fileUrl: `${this.publicDomain}/${key}`,
            };
        }
        catch (error) {
            console.error('R2 Presigned Error:', error);
            throw new common_1.InternalServerErrorException('Could not generate upload URL');
        }
    }
    async uploadBuffer(buffer, key, contentType = 'application/octet-stream') {
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            });
            await this.s3Client.send(command);
            console.log(`✅ Uploaded backup to R2: ${key}`);
            return key;
        }
        catch (error) {
            console.error('R2 Backup Upload Error:', error);
            throw new common_1.InternalServerErrorException('Could not upload backup to R2');
        }
    }
    async deleteFile(key) {
        try {
            let cleanKey = key;
            if (key.includes(this.publicDomain)) {
                cleanKey = key.replace(`${this.publicDomain}/`, '');
            }
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: cleanKey,
            });
            await this.s3Client.send(command);
        }
        catch (error) {
            console.error('R2 Delete Error (Ignored):', error);
        }
    }
};
exports.R2Service = R2Service;
exports.R2Service = R2Service = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], R2Service);
//# sourceMappingURL=r2.service.js.map