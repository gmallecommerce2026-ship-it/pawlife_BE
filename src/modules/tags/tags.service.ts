// src/modules/tags/tags.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service'; // Đảm bảo đường dẫn này đúng với dự án
import { NotificationType, TagStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTagReportDto } from './dto/create-tag-report.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService, private notificationsService: NotificationsService, private readonly notificationsGateway: NotificationsGateway) {}
  async createTagReport(data: CreateTagReportDto) {
    const { tagId, ...reportData } = data;

    // 1. Lưu report vào database
    const report = await this.prisma.tagReport.create({
      data: {
        tagId,
        ...reportData,
      },
      include: {
        tag: {
          include: {
            pet: true, // Lấy thông tin thú cưng để biết ai là chủ
          },
        },
      },
    });

    // 2. Gửi Notification cho người chủ
    const pet = report.tag?.pet;
    if (pet && pet.ownerId) {
      const notificationContent = `Có người vừa quét thẻ của ${pet.name}! ${
        reportData.message ? `Lời nhắn: "${reportData.message}"` : ''
      }`;

      // Lưu notification vào DB (Giả định có bảng Notification)
      const notification = await this.prisma.notification.create({
        data: {
          userId: pet.ownerId,
          title: 'Thú cưng của bạn đã được tìm thấy!',
          body: notificationContent, // Đổi từ 'content' thành 'body'
          type: 'TAG',               // Cập nhật giá trị khớp với enum NotificationType
          referenceId: report.id,    // Đổi từ 'relatedId' thành 'referenceId'
        },
      });

      // Đẩy thông báo realtime qua Socket.io về app của người chủ
      this.notificationsGateway.sendNotificationToUser(pet.ownerId, notification);
    }

    return report;
  }
  async scanTag(tagId: string) {
    // 1. Tìm thông tin Tag và các liên kết liên quan
    const tag = await this.prisma.tag.findUnique({
      where: { id: tagId },
      include: {
        pet: {
          include: {
            owner: true,     // Lấy thông tin User sở hữu
            images: true,    // Lấy danh sách ảnh của Pet
          },
        },
      },
    });

    // 2. Kiểm tra tồn tại
    if (!tag || !tag.pet) {
      throw new NotFoundException('Không tìm thấy thông tin vòng cổ hoặc thú cưng.');
    }

    const pet = tag.pet;
    const isLost = tag.status === TagStatus.LOST;

    // 2. Nếu thú cưng đang lạc, gửi thông báo cho chủ sở hữu
    if (isLost && pet.ownerId) {
      await this.notificationsService.createAndSendNotification({
        userId: pet.ownerId,
        title: '⚠️ Cảnh báo: Thú cưng bị quét mã!',
        body: `Ai đó vừa quét mã QR trên vòng cổ của bé ${pet.name}. Hãy kiểm tra thông tin liên hệ ngay!`,
        type: NotificationType.TAG,
        referenceId: tag.id,
      });
    }

    // 3. Định dạng dữ liệu trả về cho Frontend
    return {
      id: pet.id,
      name: pet.name,
      breed: pet.breed || 'Chưa cập nhật',
      gender: pet.gender || 'unknown',
      color: pet.color || 'Chưa cập nhật',
      status: isLost ? 'lost' : 'safe',
      image: pet.images && pet.images.length > 0 ? pet.images[0].url : 'https://via.placeholder.com/600',
      
      // Chỉ trả về object owner nếu trạng thái là LOST (Đi lạc)
      owner: isLost && pet.owner ? {
        name: pet.owner.name || 'Người dùng ẩn danh',
        phone: pet.owner.phone || 'Chưa cung cấp số điện thoại',
        // Trong bảng User hiện không có trường address, có thể để mặc định hoặc thêm vào schema sau
        address: 'Vui lòng gọi điện để biết vị trí', 
      } : null,
    };
  }
}