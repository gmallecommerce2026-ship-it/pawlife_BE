// src/modules/pets/pet-notes.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class PetNotesService {
  constructor(private readonly prisma: PrismaService) {}

  private async hasPermission(userId: string, pet: any): Promise<boolean> {
    if (pet.ownerId === userId) return true;
    if (pet.shelterId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { shelterId: true },
      });
      if (user?.shelterId === pet.shelterId) return true;
    }
    return false;
  }

  async getNotes(petId: string) {
    const notes = await this.prisma.petNote.findMany({
      where: { petId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return notes.map((n) => ({
      id: n.id,
      author: n.author?.name ?? 'Ẩn danh',
      avatar: n.author?.avatarUrl ?? null,
      content: n.content,
      date: n.createdAt,
    }));
  }

  async createNote(userId: string, petId: string, content: string) {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet) throw new NotFoundException({ message: 'Pet not found!', i18n: { key: 'error.pet_not_found' } });

    if (!(await this.hasPermission(userId, pet))) {
      throw new ConflictException({
        message: 'You do not have permission to add notes to this pet!',
        i18n: { key: 'error.pet_unauthorized' },
      });
    }

    const trimmed = (content || '').trim();
    if (!trimmed) {
      throw new ConflictException({ message: 'Note content cannot be empty', i18n: { key: 'error.note_empty' } });
    }

    const note = await this.prisma.petNote.create({
      data: { petId, authorId: userId, content: trimmed },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return {
      id: note.id,
      author: note.author?.name ?? 'Ẩn danh',
      avatar: note.author?.avatarUrl ?? null,
      content: note.content,
      date: note.createdAt,
    };
  }

  async deleteNote(userId: string, petId: string, noteId: string) {
    const note = await this.prisma.petNote.findUnique({ where: { id: noteId } });
    if (!note || note.petId !== petId) {
      throw new NotFoundException({ message: 'Note not found!', i18n: { key: 'error.note_not_found' } });
    }
    // Chỉ cho tác giả tự xoá ghi chú của mình
    if (note.authorId !== userId) {
      throw new ConflictException({
        message: 'You can only delete your own notes!',
        i18n: { key: 'error.note_unauthorized' },
      });
    }
    await this.prisma.petNote.delete({ where: { id: noteId } });
    return { success: true, message: 'Note deleted', i18n: { key: 'success.note_deleted' } };
  }
}