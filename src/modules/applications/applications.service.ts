// src/modules/applications/applications.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createApplication(userId: string, data: CreateApplicationDto) {
    const activeApplicationsCount = await this.prisma.adoptionApplication.count({
      where: {
        userId,
        status: {
          notIn: ['CLOSED', 'ADOPTION_COMPLETED'],
        },
      },
    });

    if (activeApplicationsCount >= 5) {
      throw new BadRequestException(
        'Bạn đang có 5 đơn đăng ký đang chờ xử lý. Vui lòng đợi kết quả hoặc đóng các đơn cũ trước khi gửi đơn mới.'
      );
    }

    const existingApp = await this.prisma.adoptionApplication.findFirst({
      where: { 
        userId, 
        petId: data.petId,
        status: { not: 'CLOSED' } 
      },
    });

    if (existingApp) {
      throw new BadRequestException('Bạn đã gửi đơn đăng ký cho thú cưng này rồi.');
    }

    return await this.prisma.adoptionApplication.create({
      data: {
        userId,
        ...data,
        status: 'SUBMITTED', 
      },
    });
  }

  async getMyApplications(userId: string) {
    const applications = await this.prisma.adoptionApplication.findMany({
      where: { userId },
      include: {
        pet: {
          select: {
            name: true,
            breed: true,
            images: true, 
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return applications;
  }

  // BỔ SUNG HÀM NÀY ĐỂ LẤY CHI TIẾT ĐƠN ỨNG TUYỂN
  async getApplicationById(userId: string, applicationId: string) {
    const application = await this.prisma.adoptionApplication.findFirst({
      where: { 
        id: applicationId,
        userId: userId 
      },
      include: {
        pet: {
          include: {
            images: { orderBy: { createdAt: 'asc' } },
            shelter: {
              select: { name: true, avatarUrl: true }
            }
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Không tìm thấy đơn đăng ký nhận nuôi này!');
    }

    return application;
  }
}