import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getApplicationById(userId: string, applicationId: string) {
    const application = await this.prisma.adoptionApplication.findFirst({
      where: { 
        id: applicationId,
        userId: userId // Đảm bảo chỉ lấy đơn của chính user đó
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
  
  async createApplication(userId: string, data: CreateApplicationDto) {
    // 1. Kiểm tra giới hạn 5 đơn đăng ký đang hoạt động
    const activeApplicationsCount = await this.prisma.adoptionApplication.count({
      where: {
        userId,
        status: {
          // Các đơn KHÔNG thuộc 2 trạng thái này thì được tính là đang hoạt động
          notIn: ['CLOSED', 'ADOPTION_COMPLETED'],
        },
      },
    });

    if (activeApplicationsCount >= 5) {
      throw new BadRequestException(
        'Bạn đang có 5 đơn đăng ký đang chờ xử lý. Vui lòng đợi kết quả hoặc đóng các đơn cũ trước khi gửi đơn mới.'
      );
    }

    // 2. Kiểm tra trùng lặp (User nộp nhiều đơn cho cùng 1 pet)
    const existingApp = await this.prisma.adoptionApplication.findFirst({
      where: { 
        userId, 
        petId: data.petId,
        status: { not: 'CLOSED' } // Cho phép nộp lại nếu đơn trước đó cho pet này đã bị CLOSED
      },
    });

    if (existingApp) {
      throw new BadRequestException('Bạn đã gửi đơn đăng ký cho thú cưng này rồi.');
    }

    // 3. Tạo đơn mới
    return await this.prisma.adoptionApplication.create({
      data: {
        userId,
        ...data,
        status: 'SUBMITTED', // Trạng thái mặc định khi mới tạo
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
}