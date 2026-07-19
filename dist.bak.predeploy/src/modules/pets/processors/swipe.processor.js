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
exports.SwipeProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
let SwipeProcessor = class SwipeProcessor extends bullmq_1.WorkerHost {
    prisma;
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }
    async process(job) {
        const { userId, petId, action } = job.data;
        try {
            await this.prisma.petInteraction.upsert({
                where: {
                    userId_petId: { userId, petId },
                },
                update: {
                    action: action,
                },
                create: {
                    userId: userId,
                    petId: petId,
                    action: action,
                },
            });
        }
        catch (error) {
            console.error(`[SwipeProcessor] Lỗi khi xử lý swipe userId: ${userId}, petId: ${petId}`, error);
            throw error;
        }
    }
};
exports.SwipeProcessor = SwipeProcessor;
exports.SwipeProcessor = SwipeProcessor = __decorate([
    (0, bullmq_1.Processor)('swipe-queue'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SwipeProcessor);
//# sourceMappingURL=swipe.processor.js.map