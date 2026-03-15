import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}
  async createApplication(userId: string, data: CreateApplicationDto) {
    // 1. Kiểm tra xem user đã nộp đơn cho pet này chưa
    const existingApp = await this.prisma.adoptionApplication.findFirst({
      where: { userId, petId: data.petId },
    });

    if (existingApp) {
      throw new BadRequestException('You have already applied for this pet.');
    }

    // 2. Tạo đơn đăng ký mới
    const newApplication = await this.prisma.adoptionApplication.create({
      data: {
        userId,
        // Spread toàn bộ data từ DTO vào (fullName, phone, commitments,...)
        ...data, 
      },
    });

    return newApplication;
  }
  async getMyApplications(userId: string) {
    const applications = await this.prisma.adoptionApplication.findMany({
      where: { userId },
      include: {
        pet: {
          select: {
            name: true,
            breed: true,
            images: true, // Điều chỉnh field ảnh tùy theo schema Pet của bạn
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return applications;
  }
}