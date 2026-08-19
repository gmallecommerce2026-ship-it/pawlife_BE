// src/modules/integrations/google-meet/google-meet.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';

interface CreateMeetEventInput {
    title: string;
    description?: string;
    startAt: Date;
    endAt: Date;
    attendeeEmails: string[];
}
interface CreateMeetEventResult {
    eventId: string;
    meetLink: string;
}

@Injectable()
export class GoogleMeetService {
    private readonly logger = new Logger(GoogleMeetService.name);
    private readonly oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_MEET_CLIENT_ID,
        process.env.GOOGLE_MEET_CLIENT_SECRET,
    );
    private readonly calendarId = process.env.GOOGLE_MEET_ORGANIZER_EMAIL || 'primary';

    constructor() {
        this.oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_MEET_REFRESH_TOKEN });
    }

    private get calendar(): calendar_v3.Calendar {
        return google.calendar({ version: 'v3', auth: this.oauth2Client });
    }

    async createMeetEvent(input: CreateMeetEventInput): Promise<CreateMeetEventResult> {
        const requestId = `pawlife-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const { data } = await this.calendar.events.insert({
            calendarId: this.calendarId,
            conferenceDataVersion: 1,
            sendUpdates: 'all', // Google tự gửi mail mời + tạo lịch cho cả 2 bên
            requestBody: {
                summary: input.title,
                description: input.description,
                start: { dateTime: input.startAt.toISOString() },
                end: { dateTime: input.endAt.toISOString() },
                attendees: input.attendeeEmails.map((email) => ({ email })),
                conferenceData: {
                    createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
                },
            },
        });

        const meetEntry = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video');
        if (!meetEntry?.uri || !data.id) throw new Error('Không tạo được phòng Google Meet.');

        return { eventId: data.id, meetLink: meetEntry.uri };
    }
    async updateMeetEvent(eventId: string, input: CreateMeetEventInput): Promise<CreateMeetEventResult> {
        const { data } = await this.calendar.events.patch({
            calendarId: this.calendarId,
            eventId,
            sendUpdates: 'all',
            requestBody: {
                summary: input.title,
                description: input.description,
                start: { dateTime: input.startAt.toISOString() },
                end: { dateTime: input.endAt.toISOString() },
                attendees: input.attendeeEmails.map((email) => ({ email })),
            },
        });
        const meetEntry = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video');
        if (!meetEntry?.uri || !data.id) throw new Error('Không cập nhật được phòng Google Meet.');
        return { eventId: data.id, meetLink: meetEntry.uri };
    }
    async cancelMeetEvent(eventId: string) {
        try {
            await this.calendar.events.delete({ calendarId: this.calendarId, eventId, sendUpdates: 'all' });
        } catch (err) {
            this.logger.warn(`Không xoá được event Google Calendar ${eventId}`, err as Error);
        }
    }
}