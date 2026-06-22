// src/translate/translate.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { TranslateService } from './translate.service';

@Controller('translate')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  @Post()
  async translate(@Body() body: { text: string; targetLang: 'vi' | 'en' }) {
    const translatedText = await this.translateService.translate(body.text, body.targetLang);
    return { translatedText };
  }
}