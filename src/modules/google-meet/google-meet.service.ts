// src/modules/google-meet/google-meet.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

interface CreateMeetEventInput {
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  attendeeEmails: string[];
}

interface MeetEventResult {
  eventId: string;
  meetLink: string;
}

@Injectable()
export class GoogleMeetService {
  private readonly logger = new Logger(GoogleMeetService.name);
  private readonly calendarId: string;
  private readonly authClient: JWT;

  constructor(private readonly config: ConfigService) {
    const clientEmail = this.config.get<string>('GOOGLE_SA_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('GOOGLE_SA_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');
    // Optional: chỉ set khi Workspace admin đã cấp domain-wide delegation
    // cho service account này với scope calendar, tại Admin Console >
    // Security > API controls > Domain-wide Delegation.
    const impersonateEmail = this.config.get<string>('GOOGLE_WORKSPACE_IMPERSONATE_EMAIL');
    this.calendarId = this.config.get<string>('GOOGLE_CALENDAR_ID') || 'primary';

    if (!clientEmail || !privateKey) {
      this.logger.warn(
        'Thiếu GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY trong env — GoogleMeetService sẽ luôn throw khi tạo phòng Meet.',
      );
    }

    this.authClient = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject: impersonateEmail || undefined,
    });
  }

  private calendar(): calendar_v3.Calendar {
    return google.calendar({ version: 'v3', auth: this.authClient });
  }

  async createMeetEvent(input: CreateMeetEventInput): Promise<MeetEventResult> {
    const requestId = `pawlife-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data } = await this.calendar().events.insert({
      calendarId: this.calendarId,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: input.title,
        description: input.description,
        start: { dateTime: input.startAt.toISOString() },
        end: { dateTime: input.endAt.toISOString() },
        attendees: input.attendeeEmails.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    const meetLink = data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video',
    )?.uri;

    if (!data.id || !meetLink) {
      throw new Error('Google không trả về Meet link hợp lệ.');
    }

    return { eventId: data.id, meetLink };
  }

  async updateMeetEvent(eventId: string, input: CreateMeetEventInput): Promise<MeetEventResult> {
    try {
      const { data } = await this.calendar().events.patch({
        calendarId: this.calendarId,
        eventId,
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: {
          summary: input.title,
          description: input.description,
          start: { dateTime: input.startAt.toISOString() },
          end: { dateTime: input.endAt.toISOString() },
          attendees: input.attendeeEmails.map((email) => ({ email })),
        },
      });

      const meetLink = data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video',
      )?.uri;

      if (!data.id || !meetLink) {
        // event cũ không có conferenceData (VD tạo tay trước đây) -> tạo lại mới
        return this.createMeetEvent(input);
      }
      return { eventId: data.id, meetLink };
    } catch (err: any) {
      if (err?.code === 404) {
        // event đã bị xoá bên Google Calendar -> tạo mới thay thế
        return this.createMeetEvent(input);
      }
      throw err;
    }
  }

  async cancelMeetEvent(eventId: string): Promise<void> {
    try {
      await this.calendar().events.delete({
        calendarId: this.calendarId,
        eventId,
        sendUpdates: 'all',
      });
    } catch (err: any) {
      if (err?.code === 404 || err?.code === 410) return;
      throw err;
    }
  }
}