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
exports.ApplicationsController = void 0;
const common_1 = require("@nestjs/common");
const applications_service_1 = require("./applications.service");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
const create_application_dto_1 = require("./dto/create-application.dto");
const common_2 = require("@nestjs/common");
let ApplicationsController = class ApplicationsController {
    applicationsService;
    constructor(applicationsService) {
        this.applicationsService = applicationsService;
    }
    async createApplication(userId, createApplicationDto) {
        const data = await this.applicationsService.createApplication(userId, createApplicationDto);
        return { success: true, data };
    }
    async getMyApplications(userId) {
        const data = await this.applicationsService.getMyApplications(userId);
        return { success: true, data };
    }
    async getApplicationById(userId, applicationId) {
        const data = await this.applicationsService.getApplicationById(userId, applicationId);
        return { success: true, data };
    }
    async updateVerificationPhotos(userId, applicationId, photos) {
        if (!photos || photos.length === 0) {
            throw new common_2.BadRequestException('Vui lòng cung cấp ít nhất một ảnh xác minh.');
        }
        const data = await this.applicationsService.updateVerificationPhotos(userId, applicationId, photos);
        return { success: true, message: 'Đã gửi ảnh xác minh thành công', data };
    }
    async withdrawApplication(userId, applicationId) {
        const data = await this.applicationsService.withdrawApplication(userId, applicationId);
        return { success: true, message: 'Đã thu hồi đơn đăng ký thành công', data };
    }
};
exports.ApplicationsController = ApplicationsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_application_dto_1.CreateApplicationDto]),
    __metadata("design:returntype", Promise)
], ApplicationsController.prototype, "createApplication", null);
__decorate([
    (0, common_1.Get)('my-applications'),
    __param(0, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ApplicationsController.prototype, "getMyApplications", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ApplicationsController.prototype, "getApplicationById", null);
__decorate([
    (0, common_1.Patch)(':id/verification-photos'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('photos')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Array]),
    __metadata("design:returntype", Promise)
], ApplicationsController.prototype, "updateVerificationPhotos", null);
__decorate([
    (0, common_1.Patch)(':id/withdraw'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ApplicationsController.prototype, "withdrawApplication", null);
exports.ApplicationsController = ApplicationsController = __decorate([
    (0, common_1.Controller)('applications'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [applications_service_1.ApplicationsService])
], ApplicationsController);
//# sourceMappingURL=applications.controller.js.map