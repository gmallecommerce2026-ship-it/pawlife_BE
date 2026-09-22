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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const r2_service_1 = require("./r2.service");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const throttler_1 = require("@nestjs/throttler");
const storage_dto_1 = require("./dto/storage.dto");
let StorageController = class StorageController {
    r2Service;
    constructor(r2Service) {
        this.r2Service = r2Service;
    }
    async getPresignedUrl(body) {
        return this.r2Service.generatePresignedUrl(body.fileName, body.fileType);
    }
    async getUploadUrl(body) {
        console.log('--- [STORAGE] NHẬN REQUEST TẠO URL ---', body);
        if (!body || !body.fileType) {
            console.log('❌ Lỗi: Payload Frontend gửi lên bị thiếu fileType!');
            throw new common_1.BadRequestException('Thiếu tham số fileType');
        }
        try {
            const defaultFolder = body.fileType.startsWith('video/') ? 'videos' : 'avatars';
            const folder = body.folder || defaultFolder;
            console.log(`Đang gọi R2 Service với folder: ${folder}...`);
            const result = await this.r2Service.generatePresignedUrl(body.fileName, body.fileType, folder);
            console.log('✅ Tạo URL thành công!');
            return result;
        }
        catch (error) {
            console.error('❌ LỖI KHI GỌI R2 SERVICE:', error);
            throw new common_1.InternalServerErrorException('Không thể kết nối đến Cloudflare R2. Vui lòng kiểm tra lại cấu hình .env');
        }
    }
};
exports.StorageController = StorageController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('presigned'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getPresignedUrl", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, common_1.Post)('presigned-url'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [storage_dto_1.GetPresignedUrlDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getUploadUrl", null);
exports.StorageController = StorageController = __decorate([
    (0, common_1.Controller)('storage'),
    __metadata("design:paramtypes", [r2_service_1.R2Service])
], StorageController);
//# sourceMappingURL=storage.controller.js.map