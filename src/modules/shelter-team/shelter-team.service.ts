import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ShelterStaffRole } from '@prisma/client';
import { renderInviteMemberEmail } from './templates/invite-member.template';

const INVITE_EXPIRY_DAYS = 7;

@Injectable()
export class ShelterTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

  private async assertShelterAdmin(userId: string, shelterId: string) {
    const requester = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!requester || requester.shelterId !== shelterId) {
      throw new ForbiddenException('Bạn không thuộc trạm này.');
    }
    if (requester.shelterRole !== ShelterStaffRole.ADMIN) {
      throw new ForbiddenException('Chỉ Quản trị viên mới có quyền quản lý tài khoản trạm.');
    }
    return requester;
  }

  async getTeam(shelterId: string) {
    const [members, invitations] = await Promise.all([
      this.prisma.user.findMany({
        where: { shelterId, isDeleted: false },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          shelterRole: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.shelterInvitation.findMany({
        where: { shelterId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { members, invitations };
  }

  async inviteMember(shelterId: string, inviterId: string, dto: { email: string; role: ShelterStaffRole; name?: string }) {
    const inviter = await this.assertShelterAdmin(inviterId, shelterId);

    const existingMember = await this.prisma.user.findFirst({
      where: { email: dto.email, shelterId },
    });
    if (existingMember) {
      throw new BadRequestException('Người này đã là thành viên của trạm.');
    }

    const existingInvite = await this.prisma.shelterInvitation.findFirst({
      where: { shelterId, email: dto.email, status: 'PENDING' },
    });
    if (existingInvite) {
      throw new BadRequestException('Đã có lời mời đang chờ với email này.');
    }

    const shelter = await this.prisma.shelter.findUnique({ where: { id: shelterId } });
    if (!shelter) throw new NotFoundException('Không tìm thấy trạm.');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.shelterInvitation.create({
      data: {
        shelterId,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt,
        invitedById: inviterId,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const inviteUrl = `${frontendUrl}/accept-invite?token=${token}`;

    const { subject, html } = renderInviteMemberEmail({
      shelterName: shelter.name,
      inviterName: inviter.name || 'Quản trị viên',
      role: dto.role,
      inviteUrl,
    });

    this.mailerService
      .sendMail({ to: dto.email, subject, html })
      .catch((err) => console.error('Gửi email mời thất bại:', err));

    return invitation;
  }

  async cancelInvitation(shelterId: string, requesterId: string, invitationId: string) {
    await this.assertShelterAdmin(requesterId, shelterId);

    const invitation = await this.prisma.shelterInvitation.findFirst({
      where: { id: invitationId, shelterId },
    });
    if (!invitation) throw new NotFoundException('Không tìm thấy lời mời.');

    await this.prisma.shelterInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });
    return { success: true };
  }

  async updateMemberRole(shelterId: string, requesterId: string, memberId: string, role: ShelterStaffRole) {
    await this.assertShelterAdmin(requesterId, shelterId);

    const member = await this.prisma.user.findFirst({ where: { id: memberId, shelterId } });
    if (!member) throw new NotFoundException('Không tìm thấy thành viên.');

    if (member.shelterRole === ShelterStaffRole.ADMIN && role !== ShelterStaffRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { shelterId, shelterRole: ShelterStaffRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Trạm phải có ít nhất 1 Quản trị viên.');
      }
    }

    return this.prisma.user.update({
      where: { id: memberId },
      data: { shelterRole: role },
      select: { id: true, name: true, email: true, avatarUrl: true, shelterRole: true, createdAt: true },
    });
  }

  async removeMember(shelterId: string, requesterId: string, memberId: string) {
    await this.assertShelterAdmin(requesterId, shelterId);

    if (requesterId === memberId) {
      throw new BadRequestException('Bạn không thể tự xoá chính mình khỏi trạm.');
    }

    const member = await this.prisma.user.findFirst({ where: { id: memberId, shelterId } });
    if (!member) throw new NotFoundException('Không tìm thấy thành viên.');

    if (member.shelterRole === ShelterStaffRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { shelterId, shelterRole: ShelterStaffRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Trạm phải có ít nhất 1 Quản trị viên.');
      }
    }

    await this.prisma.user.update({
      where: { id: memberId },
      data: { shelterId: null, shelterRole: null, role: 'USER' },
    });

    return { success: true };
  }

  // ---------- Public: accept invitation ----------

  async getInvitationByToken(token: string) {
    const invitation = await this.prisma.shelterInvitation.findUnique({
      where: { token },
      include: { shelter: { select: { name: true, avatarUrl: true } } },
    });
    if (!invitation) throw new NotFoundException('Lời mời không tồn tại.');
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Lời mời này đã được sử dụng hoặc bị thu hồi.');
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Lời mời đã hết hạn.');
    }

    return {
      email: invitation.email,
      role: invitation.role,
      shelterName: invitation.shelter.name,
      shelterAvatarUrl: invitation.shelter.avatarUrl,
    };
  }

  async acceptInvitation(token: string, dto: { name: string; password: string }) {
    const invitation = await this.prisma.shelterInvitation.findUnique({ where: { token } });
    if (!invitation) throw new NotFoundException('Lời mời không tồn tại.');
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Lời mời này đã được sử dụng hoặc bị thu hồi.');
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Lời mời đã hết hạn.');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: invitation.email } });

    await this.prisma.$transaction(async (tx) => {
      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            shelterId: invitation.shelterId,
            shelterRole: invitation.role,
            role: 'SHELTER',
            ...(existingUser.password ? {} : { password: await bcrypt.hash(dto.password, 10) }),
            name: existingUser.name || dto.name,
          },
        });
      } else {
        await tx.user.create({
          data: {
            email: invitation.email,
            name: dto.name,
            password: await bcrypt.hash(dto.password, 10),
            role: 'SHELTER',
            shelterId: invitation.shelterId,
            shelterRole: invitation.role,
          },
        });
      }

      await tx.shelterInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });
    });

    return { success: true, message: 'Tài khoản đã được kích hoạt. Vui lòng đăng nhập.' };
  }
}