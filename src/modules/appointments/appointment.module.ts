// appointments.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AppointmentsController } from './appointment.controller';
import { AppointmentsService } from './appointment.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}