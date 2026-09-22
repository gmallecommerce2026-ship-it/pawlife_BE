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
exports.TagsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const client_1 = require("@prisma/client");
const notifications_service_1 = require("../notifications/notifications.service");
const redis_service_1 = require("../../database/redis/redis.service");
function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
function generateFakePointInRadius(lat, lng, radiusMeters, seed) {
    const safeRadius = Math.max(radiusMeters, 500);
    const r1 = seededRandom(seed + '_A');
    const r2 = seededRandom(seed + '_B');
    const angle = 2 * Math.PI * r1;
    const distance = safeRadius * Math.sqrt(r2);
    const latOffset = (distance * Math.cos(angle)) / 111_320;
    const lngOffset = (distance * Math.sin(angle)) / (111_320 * Math.cos(lat * (Math.PI / 180)));
    return { lat: lat + latOffset, lng: lng + lngOffset };
}
let TagsService = class TagsService {
    prisma;
    notificationsService;
    redisService;
    LOST_TAGS_KEY = 'tags:locations:lost';
    constructor(prisma, notificationsService, redisService) {
        this.prisma = prisma;
        this.notificationsService = notificationsService;
        this.redisService = redisService;
    }
    async getTagReportDetail(id, currentUserId) {
        const report = await this.prisma.tagReport.findUnique({
            where: { id },
            include: {
                tag: { include: { pet: { include: { owner: true, images: true } } } }
            },
        });
        if (!report)
            throw new common_1.NotFoundException('Không tìm thấy báo cáo quét thẻ này.');
        const scanHistory = await this.prisma.tagReport.findMany({
            where: { tagId: report.tagId, id: { not: report.id } },
            orderBy: { scannedAt: 'desc' }
        });
        const radius = report.radius || 0;
        const isOwner = currentUserId && currentUserId === report.tag?.pet?.ownerId;
        const isMainScanner = currentUserId && currentUserId === report.userId;
        let finalLat = report.latitude;
        let finalLng = report.longitude;
        let isExactLocation = !!isMainScanner;
        if (!isExactLocation && radius > 0 && report.latitude && report.longitude) {
            const fakePoint = generateFakePointInRadius(report.latitude, report.longitude, radius, `scan_${report.id}`);
            finalLat = fakePoint.lat;
            finalLng = fakePoint.lng;
        }
        const processedScanHistory = scanHistory.map(hist => {
            const isHistScanner = currentUserId && currentUserId === hist.userId;
            const canViewHistExact = isHistScanner;
            if (canViewHistExact || !hist.radius || !hist.latitude || !hist.longitude) {
                return { ...hist, isEstimated: false };
            }
            const fakeHistPoint = generateFakePointInRadius(hist.latitude, hist.longitude, hist.radius, `scan_${hist.id}`);
            return {
                ...hist,
                latitude: fakeHistPoint.lat,
                longitude: fakeHistPoint.lng,
                isEstimated: true
            };
        });
        return {
            ...report,
            latitude: finalLat,
            longitude: finalLng,
            radius: radius,
            isExactLocation,
            isOwner,
            scanHistory: processedScanHistory
        };
    }
    async createTagReport(data, currentUserId) {
        const { tagId, ...reportData } = data;
        const lat = Number(reportData.lat ?? reportData.latitude);
        const lng = Number(reportData.lng ?? reportData.longitude);
        const report = await this.prisma.tagReport.create({
            data: {
                tagId: tagId,
                userId: currentUserId,
                latitude: lat,
                longitude: lng,
                radius: reportData.radius,
                scannedBy: reportData.scannedBy,
                phoneNumber: reportData.phoneNumber,
                message: reportData.message,
                images: reportData.images,
            },
            include: { tag: { include: { pet: { include: { owner: true } } } } },
        });
        if (report.tag.status === client_1.TagStatus.LOST && lat && lng) {
            await this.redisService.addLocation(this.LOST_TAGS_KEY, lng, lat, tagId);
        }
        await this.notificationsService.notifyOwner(report);
        return report;
    }
    async resolveTagReport(reportId) {
        const report = await this.prisma.tagReport.findUnique({ where: { id: reportId } });
        if (!report)
            throw new common_1.NotFoundException('Không tìm thấy báo cáo quét thẻ này.');
        await this.redisService.removeLocation(this.LOST_TAGS_KEY, report.tagId);
        return this.prisma.tagReport.update({
            where: { id: reportId },
            data: { status: 'RESOLVED' },
        });
    }
    async getNearbyLostPets(lat, lng, radiusKm = 5) {
        const roundedLat = lat.toFixed(2);
        const roundedLng = lng.toFixed(2);
        const cacheKey = `tags:nearby:lat_${roundedLat}:lng_${roundedLng}:radius_${radiusKm}`;
        const cachedData = await this.redisService.get(cacheKey);
        if (cachedData)
            return cachedData;
        const nearbyTagIds = await this.redisService.getNearby(this.LOST_TAGS_KEY, Number(lng), Number(lat), Number(radiusKm));
        if (!nearbyTagIds || nearbyTagIds.length === 0)
            return [];
        const tags = await this.prisma.tag.findMany({
            where: {
                id: { in: nearbyTagIds },
                status: client_1.TagStatus.LOST
            },
            include: {
                pet: {
                    include: { images: true, owner: { select: { name: true, phone: true } } }
                }
            }
        });
        const result = tags.map(tag => ({
            tagId: tag.id,
            pet: tag.pet,
        }));
        await this.redisService.set(cacheKey, result, 600);
        return result;
    }
    async scanTag(tagId) {
        const tag = await this.prisma.tag.findUnique({
            where: { id: tagId },
            include: { pet: { include: { owner: true, images: true } } },
        });
        if (!tag || !tag.pet)
            throw new common_1.NotFoundException('Không tìm thấy thông tin vòng cổ hoặc thú cưng.');
        const pet = tag.pet;
        const isLost = tag.status === client_1.TagStatus.LOST;
        return {
            id: pet.id,
            name: pet.name,
            breed: pet.breed || 'Chưa cập nhật',
            gender: pet.gender || 'unknown',
            color: pet.color || 'Chưa cập nhật',
            dob: pet.dob,
            status: isLost ? 'lost' : 'safe',
            image: pet.images && pet.images.length > 0 ? pet.images[0].url : 'https://via.placeholder.com/600',
            owner: isLost ? {
                name: pet.lostContactName || pet.owner?.name || 'Người dùng ẩn danh',
                phone: pet.lostContactPhone || pet.owner?.phone || 'Chưa cung cấp số điện thoại',
                address: pet.lostContactAddress || 'Chưa cập nhật địa chỉ',
                avatarUrl: pet.owner?.avatarUrl || null,
            } : null,
            note: pet.lostDetails || "Please contact me ASAP",
        };
    }
};
exports.TagsService = TagsService;
exports.TagsService = TagsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        redis_service_1.RedisService])
], TagsService);
//# sourceMappingURL=tags.service.js.map