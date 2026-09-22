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
exports.UserInteractionsService = exports.ShareLocationDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
class ShareLocationDto {
    petId;
    lat;
    lng;
    radius;
    scannedBy;
    phoneNumber;
    message;
}
exports.ShareLocationDto = ShareLocationDto;
let UserInteractionsService = class UserInteractionsService {
    prisma;
    notificationsService;
    constructor(prisma, notificationsService) {
        this.prisma = prisma;
        this.notificationsService = notificationsService;
    }
    async shareLocation(dto) {
        const tag = await this.prisma.tag.findFirst({
            where: { petId: dto.petId },
            select: { id: true }
        });
        if (!tag) {
            throw new common_1.NotFoundException('Không tìm thấy Tag (vòng cổ) nào được gắn với thú cưng này');
        }
        const savedReport = await this.prisma.tagReport.create({
            data: {
                tagId: tag.id,
                latitude: dto.lat,
                longitude: dto.lng,
                radius: dto.radius,
                scannedBy: dto.scannedBy,
                phoneNumber: dto.phoneNumber,
                message: dto.message,
            }
        });
        const petOwnerId = await this.getPetOwnerId(dto.petId);
        const notificationPayload = {
            title: 'Vị trí thú cưng của bạn đã được chia sẻ!',
            body: dto.message ? `Lời nhắn: ${dto.message}` : 'Một người nào đó vừa cập nhật vị trí của thú cưng.',
            referenceId: savedReport.id,
            data: {
                type: 'SHARED_LOCATION',
                url: `/tag-report-detail?reportId=${savedReport.id}&lat=${dto.lat}&lng=${dto.lng}&radius=${dto.radius}`,
            },
        };
        if (petOwnerId) {
            await this.notificationsService.sendPushNotification(petOwnerId, notificationPayload);
        }
        return savedReport;
    }
    async getPetOwnerId(petId) {
        const pet = await this.prisma.pet.findUnique({
            where: { id: petId },
            select: { ownerId: true },
        });
        if (!pet || !pet.ownerId) {
            throw new common_1.NotFoundException('Không tìm thấy thông tin thú cưng hoặc chủ sở hữu');
        }
        return pet.ownerId;
    }
    async swipePet(userId, petId, action) {
        const existing = await this.prisma.petInteraction.findUnique({
            where: { userId_petId: { userId, petId } }
        });
        if (existing) {
            throw new common_1.ConflictException('Đã tương tác với thú cưng này');
        }
        return this.prisma.petInteraction.create({
            data: { userId, petId, action }
        });
    }
    async toggleFavorite(userId, petId) {
        const existing = await this.prisma.favoritePet.findUnique({
            where: { userId_petId: { userId, petId } }
        });
        if (existing) {
            await this.prisma.favoritePet.delete({
                where: { id: existing.id }
            });
            return { favorited: false };
        }
        else {
            await this.prisma.favoritePet.create({
                data: { userId, petId }
            });
            return { favorited: true };
        }
    }
    async toggleFollowShelter(userId, shelterId) {
        const existing = await this.prisma.followedShelter.findUnique({
            where: { userId_shelterId: { userId, shelterId } }
        });
        if (existing) {
            await this.prisma.followedShelter.delete({
                where: { id: existing.id }
            });
            return { followed: false };
        }
        else {
            await this.prisma.followedShelter.create({
                data: { userId, shelterId }
            });
            return { followed: true };
        }
    }
};
exports.UserInteractionsService = UserInteractionsService;
exports.UserInteractionsService = UserInteractionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService])
], UserInteractionsService);
//# sourceMappingURL=user-interactions.service.js.map