import { Body, Controller, Post } from '@nestjs/common';
import { SupportService } from './support.service';
import { SendContactMessageDto } from './dto/support.dto';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('contact')
  async sendContact(@Body() dto: SendContactMessageDto) {
    return this.supportService.sendContactMessage(dto);
  }
}