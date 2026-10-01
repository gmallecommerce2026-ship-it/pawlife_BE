// src/modules/applications/application-note.mapper.ts
import { Prisma } from '@prisma/client';

// Dùng lại ở MỌI chỗ query notes để không sót chỗ nào
export const NOTE_AUTHOR_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  role: true,
  shelterRole: true,
} satisfies Prisma.UserSelect;

export const NOTE_INCLUDE = {
  author: { select: NOTE_AUTHOR_SELECT },
} satisfies Prisma.ApplicationNoteInclude;

export type NoteWithAuthor = Prisma.ApplicationNoteGetPayload<{
  include: typeof NOTE_INCLUDE;
}>;

export const mapNote = (n: NoteWithAuthor) => {
  // User tạo trước khi có cột shelterRole sẽ là null:
  // nếu là tài khoản SHELTER thì coi như ADMIN để luôn có chip
  const authorRole =
    n.author?.shelterRole ?? (n.author?.role === 'SHELTER' ? 'ADMIN' : null);

  return {
    ...n, // giữ nguyên n.author để FE cũ đọc note.author?.name vẫn chạy
    authorName: n.author?.name ?? null,
    authorAvatar: n.author?.avatarUrl ?? null,
    authorRole,
  };
};