import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PrismaService } from '../../database/prisma/prisma.service';

interface PushJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(job: PushJobData) {
    const sessions = await this.prisma.deviceSession.findMany({
      where: { userId: job.userId, pushToken: { not: null } },
      select: { pushToken: true },
    });
    if (sessions.length === 0) return;

    const messages: ExpoPushMessage[] = [];
    for (const s of sessions) {
      if (!s.pushToken || !Expo.isExpoPushToken(s.pushToken)) continue;
      messages.push({
        to: s.pushToken,
        sound: 'default',
        title: job.title,
        body: job.body,
        data: job.data || {},
      });
    }
    if (messages.length === 0) return;

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        tickets.push(...(await this.expo.sendPushNotificationsAsync(chunk)));
      } catch (error) {
        this.logger.error('Lỗi gửi push notification qua Expo:', error);
      }
    }

    // Dọn token chết ngay khi Expo báo app đã gỡ cài đặt
    await Promise.all(
      tickets.map((ticket, i) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? this.prisma.deviceSession.updateMany({
              where: { pushToken: messages[i].to as string },
              data: { pushToken: null },
            })
          : Promise.resolve(),
      ),
    );
  }
}