import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GoogleSheetsClient } from './google-sheets.client';
import { PetSheetController } from './pet-sheet.controller';
import { PetSheetService } from './pet-sheet.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PetSheetController],
  providers: [PetSheetService, GoogleSheetsClient],
  exports: [PetSheetService],
})
export class PetSheetModule { }