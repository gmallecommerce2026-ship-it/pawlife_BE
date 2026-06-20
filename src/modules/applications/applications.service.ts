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
        'You have 5 pending applications. Please wait for the results or close your old applications before submitting a new one.'
      );
    }

    // TÌM TẤT CẢ CÁC ĐƠN BẤT KỂ TRẠNG THÁI
    const existingApp = await this.prisma.adoptionApplication.findFirst({
      where: { 
        userId, 
        petId: data.petId,
      },
    });

    if (existingApp) {
      // Nếu có đơn đang mở -> Chặn lại
      if (existingApp.status !== 'CLOSED' && existingApp.status !== 'ADOPTION_COMPLETED') {
        throw new BadRequestException('You have already submitted an application for this pet.');
      }
      
      // Nếu có đơn nhưng đã bị CLOSED -> Tái sử dụng (Update) bản ghi cũ để không vi phạm luật Unique P2002
      return await this.prisma.adoptionApplication.update({
        where: { id: existingApp.id },
        data: {
          ...data,
          status: 'SUBMITTED',
        },
      });
    }

    // Nếu chưa từng có đơn nào -> Tạo mới bình thường
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
            id: true,         
            name: true,
            breed: true,
            dob: true,        // <--- BỔ SUNG TRƯỜNG NÀY
            images: true, 
            shelter: {        
              select: {
                id: true,     
                name: true,
              }
            }
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
      throw new NotFoundException('This adoption application was not found!');
    }

    return application;
  }

  async updateVerificationPhotos(userId: string, applicationId: string, photos: string[]) {
    // 1. Kiểm tra đơn có tồn tại và thuộc về user không
    const application = await this.prisma.adoptionApplication.findFirst({
      where: { 
        id: applicationId,
        userId: userId 
      },
    });

    if (!application) {
      throw new NotFoundException('This adoption application was not found!');
    }

    // 2. Tùy chọn: Validate trạng thái (chỉ cho phép upload khi đang cần thêm thông tin)
    if (application.status !== 'NEED_MORE_INFO') {
      throw new BadRequestException('The application currently requires no additional information.');
    }

    // 3. Cập nhật ảnh và chuyển trạng thái về PENDING
    return await this.prisma.adoptionApplication.update({
      where: { id: applicationId },
      data: { 
        verificationPhotos: photos,
        status: 'PENDING', // Đổi trạng thái để Shelter duyệt tiếp
      },
    });
  }

  async withdrawApplication(userId: string, applicationId: string) {
    // Kiểm tra xem đơn có tồn tại và thuộc về user đang đăng nhập không
    const application = await this.prisma.adoptionApplication.findFirst({
      where: { 
        id: applicationId,
        userId: userId 
      },
    });

    if (!application) {
      throw new NotFoundException('This adoption application was not found!');
    }

    // Không cho phép rút đơn nếu đã đóng hoặc đã hoàn thành
    if (application.status === 'CLOSED' || application.status === 'ADOPTION_COMPLETED') {
      throw new BadRequestException('The application cannot be withdrawn in this status!');
    }

    // Cập nhật trạng thái thành CLOSED
    return await this.prisma.adoptionApplication.update({
      where: { id: applicationId },
      data: { status: 'CLOSED' },
    });
  }
}