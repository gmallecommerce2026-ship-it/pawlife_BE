// src/modules/ingredients/ingredient-defaults.ts
//
// Nguồn duy nhất (single source of truth) cho nội dung mặc định theo Badge.
// Trước đây default này bị hardcode ở FE (React Native) và tự động điền vào
// input mỗi khi đổi badge trong form Thêm/Sửa — gây phiền vì mỗi lần edit lại
// phải tự dọn/chỉnh lại. Giờ chuyển toàn bộ xuống BE + DB:
//
//  - Nếu ingredient CHƯA có nội dung thật (title/steps rỗng) -> áp default theo badge.
//  - Nếu ingredient ĐÃ có nội dung thật (do admin tự gõ)     -> giữ nguyên, không ghi đè.
//  - Badge không cần field đó (VD: 'safe' không cần actionGuide) -> set NULL trong DB.
//
// Hàm applyBadgeDefaults() dùng chung cho:
//  - ingredients.service.ts (create/update)
//  - scripts/seed-ingredient-defaults.ts (seed 1 lần cho data cũ)

import { Prisma } from '@prisma/client';

export type Badge = 'safe' | 'caution' | 'toxic' | 'emergency';
export type Bilingual = { vi: string; en: string };
export type BilingualList = { vi: string[]; en: string[] };

export interface ActionGuideTemplate {
  title: Bilingual;
  steps: BilingualList;
}

export const ACTION_GUIDE_TEMPLATE_BY_BADGE: Partial<Record<Badge, ActionGuideTemplate>> = {
  caution: {
    title: { en: 'If your pet ate this', vi: 'Nếu thú cưng ăn phải' },
    steps: {
      en: [
        'Monitor for 12–24 hours',
        'Stop feeding more and make sure they drink enough water',
      ],
      vi: [
        'Theo dõi trong 12–24 giờ',
        'Ngưng cho ăn thêm và đảm bảo uống đủ nước',
      ],
    },
  },
  toxic: {
    title: { en: 'If your pet ate this', vi: 'Nếu thú cưng ăn phải' },
    steps: {
      en: [
        'Contact a vet as soon as possible for guidance',
        'Note down what and how much was eaten',
        "Don't self-treat without a vet's instruction",
      ],
      vi: [
        'Liên hệ thú y càng sớm càng tốt để được hướng dẫn',
        'Ghi nhớ đã ăn gì và lượng bao nhiêu',
        'Không tự xử lý nếu chưa có chỉ định từ bác sĩ',
      ],
    },
  },
  emergency: {
    title: { en: 'If your pet ate this', vi: 'Nếu thú cưng ăn phải' },
    steps: {
      en: [
        'Take your pet to the vet immediately',
        "Don't induce vomiting or attempt home treatment",
        'If seizures, difficulty breathing, or collapse occur → seek emergency care right away',
      ],
      vi: [
        'Đưa đến thú y ngay lập tức',
        'Không tự gây nôn / không tự xử lý tại nhà',
        'Nếu có co giật, khó thở, lịm → đi cấp cứu ngay',
      ],
    },
  },
};

export const WHY_TITLE_TEMPLATE_BY_BADGE: Partial<Record<Badge, Bilingual>> = {
  caution: { en: 'Why caution is needed', vi: 'Tại sao cần cẩn thận' },
  toxic: { en: "Why it's toxic", vi: 'Tại sao có hại' },
  emergency: { en: 'Why this is an emergency', vi: 'Tại sao nguy hiểm' },
};

export const SYMPTOMS_TITLE_TEMPLATE: Bilingual = {
  en: 'Symptoms to watch',
  vi: 'Triệu chứng cần chú ý',
};

export const BENEFITS_TITLE_TEMPLATE: Bilingual = {
  en: 'Key benefits',
  vi: 'Lợi ích chính',
};

export const FEEDING_TITLE_TEMPLATE: Bilingual = {
  en: 'Feeding guide',
  vi: 'Hướng dẫn cho ăn',
};

const isEmptyBilingual = (b?: Bilingual | null): boolean =>
  !b || (!b.vi?.trim() && !b.en?.trim());

const isEmptyBilingualList = (l?: BilingualList | null): boolean =>
  !l || ((!l.vi || l.vi.length === 0) && (!l.en || l.en.length === 0));

const needsActionGuide = (badge: Badge) =>
  badge === 'caution' || badge === 'toxic' || badge === 'emergency';

const needsDetails = (badge: Badge) =>
  badge === 'caution' || badge === 'toxic' || badge === 'emergency';

const needsBenefits = (badge: Badge) => badge === 'safe' || badge === 'caution';

export interface IncomingIngredientContent {
  actionGuide?: ActionGuideTemplate | null;
  details?: {
    whyTitle?: Bilingual;
    why?: BilingualList;
    symptomsTitle?: Bilingual;
    symptoms?: BilingualList;
  } | null;
  benefits?: {
    benefitsTitle?: Bilingual;
    benefits?: BilingualList;
    feedingTitle?: Bilingual;
    feeding?: BilingualList;
  } | null;
}

/**
 * Merge dữ liệu ingredient hiện có (hoặc mới nhập) với default theo badge.
 * Luôn trả về đủ 3 field { actionGuide, details, benefits } sẵn sàng để
 * ghi thẳng vào Prisma (dùng Prisma.DbNull cho field không áp dụng).
 */
export function applyBadgeDefaults(badge: Badge, incoming: IncomingIngredientContent) {
  const result: Record<string, any> = {};

  // --- actionGuide ---
  if (needsActionGuide(badge)) {
    const current = incoming.actionGuide;
    const hasRealContent =
      !!current && (!isEmptyBilingual(current.title) || !isEmptyBilingualList(current.steps));
    result.actionGuide = hasRealContent ? current : ACTION_GUIDE_TEMPLATE_BY_BADGE[badge];
  } else {
    result.actionGuide = Prisma.DbNull;
  }

  // --- details (why / symptoms) ---
  if (needsDetails(badge)) {
    const current = incoming.details ?? {};
    result.details = {
      whyTitle: !isEmptyBilingual(current.whyTitle)
        ? current.whyTitle
        : WHY_TITLE_TEMPLATE_BY_BADGE[badge],
      why: current.why ?? { vi: [], en: [] },
      symptomsTitle: !isEmptyBilingual(current.symptomsTitle)
        ? current.symptomsTitle
        : SYMPTOMS_TITLE_TEMPLATE,
      // Caution không cần triệu chứng (giữ đúng hành vi cũ ở FE)
      symptoms: badge === 'caution' ? { vi: [], en: [] } : current.symptoms ?? { vi: [], en: [] },
    };
  } else {
    result.details = Prisma.DbNull;
  }

  // --- benefits (benefits / feeding) ---
  if (needsBenefits(badge)) {
    const current = incoming.benefits ?? {};
    result.benefits = {
      benefitsTitle: !isEmptyBilingual(current.benefitsTitle)
        ? current.benefitsTitle
        : BENEFITS_TITLE_TEMPLATE,
      // Chỉ 'safe' mới thật sự có danh sách lợi ích, 'caution' luôn rỗng (giữ hành vi cũ ở FE)
      benefits: badge === 'safe' ? current.benefits ?? { vi: [], en: [] } : { vi: [], en: [] },
      feedingTitle: !isEmptyBilingual(current.feedingTitle)
        ? current.feedingTitle
        : FEEDING_TITLE_TEMPLATE,
      feeding: current.feeding ?? { vi: [], en: [] },
    };
  } else {
    result.benefits = Prisma.DbNull;
  }

  return result;
}