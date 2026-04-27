// src/modules/tags/tags.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TagStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';

@Injectable()
export class TagsService {
  constructor(
    private prisma: PrismaService, 
    private notificationsService: NotificationsService
  ) {}
  
  async getTagReportDetail(id: string) {
    const report = await this.prisma.tagReport.findUnique({
      where: { id },
      include: {
        tag: {
          include: {
            pet: {
              include: {
                owner: true,
                images: true,
              },
            },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo quét thẻ này.');
    }

    return report;
  }
  
  async createTagReport(data: CreateTagReportDto) {
    const { tagId, ...reportData } = data;

    // 1. Lưu report vào database
    const report = await this.prisma.tagReport.create({
      data: {
        tagId: tagId,
        latitude: reportData.lat ?? reportData.latitude,
        longitude: reportData.lng ?? reportData.longitude,
        radius: reportData.radius,
        scannedBy: reportData.scannedBy,
        phoneNumber: reportData.phoneNumber,
        message: reportData.message,
      },
      include: {
        tag: {
          include: { 
            pet: {
              include: { owner: true }
            } 
          },
        },
      },
    });

    // 2. Sử dụng NotificationsService để thông báo cho chủ sở hữu
    // Hàm notifyOwner sẽ tự động xử lý: Lưu DB, Bắn Socket, và Gửi Push Notification
    await this.notificationsService.notifyOwner(report);

    return report;
  }

  async resolveTagReport(reportId: string) {
    const report = await this.prisma.tagReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo quét thẻ này.');
    }

    return this.prisma.tagReport.update({
      where: { id: reportId },
      data: { status: 'RESOLVED' },
    });
  }

  async scanTag(tagId: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      include: {
        pet: {
          include: {
            owner: true,
            images: true,
          },
        },
      },
    });

    if (!tag || !tag.pet) {
      throw new NotFoundException('Không tìm thấy thông tin vòng cổ hoặc thú cưng.');
    }

    const pet = tag.pet;
    const isLost = tag.status === TagStatus.LOST;

    return {
      id: pet.id,
      name: pet.name,
      breed: pet.breed || 'Chưa cập nhật',
      gender: pet.gender || 'unknown',
      color: pet.color || 'Chưa cập nhật',
      status: isLost ? 'lost' : 'safe',
      image: pet.images && pet.images.length > 0 ? pet.images[0].url : 'https://via.placeholder.com/600',
      owner: isLost ? {
        name: pet.contactName || pet.owner?.name || 'Người dùng ẩn danh',
        phone: pet.contactPhone || pet.owner?.phone || 'Chưa cung cấp số điện thoại',
        address: pet.contactAddress || 'Chưa cập nhật địa chỉ', 
        avatarUrl: pet.owner?.avatarUrl || null,
      } : null,
    };
  }
}