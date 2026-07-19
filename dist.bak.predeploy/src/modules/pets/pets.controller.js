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
exports.PetsController = void 0;
const common_1 = require("@nestjs/common");
const pets_service_1 = require("./pets.service");
const swipe_pet_dto_1 = require("./dto/swipe-pet.dto");
const get_favorites_dto_1 = require("./dto/get-favorites.dto");
const jwt_guard_1 = require("../auth/guards/jwt.guard");
const user_decorator_1 = require("../../common/decorators/user.decorator");
const client_1 = require("@prisma/client");
const create_pet_dto_1 = require("./dto/create-pet.dto");
const update_pet_dto_1 = require("./dto/update-pet.dto");
const throttler_1 = require("@nestjs/throttler");
const toggle_lost_mode_dto_1 = require("./dto/toggle-lost-mode.dto");
const replace_qr_dto_1 = require("./dto/replace-qr.dto");
let PetsController = class PetsController {
    petsService;
    constructor(petsService) {
        this.petsService = petsService;
    }
    async linkQrCode(userId, petId, tagId) {
        return this.petsService.linkQrCode(userId, petId, tagId);
    }
    async requestTransfer(petId, body, req) {
        return this.petsService.requestTransfer(petId, body, req.user.id);
    }
    async cancelTransfer(petId, userId) {
        return this.petsService.cancelTransfer(petId, userId);
    }
    async confirmTransfer(transferId, req) {
        return this.petsService.confirmTransfer(transferId, req.user.id);
    }
    async getFeed(userId, limit, gender, size, species, lat, lng) {
        const latitude = lat ? parseFloat(lat) : undefined;
        const longitude = lng ? parseFloat(lng) : undefined;
        return this.petsService.getFeed(userId, limit, { gender, size, species }, latitude, longitude);
    }
    async getFavorites(userId, query) {
        const skip = query.skip || 0;
        const take = query.take || 10;
        return this.petsService.getFavorites(userId, skip, take);
    }
    async swipePet(userId, petId, swipePetDto) {
        return this.petsService.swipePet(userId, petId, swipePetDto);
    }
    async addFavorite(userId, petId) {
        return this.petsService.addFavorite(userId, petId);
    }
    async removeFavorite(userId, petId) {
        return this.petsService.removeFavorite(userId, petId);
    }
    async getMyPets(userId) {
        return this.petsService.getMyPets(userId);
    }
    async createPet(userId, createPetDto) {
        return this.petsService.createPet(userId, createPetDto);
    }
    async replaceQrCode(req, petId, replaceQrDto) {
        const userId = req.user.id;
        return this.petsService.replaceQrCode(userId, petId, replaceQrDto);
    }
    async getPetById(userId, id) {
        return this.petsService.getPetById(id, userId);
    }
    async searchPets(search, type, limit) {
        return this.petsService.searchPets({ search, type, limit });
    }
    async updatePet(userId, petId, updatePetDto) {
        return this.petsService.updatePet(userId, petId, updatePetDto);
    }
    async removePet(userId, petId) {
        return this.petsService.removePet(userId, petId);
    }
    async toggleLostMode(req, id, dto) {
        console.log("BACKEND NHẬN ĐƯỢC DTO:", dto);
        return this.petsService.toggleLostMode(req.user.id, id, dto);
    }
};
exports.PetsController = PetsController;
__decorate([
    (0, common_1.Post)(':id/link-qr'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('tagId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "linkQrCode", null);
__decorate([
    (0, common_1.Post)(':id/transfer-request'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "requestTransfer", null);
__decorate([
    (0, common_1.Post)(':id/cancel-transfer'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "cancelTransfer", null);
__decorate([
    (0, common_1.Post)('transfer-confirm/:transferId'),
    __param(0, (0, common_1.Param)('transferId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "confirmTransfer", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 120, ttl: 60000 } }),
    (0, common_1.Get)('feed'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(15), common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('gender')),
    __param(3, (0, common_1.Query)('size')),
    __param(4, (0, common_1.Query)('species')),
    __param(5, (0, common_1.Query)('lat')),
    __param(6, (0, common_1.Query)('lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "getFeed", null);
__decorate([
    (0, common_1.Get)('favorites'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, get_favorites_dto_1.GetFavoritesDto]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "getFavorites", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 150, ttl: 60000 } }),
    (0, common_1.Post)(':id/swipe'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, swipe_pet_dto_1.SwipePetDto]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "swipePet", null);
__decorate([
    (0, common_1.Post)(':id/favorite'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "addFavorite", null);
__decorate([
    (0, common_1.Delete)(':id/favorite'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "removeFavorite", null);
__decorate([
    (0, common_1.Get)('my-pets'),
    __param(0, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "getMyPets", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_pet_dto_1.CreatePetDto]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "createPet", null);
__decorate([
    (0, common_1.Patch)(':id/replace-qr'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, replace_qr_dto_1.ReplaceQrDto]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "replaceQrCode", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "getPetById", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('limit', new common_1.DefaultValuePipe(20), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "searchPets", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_pet_dto_1.UpdatePetDto]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "updatePet", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "removePet", null);
__decorate([
    (0, common_1.Patch)(':id/lost-mode'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, toggle_lost_mode_dto_1.ToggleLostModeDto]),
    __metadata("design:returntype", Promise)
], PetsController.prototype, "toggleLostMode", null);
exports.PetsController = PetsController = __decorate([
    (0, common_1.Controller)('pets'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [pets_service_1.PetsService])
], PetsController);
//# sourceMappingURL=pets.controller.js.map