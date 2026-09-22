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
exports.UserInteractionsController = void 0;
const common_1 = require("@nestjs/common");
const user_interactions_service_1 = require("./user-interactions.service");
const client_1 = require("@prisma/client");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
let UserInteractionsController = class UserInteractionsController {
    interactionsService;
    constructor(interactionsService) {
        this.interactionsService = interactionsService;
    }
    async swipe(req, petId, action) {
        const userId = req.user?.id || 'TEST_USER_ID';
        const data = await this.interactionsService.swipePet(userId, petId, action);
        return { success: true, data };
    }
    async toggleFavorite(req, petId) {
        const userId = req.user?.id || 'TEST_USER_ID';
        const data = await this.interactionsService.toggleFavorite(userId, petId);
        return { success: true, data };
    }
    async toggleFollow(req, shelterId) {
        const userId = req.user?.id || 'TEST_USER_ID';
        const data = await this.interactionsService.toggleFollowShelter(userId, shelterId);
        return { success: true, data };
    }
};
exports.UserInteractionsController = UserInteractionsController;
__decorate([
    (0, common_1.Post)('swipe'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)('petId')),
    __param(2, (0, common_1.Body)('action')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "swipe", null);
__decorate([
    (0, common_1.Post)('favorite'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)('petId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "toggleFavorite", null);
__decorate([
    (0, common_1.Post)('follow-shelter'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)('shelterId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UserInteractionsController.prototype, "toggleFollow", null);
exports.UserInteractionsController = UserInteractionsController = __decorate([
    (0, common_1.Controller)('interactions'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [user_interactions_service_1.UserInteractionsService])
], UserInteractionsController);
//# sourceMappingURL=user-interactions.controller.js.map