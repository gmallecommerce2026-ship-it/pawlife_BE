import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3, sheets_v4 } from 'googleapis';
import { Readable } from 'stream';

export interface TabInfo { sheetId: number; title: string; rowCount: number; colCount: number }
export interface ValueRange { range: string; values: string[][] }

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;

@Injectable()
export class GoogleSheetsClient {
    private readonly logger = new Logger(GoogleSheetsClient.name);
    private sheets?: sheets_v4.Sheets;
    private drive?: drive_v3.Drive;
    private readonly folderId?: string;
    private readonly imageFolderId?: string;
    constructor(config: ConfigService) {
        this.folderId = config.get<string>('PET_SHEET_FOLDER_ID')?.trim() || undefined;
        const rawImg = config.get<string>('PET_IMAGE_FOLDER_ID')?.trim();
        this.imageFolderId = rawImg?.match(/folders\/([\w-]+)/)?.[1] ?? rawImg ?? undefined;
        const b64 = (config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON_B64') || '').trim();
        if (!b64) {
            this.logger.warn('Thiếu GOOGLE_SERVICE_ACCOUNT_JSON_B64 — tính năng đồng bộ Google Sheet đang tắt.');
            return;
        }
        try {
            const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
            });
            this.sheets = google.sheets({ version: 'v4', auth });
            this.drive = google.drive({ version: 'v3', auth });
        } catch (e: any) {
            this.logger.error(`GOOGLE_SERVICE_ACCOUNT_JSON_B64 không hợp lệ: ${e?.message}`);
        }
    }

    get ready() { return !!this.sheets && !!this.drive; }
    assertReady() {
        if (!this.ready) throw new ServiceUnavailableException('Chưa cấu hình GOOGLE_SERVICE_ACCOUNT_JSON_B64 trên server.');
    }

    async uploadXlsx(name: string, buffer: Buffer) {
        this.assertReady();
        const { data } = await this.drive!.files.create({
            requestBody: {
                name,
                mimeType: 'application/vnd.google-apps.spreadsheet',
                ...(this.folderId ? { parents: [this.folderId] } : {}),
            },
            media: { mimeType: XLSX_MIME, body: Readable.from(buffer) },
            fields: 'id,webViewLink',
        });
        return { id: data.id!, url: data.webViewLink ?? `https://docs.google.com/spreadsheets/d/${data.id}/edit` };
    }

    async share(fileId: string, email: string) {
        await this.drive!.permissions.create({
            fileId,
            sendNotificationEmail: false,
            requestBody: { type: 'user', role: 'writer', emailAddress: email },
        });
    }

    async modifiedTime(fileId: string): Promise<string> {
        const { data } = await this.drive!.files.get({ fileId, fields: 'modifiedTime' });
        return data.modifiedTime ?? '';
    }

    async exportXlsx(fileId: string): Promise<Buffer> {
        this.assertReady();
        const res = await this.drive!.files.export({ fileId, mimeType: XLSX_MIME }, { responseType: 'arraybuffer' });
        return Buffer.from(res.data as ArrayBuffer);
    }

    async tabs(id: string): Promise<TabInfo[]> {
        const { data } = await this.sheets!.spreadsheets.get({
            spreadsheetId: id,
            fields: 'sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))',
        });
        return (data.sheets ?? []).map((s) => ({
            sheetId: s.properties!.sheetId!,
            title: s.properties!.title!,
            rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
            colCount: s.properties?.gridProperties?.columnCount ?? 26,
        }));
    }

    async addTab(id: string, title: string): Promise<TabInfo> {
        const { data } = await this.sheets!.spreadsheets.batchUpdate({
            spreadsheetId: id,
            requestBody: { requests: [{ addSheet: { properties: { title } } }] },
        });
        const p = data.replies![0].addSheet!.properties!;
        return {
            sheetId: p.sheetId!,
            title: p.title!,
            rowCount: p.gridProperties?.rowCount ?? 1000,
            colCount: p.gridProperties?.columnCount ?? 26,
        };
    }

    async values(id: string, titles: string[]): Promise<string[][][]> {
        if (!titles.length) return [];
        const { data } = await this.sheets!.spreadsheets.values.batchGet({
            spreadsheetId: id,
            ranges: titles.map(q),
            valueRenderOption: 'FORMATTED_VALUE',
        });
        return (data.valueRanges ?? []).map((v) => (v.values ?? []) as string[][]);
    }

    async writeValues(id: string, data: ValueRange[]) {
        for (let i = 0; i < data.length; i += 400) {
            await this.sheets!.spreadsheets.values.batchUpdate({
                spreadsheetId: id,
                requestBody: { valueInputOption: 'RAW', data: data.slice(i, i + 400) },
            });
        }
    }

    async batchUpdate(id: string, requests: any[]) {
        if (!requests.length) return;
        await this.sheets!.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
    }
    async listImages(): Promise<{ id: string; name: string }[]> {
        this.assertReady();
        if (!this.imageFolderId) throw new ServiceUnavailableException('Chưa cấu hình PET_IMAGE_FOLDER_ID.');
        const out: { id: string; name: string }[] = [];
        const queue = [this.imageFolderId];
        const seen = new Set<string>();
        while (queue.length) {
            const folder = queue.shift()!;
            if (seen.has(folder)) continue;
            seen.add(folder);
            let pageToken: string | undefined;
            do {
                const { data } = await this.drive!.files.list({
                    q: `'${folder}' in parents and trashed=false`,
                    fields: 'nextPageToken, files(id,name,mimeType)',
                    pageSize: 1000, pageToken, supportsAllDrives: true, includeItemsFromAllDrives: true,
                });
                for (const f of data.files ?? []) {
                    if (f.mimeType === 'application/vnd.google-apps.folder') queue.push(f.id!);
                    else if (f.mimeType?.startsWith('image/')) out.push({ id: f.id!, name: f.name! });
                }
                pageToken = data.nextPageToken ?? undefined;
            } while (pageToken);
        }
        return out;
    }
    quote = q;
}