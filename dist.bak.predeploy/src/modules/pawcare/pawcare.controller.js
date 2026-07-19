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
exports.PawcareController = void 0;
const common_1 = require("@nestjs/common");
const pawcare_service_1 = require("./pawcare.service");
let PawcareController = class PawcareController {
    pawcareService;
    constructor(pawcareService) {
        this.pawcareService = pawcareService;
    }
    getVideos(category) {
        return this.pawcareService.getVideosByCategory(category);
    }
    getPlaylists(category) {
        return this.pawcareService.getPlaylistsByCategory(category);
    }
};
exports.PawcareController = PawcareController;
__decorate([
    (0, common_1.Get)('videos'),
    __param(0, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PawcareController.prototype, "getVideos", null);
__decorate([
    (0, common_1.Get)('playlists'),
    __param(0, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PawcareController.prototype, "getPlaylists", null);
exports.PawcareController = PawcareController = __decorate([
    (0, common_1.Controller)('pawcare'),
    __metadata("design:paramtypes", [pawcare_service_1.PawcareService])
], PawcareController);
//# sourceMappingURL=pawcare.controller.js.map