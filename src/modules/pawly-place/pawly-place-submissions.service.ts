import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PlaceSubmissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { normLang } from './utils/pawly-place.utils';
import {
    CreatePlaceSubmissionDto, ListSubmissionsDto, SubmissionDayHoursDto,
} from './dto/place-submission.dto';

// ======================================================================
// ⚠️ ADAPT #1 — map thứ FE → key trong Place.openingHours.
// Mình KHÔNG thấy file pawly-place.utils (OpeningHours / getOpenStatus / weeklyHours)
// nên đoán dạng: { mon: [{open:'08:00', close:'22:00'}], tue: [...], ... , sun: [...] }
// Nếu OpeningHours của bạn khác → chỉ cần sửa hàm toPlaceOpeningHours() bên dưới.
// ======================================================================
const DAY_KEY: Record<string, string> = {
    T2: 'mon', T3: 'tue', T4: 'wed', T5: 'thu', T6: 'fri', T7: 'sat', CN: 'sun',
};

function toPlaceOpeningHours(days: SubmissionDayHoursDto[]): Prisma.InputJsonValue {
    const out: Record<string, { open: string; close: string }[]> = {};
    for (const d of days) {
        const key = DAY_KEY[d.day];
        if (!key) continue;
        if (!d.isOpen) out[key] = [];
        else if (d.is24Hours) out[key] = [{ open: '00:00', close: '23:59' }];
        else out[key] = d.timeFrames.map((t) => ({ open: t.open, close: t.close }));
    }
    return out;
}

// ======================================================================
// ⚠️ ADAPT #2 — field text đa ngôn ngữ của Place (intro, categoryText, menuSection.title)
// Mình đoán là Json dạng { vi, en } (vì service cũ dùng pick(json, lang)).
// ======================================================================
const i18n = (text: string) => ({ vi: text, en: text });

const MAX_PENDING_PER_USER = 5;

const submissionInclude = Prisma.validator<Prisma.PlaceSubmissionInclude>()({
    submitter: { select: { id: true, name: true, email: true, avatarUrl: true } },
});
type SubmissionRow = Prisma.PlaceSubmissionGetPayload<{ include: typeof submissionInclude }>;

type StoredMenuSection = { title: string; items: { name: string; subtext?: string; priceLabel?: string; image?: string }[] };

const asArray = <T,>(v: Prisma.JsonValue | null | undefined): T[] => (Array.isArray(v) ? (v as unknown as T[]) : []);

/** "45.000đ" → 45000 | "45k" → 45000 | "abc" → 0 */
function parsePrice(label?: string): number {
    if (!label) return 0;
    const k = label.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
    if (k) return Math.min(Math.round(parseFloat(k[1].replace(',', '.')) * 1000), 2_000_000_000);
    const digits = label.replace(/[^\d]/g, '');
    return digits ? Math.min(Number(digits), 2_000_000_000) : 0;
}

@Injectable()
export class PawlyPlaceSubmissionsService {
    constructor(private prisma: PrismaService) { }

    // =====================================================================
    // USER: gửi yêu cầu thêm địa điểm
    // =====================================================================
    async create(userId: string, dto: CreatePlaceSubmissionDto) {
        const pending = await this.prisma.placeSubmission.count({
            where: { submitterId: userId, status: PlaceSubmissionStatus.PENDING },
        });
        if (pending >= MAX_PENDING_PER_USER) {
            throw new BadRequestException({
                message: 'You have too many pending submissions. Please wait for them to be reviewed.',
                i18n: { key: 'error.too_many_pending_submissions' },
            });
        }

        const keys: string[] = [...new Set<string>(dto.categoryKeys)];
        const validCount = await this.prisma.placeCategory.count({ where: { key: { in: keys }, isActive: true } });
        if (validCount !== keys.length) {
            throw new BadRequestException({ message: 'Invalid category.', i18n: { key: 'error.invalid_category' } });
        }

        // Làm sạch menu: bỏ item rỗng, bỏ section không còn item
        const menu: StoredMenuSection[] = (dto.menuSections ?? [])
            .map((s) => ({
                title: s.title.trim(),
                items: s.items
                    .filter((i) => i.name.trim())
                    .map((i) => ({
                        name: i.name.trim(),
                        subtext: i.subtext?.trim() || '',
                        priceLabel: i.priceLabel?.trim() || '',
                        image: i.image || '',
                    })),
            }))
            .filter((s) => s.title && s.items.length > 0);

        const row = await this.prisma.placeSubmission.create({
            data: {
                submitterId: userId,
                name: dto.name.trim(),
                description: dto.description?.trim() || null,
                address: dto.address.trim(),
                city: dto.city?.trim() || null,
                latitude: dto.latitude,
                longitude: dto.longitude,
                phone: dto.phone?.trim() || null,
                website: dto.website?.trim() || null,
                categoryKeys: keys as unknown as Prisma.InputJsonValue,
                openingHours: dto.operatingHours as unknown as Prisma.InputJsonValue,
                isUncertainHours: dto.isUncertainHours ?? false,
                amenities: [...new Set<string>(dto.amenities ?? [])] as unknown as Prisma.InputJsonValue,
                extraRules: dto.extraRules?.trim() || null,
                images: (dto.images ?? []) as unknown as Prisma.InputJsonValue,
                menu: menu as unknown as Prisma.InputJsonValue,
            },
            select: { id: true, status: true, createdAt: true },
        });
        return row;
    }

    // =====================================================================
    // ADMIN: danh sách
    // =====================================================================
    async list(dto: ListSubmissionsDto) {
        const lang = normLang(dto.lang);
        const status = dto.status ?? PlaceSubmissionStatus.PENDING;
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;
        const where: Prisma.PlaceSubmissionWhereInput = { status };

        const [total, rows] = await Promise.all([
            this.prisma.placeSubmission.count({ where }),
            this.prisma.placeSubmission.findMany({
                where,
                include: submissionInclude,
                orderBy: { createdAt: 'asc' }, // hàng đợi: gửi trước duyệt trước
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        // Resolve category 1 lần cho cả trang
        const allKeys = Array.from(new Set(rows.flatMap((r) => asArray<string>(r.categoryKeys))));
        const cats = allKeys.length
            ? await this.prisma.placeCategory.findMany({ where: { key: { in: allKeys } } })
            : [];
        const catMap = new Map(cats.map((c) => [c.key, c]));

        return {
            items: rows.map((r) => this.toView(r, catMap, lang)),
            page, limit, total, hasMore: page * limit < total,
        };
    }

    // =====================================================================
    // ADMIN: duyệt → tạo Place thật
    // =====================================================================
    async approve(id: string, reviewerId: string) {
        const sub = await this.prisma.placeSubmission.findUnique({ where: { id } });
        if (!sub) throw this.notFound();
        if (sub.status !== PlaceSubmissionStatus.PENDING) throw this.alreadyProcessed();

        // ---- category (phần tử đầu = chính) ----
        const keys = asArray<string>(sub.categoryKeys);
        const cats = await this.prisma.placeCategory.findMany({ where: { key: { in: keys }, isActive: true } });
        const ordered = keys.map((k) => cats.find((c) => c.key === k)).filter((c): c is NonNullable<typeof c> => !!c);
        if (ordered.length === 0) {
            throw new BadRequestException({ message: 'Category no longer exists.', i18n: { key: 'error.invalid_category' } });
        }
        const primary = ordered[0];

        // ---- amenities: khớp theo labelVi hoặc key ----
        const labels = asArray<string>(sub.amenities);
        const amenityRows = labels.length
            ? await this.prisma.placeAmenity.findMany({
                where: { OR: [{ labelVi: { in: labels } }, { key: { in: labels } }] },
            })
            : [];
        const matched = new Set<string>();
        amenityRows.forEach((a) => { matched.add(a.labelVi); matched.add(a.key); });
        const unmatchedAmenities = labels.filter((l) => !matched.has(l));

        // ---- images / menu ----
        const images = asArray<string>(sub.images);
        const menu = asArray<StoredMenuSection>(sub.menu);
        const firstMenuImage = menu.flatMap((s) => s.items).find((i) => i.image)?.image;
        const heroImage = images[0] ?? firstMenuImage ?? '';
        const hours = asArray<SubmissionDayHoursDto>(sub.openingHours);

        let featuredLeft = 6; // detail chỉ preview các item isFeatured

        const place = await this.prisma.$transaction(
            async (tx) => {
                // Claim atomically để 2 admin bấm cùng lúc không tạo 2 Place
                const claimed = await tx.placeSubmission.updateMany({
                    where: { id, status: PlaceSubmissionStatus.PENDING },
                    data: { status: PlaceSubmissionStatus.APPROVED, reviewedById: reviewerId, reviewedAt: new Date(), rejectReason: null },
                });
                if (claimed.count === 0) throw this.alreadyProcessed();

                const created = await tx.place.create({
                    data: {
                        name: sub.name,
                        address: sub.address,
                        city: sub.city ?? '',
                        latitude: sub.latitude,
                        longitude: sub.longitude,
                        phone: sub.phone,
                        isActive: true,
                        heroImage,
                        galleryImages: images,
                        intro: i18n(sub.description ?? ''),
                        categoryText: i18n(ordered.map((c) => c.nameVi).join(', ')),
                        openingHours: toPlaceOpeningHours(hours),
                        category: { connect: { id: primary.id } },
                        amenities: {
                            create: amenityRows.map((a) => ({ amenity: { connect: { id: a.id } } })),
                        },
                        menuSections: {
                            create: menu.map((s, si) => ({
                                title: i18n(s.title),
                                sortOrder: si,
                                items: {
                                    create: s.items.map((it, ii) => ({
                                        name: it.name,
                                        subtext: it.subtext ?? '',
                                        price: parsePrice(it.priceLabel),
                                        image: it.image || '',
                                        sortOrder: ii,
                                        isAvailable: true,
                                        isFeatured: featuredLeft-- > 0,
                                    })),
                                },
                            })),
                        },
                    },
                    select: { id: true },
                });

                await tx.placeSubmission.update({ where: { id }, data: { placeId: created.id } });
                return created;
            }, { maxWait: 5000, timeout: 20000 },);

        return { success: true, placeId: place.id, unmatchedAmenities };
    }

    // =====================================================================
    // ADMIN: từ chối
    // =====================================================================
    async reject(id: string, reviewerId: string, reason: string) {
        const exists = await this.prisma.placeSubmission.count({ where: { id } });
        if (!exists) throw this.notFound();

        const res = await this.prisma.placeSubmission.updateMany({
            where: { id, status: PlaceSubmissionStatus.PENDING },
            data: {
                status: PlaceSubmissionStatus.REJECTED,
                rejectReason: reason.trim(),
                reviewedById: reviewerId,
                reviewedAt: new Date(),
            },
        });
        if (res.count === 0) throw this.alreadyProcessed();
        return { success: true };
    }

    // =====================================================================
    // HELPERS
    // =====================================================================
    private notFound() {
        return new NotFoundException({ message: 'Submission not found.', i18n: { key: 'error.submission_not_found' } });
    }
    private alreadyProcessed() {
        return new ConflictException({ message: 'Submission was already processed.', i18n: { key: 'error.submission_processed' } });
    }

    /** Shape khớp 1-1 với MOCK_REQUESTS ở màn duyệt FE */
    private toView(
        r: SubmissionRow,
        catMap: Map<string, { key: string; nameVi: string; nameEn: string; icon: string }>,
        lang: 'vi' | 'en',
    ) {
        const menu = asArray<StoredMenuSection>(r.menu);
        return {
            id: r.id,
            status: r.status,
            submittedAt: r.createdAt,
            rejectReason: r.rejectReason,
            submitter: {
                id: r.submitter.id,
                name: r.submitter.name || 'PawLife user',
                email: r.submitter.email ?? '',
                avatar: r.submitter.avatarUrl ?? null,
            },
            basicInfo: {
                name: r.name,
                description: r.description ?? '',
                address: r.address,
                city: r.city ?? '',
                phone: r.phone ?? '',
                website: r.website ?? '',
                categories: asArray<string>(r.categoryKeys)
                    .map((k) => catMap.get(k))
                    .filter((c): c is NonNullable<typeof c> => !!c)
                    .map((c) => ({ key: c.key, name: lang === 'vi' ? c.nameVi : c.nameEn, icon: c.icon })),
                coordinates: { latitude: r.latitude, longitude: r.longitude },
            },
            operatingHours: {
                isUncertain: r.isUncertainHours,
                days: asArray<SubmissionDayHoursDto>(r.openingHours),
            },
            amenities: asArray<string>(r.amenities),
            extraRules: r.extraRules ?? '',
            images: asArray<string>(r.images),
            menuSections: menu.map((s, si) => ({
                id: `sec_${si}`,
                title: s.title,
                items: s.items.map((it, ii) => ({
                    id: `item_${si}_${ii}`,
                    name: it.name,
                    subtext: it.subtext ?? '',
                    priceLabel: it.priceLabel ?? '',
                    image: it.image || null,
                })),
            })),
        };
    }
}