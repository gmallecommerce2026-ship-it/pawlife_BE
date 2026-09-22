// src/translate/translate.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TranslateService {
    private readonly logger = new Logger(TranslateService.name);
    private readonly apiKey: string;

    constructor() {
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) {
            this.logger.warn('ANTHROPIC_API_KEY chưa được set trong .env — chức năng dịch sẽ không hoạt động.');
        }
        this.apiKey = key ?? '';
    }


    async translate(text: string, targetLang: 'vi' | 'en'): Promise<string> {
        if (!text?.trim()) return '';
        if (!this.apiKey) {
            this.logger.error('Không thể dịch: thiếu ANTHROPIC_API_KEY.');
            return text; // fallback an toàn — không mất dữ liệu user
        }

        const targetLabel = targetLang === 'vi' ? 'Vietnamese' : 'English';

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 300,
                    system: `You translate short pet-related text for a pet adoption app. Translate the given text to ${targetLabel}. Respond with ONLY the translated text — no quotes, no explanation.`,
                    messages: [{ role: 'user', content: text }],
                }),
            });

            if (!response.ok) {
                this.logger.error(`Translate API lỗi: ${response.status}`);
                return text; // fallback: không mất dữ liệu nếu API lỗi
            }

            const data = await response.json();
            return data?.content?.[0]?.text?.trim() || text;
        } catch (error) {
            this.logger.error('Lỗi gọi API dịch:', error);
            return text;
        }
    }
}