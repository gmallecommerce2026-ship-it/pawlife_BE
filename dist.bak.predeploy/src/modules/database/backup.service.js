"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BackupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const r2_service_1 = require("../storage/r2.service");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let BackupService = BackupService_1 = class BackupService {
    configService;
    r2Service;
    logger = new common_1.Logger(BackupService_1.name);
    constructor(configService, r2Service) {
        this.configService = configService;
        this.r2Service = r2Service;
    }
    async handleDatabaseBackup() {
        this.logger.log('Bắt đầu tiến trình backup database...');
        const databaseUrl = this.configService.get('DATABASE_URL');
        if (!databaseUrl) {
            this.logger.error('Không tìm thấy DATABASE_URL trong environment.');
            return;
        }
        try {
            const dbUrl = new URL(databaseUrl);
            const user = dbUrl.username;
            const password = dbUrl.password;
            const host = dbUrl.hostname;
            const port = dbUrl.port || '3306';
            const database = dbUrl.pathname.replace('/', '');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `${database}-backup-${timestamp}.sql.gz`;
            const tempFilePath = path.resolve(__dirname, '../../..', fileName);
            const dumpCommand = `mysqldump -h ${host} -P ${port} -u ${user} -p${password} --opt --single-transaction --routines --triggers ${database} | gzip > ${tempFilePath}`;
            await execAsync(dumpCommand);
            this.logger.log(`Đã dump và nén database thành công: ${fileName}`);
            const fileBuffer = fs.readFileSync(tempFilePath);
            const s3Key = `database-backups/${fileName}`;
            await this.r2Service.uploadBuffer(fileBuffer, s3Key, 'application/gzip');
            this.logger.log(`Đã upload thành công lên R2 bucket: ${s3Key}`);
            fs.unlinkSync(tempFilePath);
            this.logger.log('Đã dọn dẹp file backup tạm ở local.');
        }
        catch (error) {
            this.logger.error(`Quá trình backup thất bại: ${error.message}`, error.stack);
        }
    }
};
exports.BackupService = BackupService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_2AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BackupService.prototype, "handleDatabaseBackup", null);
exports.BackupService = BackupService = BackupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        r2_service_1.R2Service])
], BackupService);
//# sourceMappingURL=backup.service.js.map