// src/modules/shelter-dashboard/shelter-dashboard.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RedisService } from 'src/database/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, ApplicationStatus, Prisma } from '@prisma/client';
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
    async getPetById(shelterId: string, petId: string) {
        // 1. Kiểm tra quyền sở hữu (hàm có sẵn của bạn)
        await this.assertOwnsPet(shelterId, petId);

        // 2. Query thông tin chi tiết pet
        const pet = await this.prisma.pet.findUnique({
            where: { id: petId },
            include: {
                images: { orderBy: { createdAt: 'asc' } },
                medicalRecords: true,
                traitsList: true,
                adoptionRequirements: {
                    include: { requirement: true }
                },
                tags: true,
            },
        });

        if (!pet) throw new NotFoundException('Không tìm thấy thú cưng.');

        // 3. Format lại images thành mảng string để đồng bộ Type với Frontend
        return {
            ...pet,
            images: pet.images.map(img => img.url)
        };
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

    async createPet(shelterId: string, dto: any) {
        const { images, medicalRecords, adoptionRequirementKeys, traits, goodWith, badWith, healthStatus, tagId, ...rest } = dto;

        let requirementRelations;
        if (adoptionRequirementKeys?.length) {
            const requirements = await this.prisma.adoptionRequirement.findMany({
                where: { key: { in: adoptionRequirementKeys } },
            });
            requirementRelations = { create: requirements.map((r) => ({ requirementId: r.id })) };
        }

        const pet = await this.prisma.pet.create({
            data: {
                ...rest,
                species: toBilingual(rest.species),
                breed: rest.breed ? toBilingual(rest.breed) : undefined,
                description: rest.description ? toBilingual(rest.description) : undefined,
                color: rest.color ? toBilingual(rest.color) : undefined,
                dob: rest.dob ? new Date(rest.dob) : undefined,
                shelterId,
                status: rest.status ?? 'AVAILABLE', // 🔑 KHÁC hẳn createPet của mobile
                goodWith: goodWith ?? undefined,
                badWith: badWith ?? undefined,
                traitsList: traits?.length ? { create: traits.map((t: any) => ({ name: toBilingual(t) })) } : undefined,
                images: images?.length ? { create: images.map((url: string) => ({ url })) } : undefined,
                medicalRecords: medicalRecords?.length
                    ? {
                        create: medicalRecords.map((r: any) => ({
                            type: r.type,
                            recordName: toBilingual(r.recordName),
                            recordDate: new Date(r.recordDate),
                            images: r.images || [],
                            hasNextDueDate: r.hasNextDueDate || false,
                            nextDueDate: r.nextDueDate ? new Date(r.nextDueDate) : null,
                            nextDueName: r.nextDueName ? toBilingual(r.nextDueName) : null,
                        })),
                    }
                    : undefined,
                adoptionRequirements: requirementRelations,
            },
            include: { images: true },
        });
        if (tagId) {
            await this.prisma.tag.update({
                where: { id: tagId },
                data: {
                    petId: pet.id,
                    status: 'ACTIVE',
                    linkedAt: new Date(),
                    linkCount: { increment: 1 }
                }
            });
            await this.prisma.pet.update({
                where: { id: pet.id },
                data: {
                    qrVerificationStatus: 'VERIFIED',
                    qrCodeUrl: `https://pawcare.app/tag/${tagId}`
                }
            });
        }

        return pet;
    }

    async updatePet(shelterId: string, petId: string, dto: any) {
        await this.assertOwnsPet(shelterId, petId);
        const { images, medicalRecords, adoptionRequirementKeys, traits, goodWith, badWith, healthStatus, ...rest } = dto;

        if (adoptionRequirementKeys) {
            const requirements = await this.prisma.adoptionRequirement.findMany({
                where: { key: { in: adoptionRequirementKeys } },
            });
            await this.prisma.petAdoptionRequirement.deleteMany({ where: { petId } });
            if (requirements.length) {
                await this.prisma.petAdoptionRequirement.createMany({
                    data: requirements.map((r) => ({ petId, requirementId: r.id })),
                });
            }
        }

        if (traits) {
            await this.prisma.petTrait.deleteMany({ where: { petId } });
            if (traits.length) {
                await this.prisma.petTrait.createMany({
                    data: traits.map((t: any) => ({ petId, name: toBilingual(t) })),
                });
            }
        }

        const pet = await this.prisma.pet.update({
            where: { id: petId },
            data: {
                ...rest,
                ...(rest.species && { species: toBilingual(rest.species) }),
                ...(rest.breed && { breed: toBilingual(rest.breed) }),
                ...(rest.description && { description: toBilingual(rest.description) }),
                ...(rest.color && { color: toBilingual(rest.color) }),
                ...(rest.dob && { dob: new Date(rest.dob) }),

                // Sửa 2 dòng này:
                ...(goodWith !== undefined && { goodWith }),
                ...(badWith !== undefined && { badWith }),

                ...(images && { images: { deleteMany: {}, create: images.map((url: string) => ({ url })) } }),
            },
            include: { images: true },
        });

        // medicalRecords: dùng logic merge (update/create/delete) như PetsService.updatePet
        // đã có ở mobile — khuyến nghị TÁI SỬ DỤNG hàm đó bằng cách export ra 1 shared service
        // thay vì copy lại toàn bộ (xem mục "Refactor gợi ý" cuối bài).

        await this.redisService.del(`pet:detail:${petId}`);
        return pet;
    }

    async deletePet(shelterId: string, petId: string) {
        await this.assertOwnsPet(shelterId, petId);
        await this.prisma.$transaction(async (tx) => {
            await tx.tag.updateMany({ where: { petId }, data: { status: 'INACTIVE', petId: null, linkedAt: null } });
            await tx.pet.delete({ where: { id: petId } });
        });
        await this.redisService.del(`pet:detail:${petId}`);
        return { success: true };
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

        // Hỗ trợ truy vấn 1 trạng thái (App)
        if (query.status && query.status !== 'ALL') {
            where.status = query.status;
        }

        // Hỗ trợ truy vấn nhiều trạng thái (Web Kanban)
        if (query.statuses) {
            where.status = { in: query.statuses.split(',') };
        }

        if (query.petId) where.petId = query.petId;

        return this.prisma.adoptionApplication.findMany({
            where,
            include: {
                pet: { include: { images: { take: 1, orderBy: { createdAt: 'asc' } } } },
                user: { select: { id: true, name: true, avatarUrl: true, email: true, phone: true } },
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

        if (status === 'CLOSED' && !reviewNote?.trim()) {
            throw new BadRequestException('Vui lòng nhập lý do từ chối.');
        }

        const updated = await this.prisma.adoptionApplication.update({
            where: { id: applicationId },
            data: { status, reviewNote: reviewNote ?? application.reviewNote },
        });

        // Nếu approved -> đồng bộ Pet.status = PENDING (đang chờ bàn giao)
        if (status === 'CLOSED') {
            await this.prisma.pet.update({ where: { id: application.petId }, data: { status: 'PENDING' } });
        }
        if (status === 'ADOPTION_COMPLETED') {
            await this.prisma.pet.update({
                where: { id: application.petId },
                data: { status: 'ADOPTED', ownerId: application.userId, adoptedAt: new Date() },
            });
        }
        if (status === 'CLOSED') {
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