// prisma/seed-data/sources.ts
//
// Nguồn dữ liệu video YouTube cho Pawcare.
// Đây là "source of truth" duy nhất cần chỉnh tay khi thêm/bớt video —
// chỉ cần videoId (lấy từ URL YouTube, ví dụ watch?v=XXXXXXXXXXX).
//
// Title / views / time / duration / thumbnail KHÔNG được hardcode ở đây vì:
//   - views/time thay đổi liên tục theo thời gian thực -> hardcode = sai ngay khi seed
//   - title/duration nên lấy đúng từ YouTube thay vì gõ tay dễ sai chính tả
// -> Chạy `scripts/fetch-youtube-metadata.ts` để tự động điền các trường này
//    qua YouTube Data API v3, kết quả lưu ở `seed-data/metadata.json`.

export type PawcareCategory = 'Training' | 'Nutrition' | 'Health' | 'Beauty';

export interface SourceVideo {
  videoId: string;
}

export interface SourcePlaylist {
  /** Tên playlist hiển thị trong app Pawcare (đặt theo chủ đề nhóm video) */
  title: string;
  category: PawcareCategory;
  videos: SourceVideo[];
}

export const PAWCARE_SOURCES: SourcePlaylist[] = [
  // ================= TRAINING (Huấn luyện) =================
  {
    title: 'Huấn luyện cơ bản cho cún cưng',
    category: 'Training',
    videos: [
      { videoId: '6Fw1fw7mSw8' },
      { videoId: '3YMA5z2_l5o' },
      { videoId: 'Z-6bpySuu74' },
    ],
  },
  {
    title: 'Kỹ năng nâng cao & Sửa hành vi',
    category: 'Training',
    videos: [
      { videoId: 'LUtqlbp0XHE' },
      { videoId: 'anBLAjraj0U' },
      { videoId: 'yYjCGEfLarw' },
    ],
  },

  // ================= NUTRITION (Dinh dưỡng) =================
  {
    title: 'Dinh dưỡng cho thú cưng',
    category: 'Nutrition',
    videos: [
      { videoId: 'LCJ-mCY3iIE' },
      { videoId: 'wJp_8DJqupk' },
      { videoId: '93mJ6kT6sWc' },
    ],
  },

  // ================= HEALTH (Sức khoẻ) =================
  {
    title: 'Chăm sóc sức khỏe hàng ngày',
    category: 'Health',
    videos: [
      { videoId: 'lNyUxTlUnSo' },
      { videoId: 'lGmXsAOFPaM' },
      { videoId: '3kwGKlPE7WE' },
    ],
  },
  {
    title: 'Phòng bệnh & Sơ cứu cho thú cưng',
    category: 'Health',
    videos: [
      { videoId: 'lwVTARlM6NM' },
      { videoId: 'rvLoxBmlGJg' },
    ],
  },

  // ================= BEAUTY (Làm đẹp / Grooming) =================
  {
    title: 'Grooming tại nhà',
    category: 'Beauty',
    videos: [
      { videoId: 'hn4DEeRq5yM' },
      { videoId: 'rnuiQZLdM-U' },
      { videoId: 'g2LsUG-bMyc' },
    ],
  },
  {
    title: 'Chăm sóc lông & móng',
    category: 'Beauty',
    videos: [
      { videoId: 'DrrKANUwbvg' },
      { videoId: 'U1nWxai3S8Y' },
    ],
  },
];