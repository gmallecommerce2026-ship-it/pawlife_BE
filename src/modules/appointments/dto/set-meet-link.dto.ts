// dto/set-meet-link.dto.ts
import { IsUrl } from 'class-validator';

export class SetMeetLinkDto {
  @IsUrl()
  meetLink: string;
}