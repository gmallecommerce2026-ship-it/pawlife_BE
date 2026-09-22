import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { R2Service } from '../storage/r2.service'; // Chỉnh đường dẫn cho đúng
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly r2Service: R2Service,
  ) {}

  // Chạy vào 2:00 AM mỗi ngày
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDatabaseBackup() {
    this.logger.log('Bắt đầu tiến trình backup database...');

    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      this.logger.error('Không tìm thấy DATABASE_URL trong environment.');
      return;
    }

    try {
      // 1. Parse DATABASE_URL (mysql://user:pass@host:port/dbname)
      const dbUrl = new URL(databaseUrl);
      const user = dbUrl.username;
      const password = dbUrl.password;
      const host = dbUrl.hostname;
      const port = dbUrl.port || '3306';
      const database = dbUrl.pathname.replace('/', '');

      // 2. Định dạng tên file backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${database}-backup-${timestamp}.sql.gz`;
      const tempFilePath = path.resolve(__dirname, '../../..', fileName); // Lưu tạm ở root folder

      // 3. Chạy lệnh mysqldump và nén ngay lập tức bằng gzip
      // Yêu cầu: OS của server chạy Node phải cài sẵn mysqldump và gzip
      const dumpCommand = `mysqldump -h ${host} -P ${port} -u ${user} -p${password} --opt --single-transaction --routines --triggers ${database} | gzip > ${tempFilePath}`;
      
      await execAsync(dumpCommand);
      this.logger.log(`Đã dump và nén database thành công: ${fileName}`);

      // 4. Đọc file và đẩy lên Cloudflare R2
      const fileBuffer = fs.readFileSync(tempFilePath);
      const s3Key = `database-backups/${fileName}`; // Lưu vào folder riêng trên bucket
      
      await this.r2Service.uploadBuffer(fileBuffer, s3Key, 'application/gzip');
      this.logger.log(`Đã upload thành công lên R2 bucket: ${s3Key}`);

      // 5. Xóa file temp ở local để tránh rác ổ cứng
      fs.unlinkSync(tempFilePath);
      this.logger.log('Đã dọn dẹp file backup tạm ở local.');

    } catch (error: any) {
      this.logger.error(`Quá trình backup thất bại: ${error.message}`, error.stack);
    }
  }
}