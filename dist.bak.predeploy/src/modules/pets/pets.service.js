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
exports.PetsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const client_1 = require("@prisma/client");
const notifications_service_1 = require("../notifications/notifications.service");
const client_2 = require("@prisma/client");
const notifications_gateway_1 = require("../notifications/notifications.gateway");
const redis_service_1 = require("../../database/redis/redis.service");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const config_1 = require("@nestjs/config");
const ownerSelectQuery = {
    select: {
        id: true,
        name: true,
        avatarUrl: true,
        phone: true,
    },
};
let PetsService = class PetsService {
    prisma;
    swipeQueue;
    notificationsGateway;
    notificationsService;
    redisService;
    configService;
    constructor(prisma, swipeQueue, notificationsGateway, notificationsService, redisService, configService) {
        this.prisma = prisma;
        this.swipeQueue = swipeQueue;
        this.notificationsGateway = notificationsGateway;
        this.notificationsService = notificationsService;
        this.redisService = redisService;
        this.configService = configService;
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
    async getAvailablePetsByShelterIds(shelterIds) {
        const cacheKey = `pets:available:shelters:${shelterIds.sort().join('_')}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached)
            return cached;
        const pets = await this.prisma.pet.findMany({
            where: { status: 'AVAILABLE', shelterId: { in: shelterIds } },
            include: { images: true, shelter: true }
        });
        await this.redisService.set(cacheKey, pets, 300);
        return pets;
    }
    async linkQrCode(userId, petId, tagId) {
        const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
        if (!pet)
            throw new common_1.NotFoundException('Không tìm thấy thú cưng này!');
        if (pet.ownerId !== userId && pet.shelterId !== userId) {
            throw new common_1.ConflictException('Bạn không có quyền thao tác trên thú cưng này!');
        }
        const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
        if (!tag) {
            throw new common_1.BadRequestException('Mã QR này không thuộc hệ thống PawLife hoặc không tồn tại!');
        }
        if (tag.petId) {
            if (tag.petId === petId)
                throw new common_1.BadRequestException('Mã QR này đã được gán cho bé này rồi!');
            throw new common_1.BadRequestException('Mã QR này đã được sử dụng cho một thú cưng khác!');
        }
        await this.prisma.$transaction([
            this.prisma.tag.update({
                where: { id: tagId },
                data: {
                    petId: petId,
                    status: 'ACTIVE'
                }
            }),
            this.prisma.pet.update({
                where: { id: petId },
                data: {
                    qrVerificationStatus: 'VERIFIED',
                    qrCodeUrl: `https://pawcare.app/tag/${tagId}`
                }
            })
        ]);
        await this.redisService.del(`pet:detail:${petId}`);
        return { success: true, message: 'Liên kết vòng cổ thành công!' };
    }
    async getFeed(userId, limit, filters, lat, lng) {
        const { gender, size, species } = filters || {};
        const matchesFilters = (pet) => {
            if (gender && pet.gender !== gender)
                return false;
            if (size && pet.size !== size)
                return false;
            if (species && pet.species !== species)
                return false;
            return true;
        };
        if (lat && lng) {
            const interactionCacheKey = `user:${userId}:swiped_pets`;
            let userInteractions = await this.redisService.get(interactionCacheKey) || [];
            const allSwipedIds = new Set(userInteractions.map(i => i.petId));
            const passActionIds = new Set(userInteractions.filter(i => i.action === 'PASS').map(i => i.petId));
            const REDIS_KEY = 'shelters:locations';
            let nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);
            if (!nearbyShelterIds || nearbyShelterIds.length === 0) {
                const allShelters = await this.prisma.shelter.findMany({
                    where: { latitude: { not: null }, longitude: { not: null } }
                });
                for (const s of allShelters) {
                    await this.redisService.addLocation(REDIS_KEY, s.longitude, s.latitude, s.id);
                }
                nearbyShelterIds = await this.redisService.getNearby(REDIS_KEY, lng, lat, 50);
            }
            const targetShelterIds = nearbyShelterIds.slice(0, 30);
            if (targetShelterIds.length > 0) {
                const allPetsInShelters = await this.getAvailablePetsByShelterIds(targetShelterIds);
                let validPets = allPetsInShelters.filter(pet => !allSwipedIds.has(pet.id) && matchesFilters(pet));
                if (validPets.length === 0) {
                    validPets = allPetsInShelters.filter(pet => passActionIds.has(pet.id) && matchesFilters(pet));
                }
                const formattedData = validPets.map(pet => {
                    const shelter = pet.shelter;
                    const distanceVal = (shelter?.latitude && shelter?.longitude)
                        ? this.calculateDistance(lat, lng, shelter.latitude, shelter.longitude) : 0;
                    return {
                        ...pet,
                        distance_val: distanceVal,
                        distance: `${distanceVal.toFixed(1)} km`,
                        shelter: {
                            name: shelter?.name || 'Trạm chưa đặt tên',
                            avatarUrl: shelter?.avatarUrl || null,
                            address: shelter?.address || 'Chưa cập nhật'
                        }
                    };
                });
                formattedData.sort((a, b) => a.distance_val - b.distance_val);
                const finalData = formattedData.slice(0, limit).map(p => {
                    delete p.distance_val;
                    return p;
                });
                return { data: finalData, meta: { limit, count: finalData.length, filters } };
            }
        }
        let dbPets = await this.prisma.pet.findMany({
            where: {
                status: 'AVAILABLE',
                interactions: { none: { userId: userId } },
                ...(gender && { gender }),
                ...(size && { size }),
                ...(species && { species }),
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                images: { orderBy: { createdAt: 'asc' } },
                shelter: { select: { name: true, avatarUrl: true, address: true } }
            }
        });
        if (dbPets.length === 0) {
            dbPets = await this.prisma.pet.findMany({
                where: {
                    status: 'AVAILABLE',
                    interactions: { some: { userId: userId, action: 'PASS' } },
                    ...(gender && { gender }),
                    ...(size && { size }),
                    ...(species && { species }),
                },
                take: limit,
                include: {
                    images: { orderBy: { createdAt: 'asc' } },
                    shelter: { select: { name: true, avatarUrl: true, address: true } }
                }
            });
        }
        return { data: dbPets, meta: { limit, count: dbPets.length, filters } };
    }
    async swipePet(userId, petId, swipePetDto) {
        const petExists = await this.prisma.pet.findUnique({
            where: { id: petId },
            select: { id: true }
        });
        if (!petExists) {
            throw new common_1.NotFoundException('Không tìm thấy thú cưng này!');
        }
        const interactionCacheKey = `user:${userId}:swiped_pets`;
        await this.redisService.del(interactionCacheKey);
        await this.swipeQueue.add('process-swipe', {
            userId,
            petId,
            action: swipePetDto.action,
        }, {
            removeOnComplete: true,
            removeOnFail: 100,
        });
        return {
            message: `Đã ${swipePetDto.action.toLowerCase()} thú cưng thành công!`,
            data: {
                userId: userId,
                petId: petId,
                action: swipePetDto.action,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        };
    }
    async addFavorite(userId, petId) {
        const pet = await this.prisma.pet.findUnique({
            where: { id: petId },
        });
        if (!pet) {
            throw new common_1.NotFoundException('Không tìm thấy thú cưng này!');
        }
        const existingFavorite = await this.prisma.favoritePet.findUnique({
            where: {
                userId_petId: {
                    userId: userId,
                    petId: petId,
                },
            },
        });
        if (existingFavorite) {
            return {
                message: 'Thú cưng này đã nằm trong danh sách yêu thích của bạn từ trước.',
                data: existingFavorite,
            };
        }
        const favorite = await this.prisma.favoritePet.create({
            data: {
                userId: userId,
                petId: petId,
            },
        });
        return {
            message: 'Đã lưu thú cưng vào danh sách yêu thích thành công!',
            data: favorite,
        };
    }
    async removePet(userId, petId) {
        const pet = await this.prisma.pet.findUnique({
            where: { id: petId },
        });
        if (!pet) {
            throw new common_1.NotFoundException('Không tìm thấy thú cưng này!');
        }
        if (pet.ownerId !== userId && pet.shelterId !== userId) {
            throw new common_1.ConflictException('Bạn không có quyền xóa thú cưng này!');
        }
        await this.prisma.pet.delete({
            where: { id: petId },
        });
        await this.redisService.del(`pet:detail:${petId}`);
        return { message: 'Đã xóa thú cưng thành công!' };
    }
    async toggleLostMode(userId, petId, dto) {
        const { isLost, location, dateTime, details, ownerName, ownerPhone, ownerAddress, note, photos, latitude, longitude, lostDate, radius } = dto;
        const pet = await this.prisma.pet.findUnique({
            where: { id: petId },
        });
        if (!pet)
            throw new common_1.NotFoundException('Không tìm thấy thú cưng này!');
        if (pet.ownerId !== userId && pet.shelterId !== userId) {
            throw new common_1.ConflictException('Bạn không có quyền thay đổi trạng thái!');
        }
        const newStatus = isLost ? 'LOST' : 'ACTIVE';
        const activeTag = await this.prisma.tag.findFirst({
            where: { petId: petId, status: { not: 'INACTIVE' } }
        });
        await this.prisma.$transaction([
            this.prisma.tag.updateMany({
                where: { petId: petId },
                data: { status: newStatus },
            }),
            this.prisma.pet.update({
                where: { id: petId },
                data: {
                    lostContactName: isLost ? ownerName : null,
                    lostContactPhone: isLost ? ownerPhone : null,
                    lostContactAddress: isLost ? ownerAddress : null,
                    lostLocation: isLost ? location : null,
                    lostDateTime: isLost ? dateTime : null,
                    lostDetails: isLost ? `${note || ''}`.trim() : null,
                    lostPhotos: isLost ? JSON.stringify(photos || []) : null,
                    lostLatitude: isLost && latitude ? latitude : null,
                    lostLongitude: isLost && longitude ? longitude : null,
                    lostRadius: isLost && radius ? radius : null,
                    lostDate: isLost && lostDate ? new Date(lostDate) : null,
                }
            }),
            ...(isLost && activeTag ? [
                this.prisma.tagReport.create({
                    data: {
                        tagId: activeTag.id,
                        userId: userId,
                        latitude: latitude || null,
                        longitude: longitude || null,
                        message: note ? `Báo mất: ${note}` : 'Chủ nhân đã báo mất thú cưng',
                        scannedBy: ownerName || 'Chủ nhân',
                        status: 'PENDING',
                    }
                })
            ] : []),
            ...(isLost ? [] : [
                this.prisma.tagReport.updateMany({
                    where: {
                        tag: { petId: petId },
                        status: 'PENDING'
                    },
                    data: { status: 'RESOLVED' }
                })
            ])
        ]);
        const tags = await this.prisma.tag.findMany({ where: { petId: petId } });
        await this.redisService.del(`pet:detail:${petId}`);
        const LOST_TAGS_KEY = 'tags:locations:lost';
        if (!isLost) {
            for (const tag of tags) {
                await this.redisService.removeLocation(LOST_TAGS_KEY, tag.id);
            }
        }
        else if (latitude && longitude) {
            for (const tag of tags) {
                await this.redisService.addLocation(LOST_TAGS_KEY, longitude, latitude, tag.id);
            }
        }
        await this.notificationsService.createAndSendNotification({
            userId: userId,
            title: isLost ? '🚨 Báo động đi lạc!' : '✅ Thú cưng an toàn',
            body: isLost
                ? `Bạn đã BẬT chế độ báo lạc cho bé ${pet.name}.`
                : `Bạn đã TẮT chế độ báo lạc cho bé ${pet.name}.`,
            type: client_1.NotificationType.TAG,
            referenceId: petId,
        });
        if (!isLost) {
            try {
                const recentReporters = await this.prisma.tagReport.findMany({
                    where: {
                        tag: { petId: petId },
                        userId: { not: null },
                    },
                    distinct: ['userId'],
                    select: { userId: true }
                });
                for (const reporter of recentReporters) {
                    if (reporter.userId && reporter.userId !== userId) {
                        await this.notificationsService.createAndSendNotification({
                            userId: reporter.userId,
                            title: '🎉 Tin vui!',
                            body: `Chủ của bé ${pet.name} đã báo bình an và tìm được bé. Cảm ơn bạn đã hỗ trợ quét vòng cổ!`,
                            type: client_1.NotificationType.SYSTEM,
                            referenceId: petId,
                        });
                        this.notificationsGateway.server.to(`user_${reporter.userId}`).emit('notification', {
                            title: '🎉 Tin vui!',
                            body: `Chủ của bé ${pet.name} đã báo bình an và tìm được bé. Cảm ơn bạn đã hỗ trợ quét vòng cổ!`
                        });
                    }
                }
            }
            catch (err) {
                console.error("Lỗi khi gửi thông báo cho những người đã scan:", err);
            }
        }
        return {
            message: isLost ? 'Đã bật chế độ báo lạc!' : 'Đã tắt chế độ báo lạc, thú cưng an toàn.',
            isLost: isLost,
        };
    }
    async requestTransfer(petId, payload, senderId) {
        if (!payload.email && !payload.phone) {
            throw new common_1.BadRequestException('Vui lòng cung cấp email hoặc số điện thoại người nhận');
        }
        const orConditions = [];
        if (payload.email) {
            orConditions.push({ email: payload.email.trim().toLowerCase() });
        }
        if (payload.phone) {
            let rawPhone = payload.phone.replace(/[\s-]/g, '');
            orConditions.push({ phone: rawPhone });
            if (rawPhone.startsWith('0')) {
                orConditions.push({ phone: '+84' + rawPhone.substring(1) });
            }
            else if (rawPhone.startsWith('+84')) {
                orConditions.push({ phone: '0' + rawPhone.substring(3) });
            }
        }
        const receiver = await this.prisma.user.findFirst({
            where: {
                OR: orConditions,
            },
        });
        if (!receiver) {
            throw new common_1.NotFoundException('Hệ thống không tìm thấy người dùng với thông tin liên lạc này.');
        }
        if (receiver.id === senderId) {
            throw new common_1.BadRequestException('Không thể tự chuyển nhượng thú cưng cho chính mình.');
        }
        await this.prisma.transferRequest.updateMany({
            where: { petId, status: 'PENDING' },
            data: { status: 'CANCELED' },
        });
        const transferRequest = await this.prisma.transferRequest.create({
            data: { petId, senderId, receiverId: receiver.id, status: 'PENDING' },
        });
        await this.notificationsService.createAndSendNotification({
            userId: receiver.id,
            title: '🎁 Yêu cầu chuyển nhượng mới',
            body: 'Bạn nhận được yêu cầu nhận nuôi từ chủ cũ của thú cưng.',
            type: client_1.NotificationType.SYSTEM,
            referenceId: petId,
        });
        this.notificationsGateway.server.to(`user_${receiver.id}`).emit('transfer_requested', {
            transferId: transferRequest.id,
            petId,
        });
        await this.redisService.del(`pet:detail:${petId}`);
        return { success: true, message: 'Đã gửi yêu cầu' };
    }
    async confirmTransfer(transferId, receiverId) {
        const transferReq = await this.prisma.transferRequest.findUnique({
            where: { id: transferId },
        });
        if (!transferReq || transferReq.status !== 'PENDING') {
            throw new common_1.BadRequestException('Yêu cầu không hợp lệ hoặc đã được xử lý');
        }
        await this.prisma.pet.update({
            where: { id: transferReq.petId },
            data: { ownerId: receiverId },
        });
        await this.redisService.del(`pet:detail:${transferReq.petId}`);
        await this.prisma.transferRequest.updateMany({
            where: {
                petId: transferReq.petId,
                status: 'PENDING',
                id: { not: transferId }
            },
            data: { status: 'CANCELED' },
        });
        await this.prisma.transferRequest.update({
            where: { id: transferId },
            data: { status: 'COMPLETED' },
        });
        const payload = { petId: transferReq.petId };
        this.notificationsGateway.server.to(`user_${transferReq.senderId}`).emit('transfer_completed', payload);
        this.notificationsGateway.server.to(`user_${receiverId}`).emit('transfer_completed', payload);
        return { success: true, message: 'Chuyển nhượng thành công' };
    }
    async removeFavorite(userId, petId) {
        const existingFavorite = await this.prisma.favoritePet.findUnique({
            where: {
                userId_petId: { userId, petId },
            },
        });
        if (!existingFavorite) {
            throw new common_1.NotFoundException('Thú cưng này không nằm trong danh sách yêu thích của bạn!');
        }
        await this.prisma.favoritePet.delete({
            where: {
                userId_petId: { userId, petId },
            },
        });
        return {
            message: 'Đã bỏ yêu thích thú cưng này!',
        };
    }
    async getFavorites(userId, skip, take) {
        const favorites = await this.prisma.favoritePet.findMany({
            where: { userId: userId },
            skip: skip,
            take: take,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                pet: {
                    include: {
                        images: {
                            take: 1,
                            orderBy: { createdAt: 'asc' }
                        },
                        shelter: {
                            select: {
                                id: true,
                                name: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
        });
        const totalCount = await this.prisma.favoritePet.count({
            where: { userId: userId },
        });
        return {
            data: favorites.map((fav) => fav.pet),
            meta: {
                skip,
                take,
                totalCount,
            },
        };
    }
    async getMyPets(userId) {
        try {
            const pets = await this.prisma.pet.findMany({
                where: {
                    ownerId: userId,
                    status: 'ADOPTED',
                },
                include: {
                    images: {
                        orderBy: { createdAt: 'asc' },
                    },
                    tags: true,
                },
            });
            return pets.map((pet) => {
                const isLost = pet.tags?.some((tag) => tag.status === 'LOST') || false;
                return {
                    ...pet,
                    avatarUrl: pet.images && pet.images.length > 0 ? pet.images[0].url : null,
                    isLost,
                };
            });
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Lỗi khi lấy danh sách thú cưng của người dùng');
        }
    }
    async createPet(userId, createPetDto) {
        const { images, tagId, ...petData } = createPetDto;
        const publicDomain = this.configService.get('R2_PUBLIC_DOMAIN');
        try {
            if (tagId) {
                const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
                if (!tag) {
                    throw new common_1.BadRequestException('Mã QR này không tồn tại trong hệ thống!');
                }
                if (tag.petId) {
                    throw new common_1.BadRequestException('Mã QR này đã được sử dụng cho một bé khác!');
                }
                const result = await this.prisma.$transaction(async (prisma) => {
                    const newPet = await prisma.pet.create({
                        data: {
                            ...petData,
                            ownerId: userId,
                            status: 'ADOPTED',
                            qrVerificationStatus: 'VERIFIED',
                            qrCodeUrl: `${publicDomain}/qr-codes/${tagId}.svg`,
                            ...(images && images.length > 0 && {
                                images: { create: images.map(url => ({ url })) }
                            })
                        },
                        include: { images: true }
                    });
                    await prisma.tag.update({
                        where: { id: tagId },
                        data: {
                            petId: newPet.id,
                            status: 'ACTIVE'
                        }
                    });
                    return newPet;
                });
                return result;
            }
            const newPet = await this.prisma.pet.create({
                data: {
                    ...petData,
                    ownerId: userId,
                    status: 'ADOPTED',
                    ...(images && images.length > 0 && {
                        images: { create: images.map(url => ({ url })) }
                    })
                },
                include: { images: true }
            });
            return newPet;
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException)
                throw error;
            throw new common_1.InternalServerErrorException('Lỗi hệ thống khi thêm thú cưng');
        }
    }
    async searchPets(params) {
        const { search, type, limit = 20 } = params;
        const whereCondition = {
            status: 'AVAILABLE',
        };
        if (search) {
            whereCondition.OR = [
                { name: { contains: search } },
                { breed: { contains: search } },
            ];
        }
        if (type) {
            whereCondition.species = type.toUpperCase();
        }
        const pets = await this.prisma.pet.findMany({
            where: whereCondition,
            take: limit,
            include: {
                images: {
                    orderBy: { createdAt: 'asc' }
                },
                shelter: {
                    select: { id: true, address: true, name: true, avatarUrl: true }
                }
            },
            orderBy: {}
        });
        return {
            success: true,
            data: pets,
        };
    }
    async getPetById(id, userId) {
        const cacheKey = `pet:detail:${id}`;
        let petData = await this.redisService.get(cacheKey);
        if (!petData) {
            const pet = await this.prisma.pet.findUnique({
                where: { id },
                include: {
                    owner: ownerSelectQuery,
                    images: {
                        orderBy: { createdAt: 'asc' }
                    },
                    traitsList: true,
                    shelter: {
                        select: { id: true, name: true, contactInfo: true, address: true, avatarUrl: true }
                    },
                    transferRequests: {
                        orderBy: { updatedAt: 'desc' },
                        include: {
                            receiver: {
                                select: { id: true, name: true, email: true, phone: true, avatarUrl: true }
                            },
                            sender: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    tags: {
                        include: {
                            reports: {
                                orderBy: { scannedAt: 'desc' },
                                take: 1,
                                select: { id: true }
                            }
                        }
                    },
                },
            });
            if (!pet)
                throw new common_1.NotFoundException('Không tìm thấy thông tin thú cưng này!');
            let formattedShelter = null;
            if (pet.shelter) {
                formattedShelter = {
                    ...pet.shelter,
                    phone: pet.shelter.contactInfo,
                };
            }
            let formattedOwner = null;
            if (pet.owner) {
                formattedOwner = {
                    ...pet.owner,
                    address: 'Chưa cập nhật',
                };
            }
            const pendingTransfer = pet.transferRequests && pet.transferRequests.length > 0
                ? pet.transferRequests.find(tr => tr.status === 'PENDING')
                : null;
            const pawHistory = [];
            pawHistory.push({
                id: `join_${pet.id}`,
                type: 'CREATED',
                title: 'Joined PawLife',
                date: pet.createdAt,
                description: `Hồ sơ của ${pet.name} được tạo trên hệ thống.`
            });
            if (pet.dob) {
                pawHistory.push({
                    id: `dob_${pet.id}`,
                    type: 'BIRTH',
                    title: 'Date of Birth',
                    date: pet.dob,
                    description: `${pet.name} cất tiếng gấu/meo chào đời.`
                });
            }
            if (pet.tags && pet.tags.length > 0) {
                const activeTag = pet.tags.find(t => t.status !== 'INACTIVE');
                if (activeTag) {
                    pawHistory.push({
                        id: `tag_${activeTag.id}`,
                        type: 'QR_LINKED',
                        title: 'QR Code Registered',
                        date: activeTag.status === 'ACTIVE' ? pet.updatedAt : pet.createdAt,
                        description: `Vòng cổ thông minh được kích hoạt cho ${pet.name}.`
                    });
                }
            }
            const vaccineUrls = pet.vaccinationRecordUrls;
            if (Array.isArray(vaccineUrls) && vaccineUrls.length > 0) {
                pawHistory.push({
                    id: `vaccine_${pet.id}`,
                    type: 'VACCINE',
                    title: 'Vaccination Record Updated',
                    date: pet.updatedAt,
                    description: `Cập nhật ${vaccineUrls.length} giấy tờ tiêm chủng/y tế.`
                });
            }
            if (pet.transferRequests) {
                pet.transferRequests
                    .filter(tr => tr.status === 'COMPLETED')
                    .forEach(tr => {
                    pawHistory.push({
                        id: `transfer_${tr.id}`,
                        type: 'TRANSFER',
                        title: 'Ownership Transferred',
                        date: tr.updatedAt,
                        description: `Được chuyển nhượng thành công cho chủ mới (${tr.receiver?.name || 'Ẩn danh'}).`
                    });
                });
            }
            pawHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            let latestReportId = null;
            if (pet.tags && pet.tags.length > 0) {
                const activeTag = pet.tags.find(t => t.status !== 'INACTIVE') || pet.tags[0];
                if (activeTag && activeTag.reports && activeTag.reports.length > 0) {
                    latestReportId = activeTag.reports[0].id;
                }
            }
            petData = {
                ...pet,
                shelter: formattedShelter,
                owner: formattedOwner,
                pawHistory,
                avatarUrl: pet.images && pet.images.length > 0 ? pet.images[0].url : null,
                latestReportId,
                transferStatus: pendingTransfer ? pendingTransfer.status : null,
                pendingContact: pendingTransfer ? (pendingTransfer.receiver.email || pendingTransfer.receiver.phone) : null,
                transferRequestId: pendingTransfer ? pendingTransfer.id : null,
                receiverId: pendingTransfer ? pendingTransfer.receiverId : null,
                senderId: pendingTransfer ? pendingTransfer.senderId : null,
                receiver: pendingTransfer ? pendingTransfer.receiver : null,
            };
            await this.redisService.set(cacheKey, petData, 600);
        }
        let isFavorited = false;
        if (userId) {
            const favoriteRecord = await this.prisma.favoritePet.findUnique({
                where: {
                    userId_petId: {
                        userId: userId,
                        petId: id,
                    }
                }
            });
            isFavorited = !!favoriteRecord;
        }
        return {
            ...petData,
            isFavorited
        };
    }
    async replaceQrCode(userId, petId, dto) {
        const { newTagId } = dto;
        const pet = await this.prisma.pet.findUnique({
            where: { id: petId },
            include: { tags: true },
        });
        if (!pet)
            throw new common_1.NotFoundException('Không tìm thấy thú cưng.');
        if (pet.ownerId !== userId)
            throw new common_1.ForbiddenException('Bạn không có quyền thao tác trên thú cưng này.');
        const newTag = await this.prisma.tag.findUnique({
            where: { id: newTagId },
        });
        if (!newTag)
            throw new common_1.NotFoundException('Mã QR này không tồn tại trong hệ thống.');
        if (newTag.petId && newTag.petId !== petId) {
            throw new common_1.ConflictException('Mã QR này đã được sử dụng cho một thú cưng khác.');
        }
        if (newTag.petId === petId) {
            return { message: 'Mã QR này hiện đã được gắn cho thú cưng này.' };
        }
        await this.prisma.$transaction(async (tx) => {
            if (pet.tags && pet.tags.length > 0) {
                await tx.tag.updateMany({
                    where: { petId: pet.id },
                    data: {
                        petId: null,
                        status: 'INACTIVE'
                    },
                });
            }
            await tx.tag.update({
                where: { id: newTagId },
                data: {
                    petId: pet.id,
                    status: 'ACTIVE'
                },
            });
            const qrCodeUrl = `https://yourdomain.com/scan/${newTagId}`;
            await tx.pet.update({
                where: { id: pet.id },
                data: {
                    qrCodeUrl,
                    qrVerificationStatus: 'VERIFIED',
                    needsQrReplacement: false
                },
            });
        });
        return {
            success: true,
            message: 'Thay đổi mã QR thành công!',
            newTagId,
        };
    }
    async getPetByTagId(tagId) {
        const tag = await this.prisma.tag.findUnique({
            where: { id: tagId },
            include: {
                pet: {
                    include: {
                        owner: {
                            select: { id: true, name: true, avatarUrl: true, phone: true },
                        },
                        images: { orderBy: { createdAt: 'asc' } },
                    },
                },
            },
        });
        if (!tag || !tag.pet) {
            throw new common_1.NotFoundException('Không tìm thấy thú cưng với mã thẻ này');
        }
        const pet = tag.pet;
        const isLost = tag.status === client_2.TagStatus.LOST;
        if (!isLost && pet.owner) {
            pet.owner.phone = null;
        }
        return {
            ...pet,
            dob: pet.dob ?? null,
            avatarUrl: pet.images?.length > 0 ? pet.images[0].url : null,
            isLost,
            lostInfo: isLost ? {
                ownerName: pet.lostContactName ?? pet.owner?.name ?? null,
                ownerPhone: pet.lostContactPhone ?? pet.owner?.phone ?? null,
                ownerAddress: pet.lostContactAddress ?? null,
                note: pet.lostDetails ?? null,
            } : null,
        };
    }
    async cancelTransfer(petId, userId) {
        const transferReq = await this.prisma.transferRequest.findFirst({
            where: {
                petId: petId,
                status: 'PENDING',
                OR: [
                    { senderId: userId },
                    { receiverId: userId }
                ]
            },
        });
        if (!transferReq) {
            throw new common_1.BadRequestException('Không tìm thấy yêu cầu chuyển nhượng nào đang chờ xử lý.');
        }
        await this.prisma.transferRequest.update({
            where: { id: transferReq.id },
            data: { status: 'CANCELED' },
        });
        const payload = { petId: petId };
        this.notificationsGateway.server.to(`user_${transferReq.senderId}`).emit('transfer_cancelled', payload);
        this.notificationsGateway.server.to(`user_${transferReq.receiverId}`).emit('transfer_cancelled', payload);
        const targetUserId = userId === transferReq.senderId ? transferReq.receiverId : transferReq.senderId;
        const isSenderCanceling = userId === transferReq.senderId;
        await this.notificationsService.createAndSendNotification({
            userId: targetUserId,
            title: '❌ Hủy chuyển nhượng',
            body: isSenderCanceling
                ? 'Chủ cũ đã hủy yêu cầu chuyển nhượng thú cưng cho bạn.'
                : 'Người nhận đã từ chối yêu cầu chuyển nhượng thú cưng của bạn.',
            type: client_1.NotificationType.SYSTEM,
            referenceId: petId,
        });
        await this.redisService.del(`pet:detail:${petId}`);
        return { success: true, message: 'Đã hủy yêu cầu chuyển nhượng.' };
    }
    async updatePet(userId, petId, updateData) {
        const pet = await this.prisma.pet.findUnique({
            where: { id: petId },
        });
        if (!pet) {
            throw new common_1.NotFoundException('Không tìm thấy thú cưng này!');
        }
        if (pet.ownerId !== userId && pet.shelterId !== userId) {
            throw new common_1.ConflictException('Bạn không có quyền chỉnh sửa thông tin thú cưng này!');
        }
        const { images, ...petInfo } = updateData;
        try {
            const updatedPet = await this.prisma.pet.update({
                where: { id: petId },
                data: {
                    ...petInfo,
                    ...(images && images.length > 0 && {
                        images: {
                            deleteMany: {},
                            create: images.map((url) => ({ url }))
                        }
                    })
                },
                include: { images: true }
            });
            await this.redisService.del(`pet:detail:${petId}`);
            return {
                message: 'Cập nhật thông tin thú cưng thành công',
                data: updatedPet
            };
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Lỗi khi cập nhật thông tin thú cưng');
        }
    }
};
exports.PetsService = PetsService;
exports.PetsService = PetsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, bullmq_1.InjectQueue)('swipe-queue')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue,
        notifications_gateway_1.NotificationsGateway,
        notifications_service_1.NotificationsService,
        redis_service_1.RedisService,
        config_1.ConfigService])
], PetsService);
//# sourceMappingURL=pets.service.js.map