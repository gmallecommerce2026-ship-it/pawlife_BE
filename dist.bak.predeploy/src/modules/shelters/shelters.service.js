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
exports.SheltersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const client_1 = require("@prisma/client");
const notifications_service_1 = require("../notifications/notifications.service");
const redis_service_1 = require("../../database/redis/redis.service");
let SheltersService = class SheltersService {
    prisma;
    notificationsService;
    redisService;
    constructor(prisma, notificationsService, redisService) {
        this.prisma = prisma;
        this.notificationsService = notificationsService;
        this.redisService = redisService;
    }
    async getOrganizerProfile(organizerId, userId) {
        const organizer = await this.prisma.organizer.findUnique({
            where: { id: organizerId },
            include: {
                events: {
                    orderBy: { startDate: 'desc' }
                }
            },
        });
        if (!organizer) {
            throw new common_1.NotFoundException('Không tìm thấy ban tổ chức (Organizer)');
        }
        let isFollowing = false;
        return {
            success: true,
            data: {
                id: organizer.id,
                name: organizer.name,
                handle: organizer.handle || `@${organizer.name.toLowerCase().replace(/\s+/g, '')}`,
                avatar: organizer.avatarUrl || 'https://images.unsplash.com/photo-1517260739337-6799d239ce83?q=80&w=500&auto=format&fit=crop',
                coverImg: organizer.coverUrl || 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=1000&auto=format&fit=crop',
                followers: organizer.followers,
                totalEvents: organizer.events.length,
                about: organizer.about || 'Chưa có thông tin giới thiệu về ban tổ chức này.',
                isFollowing,
                events: organizer.events,
            },
        };
    }
    async findAll(query) {
        const { search, page = 1, limit = 10 } = query;
        const cacheKey = `shelters:all:page_${page}:limit_${limit}:search_${search || 'none'}`;
        const cachedData = await this.redisService.get(cacheKey);
        if (cachedData)
            return cachedData;
        const lockKey = `${cacheKey}:lock`;
        const isLocked = await this.redisService.get(lockKey);
        if (isLocked) {
            await new Promise(resolve => setTimeout(resolve, 200));
            return this.findAll(query);
        }
        await this.redisService.set(lockKey, true, 10);
        const skip = (page - 1) * limit;
        const whereClause = search
            ? {
                OR: [
                    { name: { contains: search } },
                    { address: { contains: search } },
                ],
            }
            : {};
        const [shelters, total] = await Promise.all([
            this.prisma.shelter.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    _count: {
                        select: { pets: { where: { status: 'AVAILABLE' } } },
                    },
                },
            }),
            this.prisma.shelter.count({ where: whereClause }),
        ]);
        const result = {
            data: shelters,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
        await this.redisService.set(cacheKey, result, 3600);
        await this.redisService.del(lockKey);
        return result;
    }
    async findOne(id, userId) {
        const shelter = await this.prisma.shelter.findUnique({
            where: { id },
            include: {
                pets: {
                    where: { status: 'AVAILABLE' },
                    include: {
                        images: true,
                    },
                },
                _count: {
                    select: {
                        pets: { where: { status: 'AVAILABLE' } },
                        followers: true,
                    },
                },
            },
        });
        if (!shelter) {
            throw new common_1.NotFoundException('Không tìm thấy trạm cứu hộ');
        }
        const adoptedCount = await this.prisma.pet.count({
            where: {
                shelterId: id,
                status: 'ADOPTED'
            },
        });
        let isFollowed = false;
        if (userId) {
            const followRecord = await this.prisma.followedShelter.findUnique({
                where: {
                    userId_shelterId: {
                        userId,
                        shelterId: id,
                    },
                },
            });
            isFollowed = !!followRecord;
        }
        return {
            ...shelter,
            adoptedCount,
            isFollowed,
        };
    }
    async follow(shelterId, userId) {
        const shelter = await this.prisma.shelter.findUnique({ where: { id: shelterId } });
        if (!shelter) {
            throw new common_1.NotFoundException('Không tìm thấy trạm cứu hộ');
        }
        try {
            await this.prisma.followedShelter.create({
                data: {
                    userId,
                    shelterId,
                },
            });
            await this.notificationsService.createAndSendNotification({
                userId: userId,
                title: '🏠 Đã theo dõi trạm cứu hộ',
                body: `Bạn đã bắt đầu theo dõi trạm cứu hộ ${shelter.name}. Bạn sẽ nhận được các thông tin mới nhất từ họ.`,
                type: client_1.NotificationType.SYSTEM,
                referenceId: shelterId,
            });
            return { message: 'Đã theo dõi trạm cứu hộ thành công' };
        }
        catch (error) {
            if (error.code === 'P2002') {
                throw new common_1.ConflictException('Bạn đã theo dõi trạm cứu hộ này rồi');
            }
            throw error;
        }
    }
    async unfollow(shelterId, userId) {
        try {
            await this.prisma.followedShelter.delete({
                where: {
                    userId_shelterId: {
                        userId,
                        shelterId,
                    },
                },
            });
            return { message: 'Đã bỏ theo dõi trạm cứu hộ thành công' };
        }
        catch (error) {
            if (error.code === 'P2025') {
                throw new common_1.NotFoundException('Bạn chưa theo dõi trạm cứu hộ này');
            }
            throw error;
        }
    }
    async toggleFollow(shelterId, userId) {
        const shelter = await this.prisma.shelter.findUnique({
            where: { id: shelterId },
        });
        if (!shelter) {
            throw new common_1.NotFoundException('Không tìm thấy trạm cứu hộ');
        }
        const existingFollow = await this.prisma.followedShelter.findUnique({
            where: {
                userId_shelterId: {
                    userId,
                    shelterId,
                },
            },
        });
        let isFollowed = false;
        if (existingFollow) {
            await this.prisma.followedShelter.delete({
                where: {
                    userId_shelterId: {
                        userId,
                        shelterId,
                    },
                },
            });
            isFollowed = false;
        }
        else {
            await this.prisma.followedShelter.create({
                data: {
                    userId,
                    shelterId,
                },
            });
            isFollowed = true;
            await this.notificationsService.createAndSendNotification({
                userId: userId,
                title: '🏠 Đã theo dõi trạm cứu hộ',
                body: `Bạn đã bắt đầu theo dõi ${shelter.name}. Bạn sẽ nhận được các thông tin mới nhất từ họ.`,
                type: client_1.NotificationType.SYSTEM,
                referenceId: shelterId,
            });
        }
        const followersCount = await this.prisma.followedShelter.count({
            where: {
                shelterId,
            },
        });
        return {
            success: true,
            isFollowed,
            followersCount,
        };
    }
    async getFollowedSheltersByUser(userId) {
        const followedRecords = await this.prisma.followedShelter.findMany({
            where: {
                userId: userId,
            },
            include: {
                shelter: {
                    include: {
                        _count: {
                            select: {
                                pets: { where: { status: 'AVAILABLE' } },
                                followers: true
                            }
                        }
                    }
                },
            },
        });
        return followedRecords.map(record => {
            const shelter = record.shelter;
            return {
                id: shelter.id,
                name: shelter.name,
                address: shelter.address,
                imageUrl: shelter.avatarUrl || shelter.coverUrl || 'https://via.placeholder.com/200',
                isFollowing: true,
                _count: shelter._count
            };
        });
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    async getSheltersNearBy(lat, lng, limit = 10) {
        const roundedLat = lat.toFixed(2);
        const roundedLng = lng.toFixed(2);
        const cacheKey = `shelters:nearby:lat_${roundedLat}:lng_${roundedLng}:limit_${limit}`;
        const cachedData = await this.redisService.get(cacheKey);
        if (cachedData)
            return cachedData;
        const lockKey = `${cacheKey}:lock`;
        if (await this.redisService.get(lockKey)) {
            await new Promise(resolve => setTimeout(resolve, 200));
            return this.getSheltersNearBy(lat, lng, limit);
        }
        await this.redisService.set(lockKey, true, 10);
        const REDIS_KEY = 'shelters:locations';
        let nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);
        if (!nearbyShelterIds || nearbyShelterIds.length === 0) {
            const allShelters = await this.prisma.shelter.findMany({
                where: { latitude: { not: null }, longitude: { not: null } },
            });
            for (const s of allShelters) {
                await this.redisService.addLocation(REDIS_KEY, s.longitude, s.latitude, s.id);
            }
            nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);
        }
        const targetIds = nearbyShelterIds.slice(0, limit);
        if (targetIds.length === 0) {
            return { data: [], meta: { limit, count: 0 } };
        }
        const shelters = await this.prisma.shelter.findMany({
            where: { id: { in: targetIds } },
        });
        const petCounts = await this.prisma.pet.groupBy({
            by: ['shelterId'],
            where: { shelterId: { in: targetIds }, status: 'AVAILABLE' },
            _count: { _all: true },
        });
        const formattedShelters = shelters.map(shelter => {
            const petCountData = petCounts.find(pc => pc.shelterId === shelter.id);
            const distanceVal = this.calculateDistance(lat, lng, shelter.latitude, shelter.longitude);
            return {
                ...shelter,
                _count: {
                    pets: petCountData ? petCountData._count._all : 0
                },
                distance_val: distanceVal,
            };
        });
        formattedShelters.sort((a, b) => a.distance_val - b.distance_val);
        const finalData = formattedShelters.map(s => {
            const formattedData = {
                ...s,
                distance: `${s.distance_val.toFixed(1)} km`,
            };
            delete formattedData.distance_val;
            return formattedData;
        });
        const result = {
            data: finalData,
            meta: { limit, count: finalData.length }
        };
        await this.redisService.set(cacheKey, result, 600);
        await this.redisService.del(`${cacheKey}:lock`);
        return result;
    }
};
exports.SheltersService = SheltersService;
exports.SheltersService = SheltersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        redis_service_1.RedisService])
], SheltersService);
//# sourceMappingURL=shelters.service.js.map