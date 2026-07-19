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
exports.SheltersController = void 0;
const common_1 = require("@nestjs/common");
const shelters_service_1 = require("./shelters.service");
const get_shelters_dto_1 = require("./dto/get-shelters.dto");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const optional_jwt_guard_1 = require("../auth/guards/optional-jwt.guard");
let SheltersController = class SheltersController {
    sheltersService;
    constructor(sheltersService) {
        this.sheltersService = sheltersService;
    }
    async getOrganizerProfile(id, userId) {
        return this.sheltersService.getOrganizerProfile(id, userId);
    }
    findAll(query) {
        return this.sheltersService.findAll(query);
    }
    getNearby(lat, lng, limit) {
        return this.sheltersService.getSheltersNearBy(lat, lng, limit);
    }
    getFollowedShelters(userId) {
        return this.sheltersService.getFollowedSheltersByUser(userId);
    }
    findOne(id, userId) {
        return this.sheltersService.findOne(id, userId);
    }
    follow(id, userId) {
        return this.sheltersService.follow(id, userId);
    }
    unfollow(id, userId) {
        return this.sheltersService.unfollow(id, userId);
    }
    toggleFollow(id, userId) {
        return this.sheltersService.toggleFollow(id, userId);
    }
};
exports.SheltersController = SheltersController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id/organizer-profile'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SheltersController.prototype, "getOrganizerProfile", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_shelters_dto_1.GetSheltersDto]),
    __metadata("design:returntype", void 0)
], SheltersController.prototype, "findAll", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('nearby'),
    __param(0, (0, common_1.Query)('lat', common_1.ParseFloatPipe)),
    __param(1, (0, common_1.Query)('lng', common_1.ParseFloatPipe)),
    __param(2, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(10), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number]),
    __metadata("design:returntype", void 0)
], SheltersController.prototype, "getNearby", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('followed'),
    __param(0, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SheltersController.prototype, "getFollowedShelters", null);
__decorate([
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SheltersController.prototype, "findOne", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/follow'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SheltersController.prototype, "follow", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id/follow'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SheltersController.prototype, "unfollow", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)(':id/toggle-follow'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SheltersController.prototype, "toggleFollow", null);
exports.SheltersController = SheltersController = __decorate([
    (0, common_1.Controller)('shelters'),
    __metadata("design:paramtypes", [shelters_service_1.SheltersService])
], SheltersController);
//# sourceMappingURL=shelters.controller.js.map