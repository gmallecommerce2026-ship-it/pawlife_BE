import {
    BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Res,
    UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { PetSheetService } from './pet-sheet.service';
import { PetGridService } from './pet-grid.service';
import { buildWorkbook } from './pet-sheet.excel';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('shelter-dashboard/pet-sheet')
@UseGuards(JwtAuthGuard)
export class PetSheetController {
    constructor(private readonly svc: PetSheetService, private readonly grid: PetGridService) { }

    private shelterId(user: any): string {
        if (user?.role !== Role.SHELTER || !user?.shelterId) {
            throw new ForbiddenException('Chỉ tài khoản trạm cứu hộ mới dùng được tính năng này.');
        }
        return user.shelterId;
    }

    private sendXlsx(res: Response, buf: Buffer, name: string) {
        res.set({ 'Content-Type': XLSX_MIME, 'Content-Disposition': `attachment; filename="${name}"` });
        res.send(buf);
    }

    @Get('status')
    status(@User() user: any) {
        this.shelterId(user);
        return this.svc.status();
    }

    @Get('template')
    async template(@User() user: any, @Res() res: Response) {
        this.shelterId(user);
        this.sendXlsx(res, await buildWorkbook(), 'pawlife-pet-template.xlsx');
    }

    @Get('export')
    async export(@User() user: any, @Res() res: Response) {
        this.sendXlsx(res, await this.svc.exportXlsx(this.shelterId(user)), 'pawlife-pets.xlsx');
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
    async upload(@User() user: any, @UploadedFile() file: Express.Multer.File) {
        const sid = this.shelterId(user);
        if (!file) throw new BadRequestException('Chưa chọn file.');
        if (!file.originalname.toLowerCase().endsWith('.xlsx')) throw new BadRequestException('Chỉ nhận file .xlsx.');
        return this.svc.importWorkbook(sid, file.buffer);
    }
    @Post('images')
    images(@User() user: any) {
        return this.svc.syncImages(this.shelterId(user));
    }
    @Post('merge')
    merge(@User() user: any, @Query('dry') dry?: string) {
        return this.svc.mergeDuplicates(this.shelterId(user), dry !== '0');
    }
    // ───────────── Bảng chỉnh sửa trên web ─────────────
    @Get('grid')
    gridList(@User() user: any, @Query('species') sp?: string) {
        return this.grid.list(this.shelterId(user), sp === 'CAT' ? 'CAT' : 'DOG');
    }

    @Post('grid')
    gridCreate(@User() user: any, @Body() body: { species: string; fields?: any }) {
        return this.grid.create(this.shelterId(user), body?.species, body?.fields);
    }

    @Post('grid/batch')
    gridBatch(@User() user: any, @Body() body: { items: any }) {
        return this.grid.batch(this.shelterId(user), body?.items);
    }

    @Delete('grid/:id')
    gridRemove(@User() user: any, @Param('id') id: string) {
        return this.grid.remove(this.shelterId(user), id);
    }
}