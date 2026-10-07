export type Lang = 'vi' | 'en';
export const normLang = (l?: string): Lang => (l === 'en' ? 'en' : 'vi');
export const loc = (vi: string, en: string, lang: Lang) => (lang === 'vi' ? vi : en);

/** Lấy chuỗi theo ngôn ngữ từ Json { vi, en } (hoặc string thường) */
export function pick(value: any, lang: Lang): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.vi ?? value.en ?? '';
}

export function toStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string' && v.trim() !== '');
}

export const uniq = <T>(arr: T[]) => Array.from(new Set(arr));

// ------------------------------ GEO ------------------------------
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 100) * 10} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

// ------------------------------ GIỜ MỞ CỬA ------------------------------
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayKey = (typeof DAY_KEYS)[number];
export type Interval = { open: string; close: string };
export type OpeningHours = Partial<Record<DayKey, Interval[] | null>>;

const DAY_LABELS: Record<DayKey, { vi: string; en: string }> = {
  mon: { vi: 'Thứ 2', en: 'Monday' },
  tue: { vi: 'Thứ 3', en: 'Tuesday' },
  wed: { vi: 'Thứ 4', en: 'Wednesday' },
  thu: { vi: 'Thứ 5', en: 'Thursday' },
  fri: { vi: 'Thứ 6', en: 'Friday' },
  sat: { vi: 'Thứ 7', en: 'Saturday' },
  sun: { vi: 'Chủ nhật', en: 'Sunday' },
};

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function to12h(s: string): string {
  const [h, m] = s.split(':').map(Number);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Tính trạng thái mở/đóng theo giờ Việt Nam (UTC+7). Chưa hỗ trợ ca qua nửa đêm. */
export function getOpenStatus(hours: OpeningHours | null | undefined, lang: Lang, now = new Date()) {
  if (!hours) return { isOpen: null as boolean | null, label: '', detail: '' };
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const dayIdx = vn.getUTCDay();
  const minutes = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  const today = hours[DAY_KEYS[dayIdx]] ?? [];

  for (const it of today) {
    if (minutes >= toMin(it.open) && minutes < toMin(it.close)) {
      return {
        isOpen: true,
        label: loc('Đang mở', 'Open now', lang),
        detail: loc(`đến ${to12h(it.close)}`, `until ${to12h(it.close)}`, lang),
      };
    }
  }

  let nextOpen: string | null = null;
  const laterToday = today.filter((it) => toMin(it.open) > minutes).sort((a, b) => toMin(a.open) - toMin(b.open))[0];
  if (laterToday) nextOpen = laterToday.open;
  else {
    for (let i = 1; i <= 7 && !nextOpen; i++) {
      const list = hours[DAY_KEYS[(dayIdx + i) % 7]] ?? [];
      if (list.length) nextOpen = [...list].sort((a, b) => toMin(a.open) - toMin(b.open))[0].open;
    }
  }
  return {
    isOpen: false,
    label: loc('Đã đóng cửa', 'Closed', lang),
    detail: nextOpen ? loc(`mở lúc ${to12h(nextOpen)}`, `opens ${to12h(nextOpen)}`, lang) : '',
  };
}

export function weeklyHours(hours: OpeningHours | null | undefined, lang: Lang) {
  if (!hours) return [];
  const order: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const todayIdx = DAY_KEYS[new Date(Date.now() + 7 * 3600 * 1000).getUTCDay()];
  return order.map((d) => {
    const list = hours[d] ?? [];
    return {
      day: d,
      label: DAY_LABELS[d][lang],
      isToday: d === todayIdx,
      isClosed: list.length === 0,
      text: list.length
        ? list.map((i) => `${to12h(i.open)} - ${to12h(i.close)}`).join(', ')
        : loc('Đóng cửa', 'Closed', lang),
    };
  });
}

// ------------------------------ KHÁC ------------------------------
export function timeAgo(date: Date, lang: Lang): string {
  const vi = lang === 'vi';
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 60) return vi ? 'Vừa xong' : 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return vi ? `${m} phút trước` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return vi ? `${h} giờ trước` : `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return vi ? `${d} ngày trước` : `${d} day${d > 1 ? 's' : ''} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return vi ? `${mo} tháng trước` : `${mo} month${mo > 1 ? 's' : ''} ago`;
  const y = Math.floor(mo / 12);
  return vi ? `${y} năm trước` : `${y} year${y > 1 ? 's' : ''} ago`;
}

export const formatPrice = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');