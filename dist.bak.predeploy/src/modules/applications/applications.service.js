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
exports.ApplicationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
let ApplicationsService = class ApplicationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createApplication(userId, data) {
        const activeApplicationsCount = await this.prisma.adoptionApplication.count({
            where: {
                userId,
                status: {
                    notIn: ['CLOSED', 'ADOPTION_COMPLETED'],
                },
            },
        });
        if (activeApplicationsCount >= 5) {
            throw new common_1.BadRequestException('Bạn đang có 5 đơn đăng ký đang chờ xử lý. Vui lòng đợi kết quả hoặc đóng các đơn cũ trước khi gửi đơn mới.');
        }
        const existingApp = await this.prisma.adoptionApplication.findFirst({
            where: {
                userId,
                petId: data.petId,
            },
        });
        if (existingApp) {
            if (existingApp.status !== 'CLOSED' && existingApp.status !== 'ADOPTION_COMPLETED') {
                throw new common_1.BadRequestException('Bạn đã gửi đơn đăng ký cho thú cưng này rồi.');
            }
            return await this.prisma.adoptionApplication.update({
                where: { id: existingApp.id },
                data: {
                    ...data,
                    status: 'SUBMITTED',
                },
            });
        }
        return await this.prisma.adoptionApplication.create({
            data: {
                userId,
                ...data,
                status: 'SUBMITTED',
            },
        });
    }
    async getMyApplications(userId) {
        const applications = await this.prisma.adoptionApplication.findMany({
            where: { userId },
            include: {
                pet: {
                    select: {
                        id: true,
                        name: true,
                        breed: true,
                        dob: true,
                        images: true,
                        shelter: {
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return applications;
    }
    async getApplicationById(userId, applicationId) {
        const application = await this.prisma.adoptionApplication.findFirst({
            where: {
                id: applicationId,
                userId: userId
            },
            include: {
                pet: {
                    include: {
                        images: { orderBy: { createdAt: 'asc' } },
                        shelter: {
                            select: { name: true, avatarUrl: true }
                        }
                    },
                },
            },
        });
        if (!application) {
            throw new common_1.NotFoundException('Không tìm thấy đơn đăng ký nhận nuôi này!');
        }
        return application;
    }
    async updateVerificationPhotos(userId, applicationId, photos) {
        const application = await this.prisma.adoptionApplication.findFirst({
            where: {
                id: applicationId,
                userId: userId
            },
        });
        if (!application) {
            throw new common_1.NotFoundException('Không tìm thấy đơn đăng ký nhận nuôi này!');
        }
        if (application.status !== 'NEED_MORE_INFO') {
            throw new common_1.BadRequestException('Đơn đăng ký hiện không yêu cầu bổ sung thông tin.');
        }
        return await this.prisma.adoptionApplication.update({
            where: { id: applicationId },
            data: {
                verificationPhotos: photos,
                status: 'PENDING',
            },
        });
    }
    async withdrawApplication(userId, applicationId) {
        const application = await this.prisma.adoptionApplication.findFirst({
            where: {
                id: applicationId,
                userId: userId
            },
        });
        if (!application) {
            throw new common_1.NotFoundException('Không tìm thấy đơn đăng ký nhận nuôi này!');
        }
        if (application.status === 'CLOSED' || application.status === 'ADOPTION_COMPLETED') {
            throw new common_1.BadRequestException('Không thể thu hồi đơn đăng ký ở trạng thái này!');
        }
        return await this.prisma.adoptionApplication.update({
            where: { id: applicationId },
            data: { status: 'CLOSED' },
        });
    }
};
exports.ApplicationsService = ApplicationsService;
exports.ApplicationsService = ApplicationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ApplicationsService);
//# sourceMappingURL=applications.service.js.map