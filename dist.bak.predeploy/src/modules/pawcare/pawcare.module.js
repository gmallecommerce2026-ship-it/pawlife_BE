"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PawcareModule = void 0;
const common_1 = require("@nestjs/common");
const pawcare_controller_1 = require("./pawcare.controller");
const pawcare_service_1 = require("./pawcare.service");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const redis_module_1 = require("../../database/redis/redis.module");
let PawcareModule = class PawcareModule {
};
exports.PawcareModule = PawcareModule;
exports.PawcareModule = PawcareModule = __decorate([
    (0, common_1.Module)({
        imports: [redis_module_1.RedisModule],
        controllers: [pawcare_controller_1.PawcareController],
        providers: [pawcare_service_1.PawcareService, prisma_service_1.PrismaService],
    })
], PawcareModule);
//# sourceMappingURL=pawcare.module.js.map