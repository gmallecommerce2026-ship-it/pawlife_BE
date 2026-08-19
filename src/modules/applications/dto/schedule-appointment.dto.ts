export class ScheduleAppointmentDto {
  title: string;
  format: 'Online' | 'Offline';
  location?: string | null;
  meetingLink?: string | null; // nếu để BE tự tạo link thì field này có thể bỏ hoặc chỉ dùng khi update
  scheduledAt: string;
  durationMinutes?: number;
  members: { id: string; name: string; note: string }[];
  reminderMinutesBefore: number;
  reviewNote: string;
}