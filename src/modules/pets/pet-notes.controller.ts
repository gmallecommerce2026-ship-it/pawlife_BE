// src/modules/pets/pet-notes.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { PetNotesService } from './pet-notes.service';

@Controller('pets/:petId/notes')
@UseGuards(JwtAuthGuard)
export class PetNotesController {
  constructor(private readonly petNotesService: PetNotesService) {}

  @Get()
  async getNotes(@Param('petId') petId: string) {
    return this.petNotesService.getNotes(petId);
  }

  @Post()
  async createNote(
    @Req() req: any,
    @Param('petId') petId: string,
    @Body('content') content: string,
  ) {
    return this.petNotesService.createNote(req.user.id, petId, content);
  }

  @Delete(':noteId')
  async deleteNote(
    @Req() req: any,
    @Param('petId') petId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.petNotesService.deleteNote(req.user.id, petId, noteId);
  }
}