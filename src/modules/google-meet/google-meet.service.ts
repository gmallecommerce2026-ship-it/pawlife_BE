// src/modules/google-meet/google-meet.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface CreateMeetEventInput {
    title: string;
    description?: string;
    startAt: Date;
    endAt: Date;
    attendeeEmails?: string[];
}

interface MeetEventResult {
    eventId: string;
    meetLink: string;
}

@Injectable()
export class GoogleMeetService {
    private readonly logger = new Logger(GoogleMeetService.name);
    private readonly calendarId: string;
    private readonly organizerEmail: string | undefined;
    private readonly oauth2Client: OAuth2Client;
    private ready = false;

    constructor(private readonly config: ConfigService) {
        const clientId = this.config.get<string>('GOOGLE_MEET_CLIENT_ID');
        const clientSecret = this.config.get<string>('GOOGLE_MEET_CLIENT_SECRET');
        const redirectUri = this.config.get<string>('GOOGLE_MEET_REDIRECT_URI');
        const refreshToken = this.config.get<string>('GOOGLE_MEET_REFRESH_TOKEN');
        this.organizerEmail = this.config.get<string>('GOOGLE_MEET_ORGANIZER_EMAIL');

        // Nếu không set riêng GOOGLE_MEET_CALENDAR_ID thì mặc định dùng lịch của
        // chính organizer (tài khoản đã cấp refresh token) — 'primary' cũng chạy
        // được vì refresh token luôn gắn với 1 tài khoản cụ thể.
        this.calendarId =
            this.config.get<string>('GOOGLE_MEET_CALENDAR_ID') ||
            this.organizerEmail ||
            'primary';

        this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

        if (!clientId || !clientSecret) {
            this.logger.warn(
                'Thiếu GOOGLE_MEET_CLIENT_ID / GOOGLE_MEET_CLIENT_SECRET — GoogleMeetService sẽ luôn throw khi tạo phòng Meet.',
            );
            return;
        }

        if (!refreshToken) {
            this.logger.warn(
                'Thiếu GOOGLE_MEET_REFRESH_TOKEN — cần chạy flow xin quyền 1 lần (xem GoogleAuthController) trước khi dùng tính năng Meet.',
            );
            return;
        }

        this.oauth2Client.setCredentials({ refresh_token: refreshToken });
        this.ready = true;
        this.logger.log(
            `GoogleMeetService sẵn sàng — sự kiện sẽ được tạo trên lịch: ${this.calendarId}`,
        );
    }

    // Dùng khi cần lấy refresh token mới (lần đầu setup hoặc sau khi revoke quyền cũ)
    generateAuthUrl(): string {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent', // bắt buộc để Google luôn trả refresh_token
            scope: ['https://www.googleapis.com/auth/calendar'],
            login_hint: this.organizerEmail, // gợi ý đăng nhập đúng tài khoản organizer
        });
    }

    async exchangeCodeForRefreshToken(code: string): Promise<string> {
        const { tokens } = await this.oauth2Client.getToken(code);
        if (!tokens.refresh_token) {
            throw new Error(
                'Google không trả refresh_token (tài khoản này có thể đã từng cấp quyền trước đó — hãy revoke ở myaccount.google.com/permissions rồi thử lại).',
            );
        }
        this.oauth2Client.setCredentials(tokens);
        this.ready = true;
        return tokens.refresh_token; // -> lưu giá trị này vào env GOOGLE_MEET_REFRESH_TOKEN
    }

    private assertReady() {
        if (!this.ready) {
            throw new Error(
                'GoogleMeetService chưa được cấu hình đầy đủ (thiếu client id/secret hoặc refresh token).',
            );
        }
    }

    private calendar(): calendar_v3.Calendar {
        return google.calendar({ version: 'v3', auth: this.oauth2Client });
    }

    async createMeetEvent(input: CreateMeetEventInput): Promise<MeetEventResult> {
        this.assertReady();
        const requestId = `pawlife-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const { data } = await this.calendar().events.insert({
            calendarId: this.calendarId,
            conferenceDataVersion: 1,
            sendUpdates: 'none',
            requestBody: {
                summary: input.title,
                description: input.description,
                start: { dateTime: input.startAt.toISOString() },
                end: { dateTime: input.endAt.toISOString() },
                ...(input.attendeeEmails?.length
                    ? { attendees: input.attendeeEmails.map((email) => ({ email })) }
                    : {}),
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

        this.logger.log(`Đã tạo Google Meet event ${data.id} — link: ${meetLink}`);
        return { eventId: data.id, meetLink };
    }

    async updateMeetEvent(eventId: string, input: CreateMeetEventInput): Promise<MeetEventResult> {
        this.assertReady();
        try {
            const { data } = await this.calendar().events.patch({
                calendarId: this.calendarId,
                eventId,
                conferenceDataVersion: 1,
                sendUpdates: 'none',
                requestBody: {
                    summary: input.title,
                    description: input.description,
                    start: { dateTime: input.startAt.toISOString() },
                    end: { dateTime: input.endAt.toISOString() },
                    ...(input.attendeeEmails?.length
                        ? { attendees: input.attendeeEmails.map((email) => ({ email })) }
                        : {}),
                },
            });

            const meetLink = data.conferenceData?.entryPoints?.find(
                (ep) => ep.entryPointType === 'video',
            )?.uri;

            if (!data.id || !meetLink) {
                return this.createMeetEvent(input);
            }
            return { eventId: data.id, meetLink };
        } catch (err: any) {
            if (err?.code === 404) {
                return this.createMeetEvent(input);
            }
            throw err;
        }
    }

    async cancelMeetEvent(eventId: string): Promise<void> {
        this.assertReady();
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