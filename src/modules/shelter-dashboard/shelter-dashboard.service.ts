// src/modules/shelter-dashboard/shelter-dashboard.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RedisService } from 'src/database/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, ApplicationStatus, Prisma, ApplicationStatus as PrismaApplicationStatus } from '@prisma/client';
import { UpdateShelterProfileDto } from './dto/update-shelter-profile.dto';

function toBilingual(v: any): { vi: string; en: string } {
    if (!v) return { vi: '', en: '' };
    if (typeof v === 'string') return { vi: v, en: v };
    return { vi: v.vi ?? v.en ?? '', en: v.en ?? v.vi ?? '' };
}

@Injectable()
export class ShelterDashboardService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redisService: RedisService,
        private readonly notificationsService: NotificationsService,
    ) { }

    // ---------------- PROFILE ----------------
    async getMyProfile(shelterId: string) {
        const shelter = await this.prisma.shelter.findUnique({ where: { id: shelterId } });
        if (!shelter) throw new NotFoundException('Không tìm thấy hồ sơ trạm cứu hộ.');
        return {
            ...shelter,
            email: shelter.emailAddress,
            phone: shelter.contactInfo,
            logoUrl: shelter.avatarUrl, // 🔑 khớp field FE đang đọc
        };
    }


    async updateMyProfile(shelterId: string, dto: UpdateShelterProfileDto) {
        const { email, phone, logoUrl, coverUrl, openingHours, ...rest } = dto;
        const updated = await this.prisma.shelter.update({
            where: { id: shelterId },
            data: {
                ...rest,
                ...(email !== undefined && { emailAddress: email }),
                ...(phone !== undefined && { contactInfo: phone }),
                ...(logoUrl && { avatarUrl: logoUrl }),
                ...(coverUrl && { coverUrl }),
                ...(openingHours && {
                    openingHours: openingHours as unknown as Prisma.InputJsonValue,
                }),
            },
        });
        await this.redisService.del(`shelter:profile:${shelterId}`);
        return { ...updated, email: updated.emailAddress, phone: updated.contactInfo, logoUrl: updated.avatarUrl };
    }

    // ---------------- PETS ----------------
    async getMyPets(shelterId: string, query: { search?: string; species?: string; status?: string; page?: any; pageSize?: any }) {
        const { search, species, status, page = 1, pageSize = 12 } = query;

        // 1. Ép kiểu bắt buộc sang Number để tránh lỗi PrismaClientValidationError
        const pageNum = Number(page) || 1;
        const pageSizeNum = Number(pageSize) || 12;

        const where: any = { shelterId };
        if (status && status !== 'ALL') where.status = status;

        // Đồng bộ bộ lọc theo hoa/thường để khớp với dữ liệu tạo từ Mobile (Dog/Cat thay vì DOG/CAT)
        if (species && species !== 'ALL') {
            const normalizedSpecies = species.charAt(0).toUpperCase() + species.slice(1).toLowerCase();
            where.species = { path: ['en'], equals: normalizedSpecies };
        }

        if (search) where.name = { contains: search };

        const [items, total] = await Promise.all([
            this.prisma.pet.findMany({
                where,
                include: { images: { orderBy: { createdAt: 'asc' } } },
                orderBy: { createdAt: 'desc' },
                skip: (pageNum - 1) * pageSizeNum,
                take: pageSizeNum, // Prisma sẽ nhận đúng định dạng số
            }),
            this.prisma.pet.count({ where }),
        ]);

        // 2. Bóc tách mảng Object thành mảng String để khớp với Type của Frontend (ngăn crash <Image />)
        const formattedItems = items.map(pet => ({
            ...pet,
            images: pet.images.map(img => img.url) // Chuyển [{ url: "https..." }] thành ["https..."]
        }));

        return {
            items: formattedItems,
            total,
            page: pageNum,
            pageSize: pageSizeNum
        };
    }

    private async assertOwnsPet(shelterId: string, petId: string) {
        const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
        if (!pet) throw new NotFoundException('Không tìm thấy pet.');
        if (pet.shelterId !== shelterId) throw new ForbiddenException('Bạn không có quyền với pet này.');
        return pet;
    }

    // ---------------- ADOPTION APPLICATIONS ----------------
    async getMyApplications(shelterId: string, query: { status?: string; statuses?: string; petId?: string }) {
        const where: any = { pet: { shelterId } };

        if (query.status && query.status !== 'ALL') {
            where.status = query.status;
        }
        if (query.statuses) {
            where.status = { in: query.statuses.split(',') };
        }
        if (query.petId) where.petId = query.petId;

        return this.prisma.adoptionApplication.findMany({
            where,
            include: {
                pet: { include: { images: { take: 1, orderBy: { createdAt: 'asc' } } } },
                user: { select: { id: true, name: true, avatarUrl: true, email: true, phone: true } },
                notes: {
                    include: {
                        author: { select: { id: true, name: true, avatarUrl: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                tags: {
                    include: { tag: true },
                },
                appointment: true, // ✅ FIX: thiếu include này khiến ApproveApplicationModal / InterviewScheduleModal
                //         luôn nhận application.appointment = undefined, dù đã lưu lịch hẹn thật.
                //         Hệ quả: format luôn reset về Offline, meetLink/dateSlot/members rỗng,
                //         và useEffect tưởng "chưa có lịch" nên tự âm thầm gọi API tạo link Meet mới.
                documents: true,   // (tuỳ chọn) nên thêm luôn để đồng bộ với ApplicationsService.getShelterApplications,
                //            tránh phải gọi riêng fetchDocuments() ở FE mỗi lần mở modal.
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async moveApplication(shelterId: string, applicationId: string, status: ApplicationStatus, reviewNote?: string) {
        const application = await this.prisma.adoptionApplication.findUnique({
            where: { id: applicationId },
            include: { pet: true, user: true },
        });
        if (!application) throw new NotFoundException('Không tìm thấy đơn.');
        if (application.pet.shelterId !== shelterId) throw new ForbiddenException('Bạn không có quyền với đơn này.');

        if (status === ApplicationStatus.CLOSED && !reviewNote?.trim()) {
            throw new BadRequestException('Vui lòng nhập lý do từ chối.');
        }

        const updated = await this.prisma.adoptionApplication.update({
            where: { id: applicationId },
            data: { status, reviewNote: reviewNote ?? application.reviewNote },
        });

        // Nếu approved -> đồng bộ Pet.status = PENDING (đang chờ bàn giao)
        if (status === ApplicationStatus.APPROVED) {
            await this.prisma.pet.update({ where: { id: application.petId }, data: { status: 'PENDING' } });
        }
        if (status === ApplicationStatus.ADOPTION_COMPLETED) {
            await this.prisma.pet.update({
                where: { id: application.petId },
                data: { status: 'ADOPTED', ownerId: application.userId, adoptedAt: new Date() },
            });
        }
        if (status === ApplicationStatus.CLOSED) {
            // trả pet về AVAILABLE nếu trước đó bị giữ PENDING vì đơn này
            await this.prisma.pet.updateMany({
                where: { id: application.petId, status: 'PENDING' },
                data: { status: 'AVAILABLE' },
            });
        }

        await this.notificationsService.createAndSendNotification({
            userId: application.userId,
            title: status === 'CLOSED' ? '😔 Đơn nhận nuôi chưa được duyệt' : '📬 Cập nhật đơn nhận nuôi',
            body:
                status === 'CLOSED'
                    ? `Lý do: ${reviewNote}`
                    : `Đơn nhận nuôi cho ${application.pet.name} đã chuyển sang trạng thái mới.`,
            type: NotificationType.SYSTEM,
            referenceId: application.petId,
            metadata: { applicationId, status },
        });

        await this.redisService.del(`pet:detail:${application.petId}`);
        return updated;
    }
}