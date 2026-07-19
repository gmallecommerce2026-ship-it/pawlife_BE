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
exports.TagsController = void 0;
const common_1 = require("@nestjs/common");
const tags_service_1 = require("./tags.service");
const create_tag_report_dto_1 = require("./dto/create-tag-report.dto");
const optional_jwt_guard_1 = require("../auth/guards/optional-jwt.guard");
let TagsController = class TagsController {
    tagsService;
    constructor(tagsService) {
        this.tagsService = tagsService;
    }
    async getTagReportDetail(id, req) {
        const currentUserId = req.user?.id ?? null;
        return this.tagsService.getTagReportDetail(id, currentUserId);
    }
    async scanTag(tagId) {
        return this.tagsService.scanTag(tagId);
    }
    async createReport(createTagReportDto, req) {
        const currentUserId = req.user?.id ?? null;
        return this.tagsService.createTagReport(createTagReportDto, currentUserId);
    }
    async resolveReport(id) {
        return this.tagsService.resolveTagReport(id);
    }
    async getNearbyLostPets(lat, lng, radius = '5') {
        return this.tagsService.getNearbyLostPets(Number(lat), Number(lng), Number(radius));
    }
};
exports.TagsController = TagsController;
__decorate([
    (0, common_1.Get)('reports/:id'),
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TagsController.prototype, "getTagReportDetail", null);
__decorate([
    (0, common_1.Get)(':tagId/scan'),
    __param(0, (0, common_1.Param)('tagId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TagsController.prototype, "scanTag", null);
__decorate([
    (0, common_1.Post)('report'),
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_tag_report_dto_1.CreateTagReportDto, Object]),
    __metadata("design:returntype", Promise)
], TagsController.prototype, "createReport", null);
__decorate([
    (0, common_1.Patch)('report/:id/resolve'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TagsController.prototype, "resolveReport", null);
__decorate([
    (0, common_1.Get)('nearby'),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __param(2, (0, common_1.Query)('radius')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], TagsController.prototype, "getNearbyLostPets", null);
exports.TagsController = TagsController = __decorate([
    (0, common_1.Controller)('tags'),
    __metadata("design:paramtypes", [tags_service_1.TagsService])
], TagsController);
//# sourceMappingURL=tags.controller.js.map