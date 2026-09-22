"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const mailer_1 = require("@nestjs-modules/mailer");
const common_1 = require("@nestjs/common");
let MailProcessor = MailProcessor_1 = class MailProcessor extends bullmq_1.WorkerHost {
    mailerService;
    logger = new common_1.Logger(MailProcessor_1.name);
    constructor(mailerService) {
        super();
        this.mailerService = mailerService;
    }
    async process(job) {
        if (job.name === 'send-otp') {
            const { email, subject, otp, isSignUp } = job.data;
            this.logger.log(`Đang gửi email OTP tới: ${email}`);
            try {
                await this.mailerService.sendMail({
                    to: email,
                    subject: subject,
                    text: `Mã OTP của bạn là: ${otp}. Mã này sẽ hết hạn sau 5 phút.`,
                    html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #f97316;">${isSignUp ? 'Chào mừng bạn!' : 'Yêu cầu đặt lại mật khẩu'}</h2>
              <p>Bạn đã yêu cầu một mã OTP để ${isSignUp ? 'đăng ký tài khoản' : 'khôi phục mật khẩu'}.</p>
              <p>Mã xác nhận của bạn là:</p>
              <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 10px 20px; display: inline-block; border-radius: 8px; letter-spacing: 2px;">
                ${otp}
              </div>
              <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">* Lưu ý: Mã này sẽ hết hạn sau 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
            </div>
          `,
                });
                this.logger.log(`✅ Đã gửi email thành công tới: ${email}`);
            }
            catch (error) {
                this.logger.error(`❌ Lỗi gửi email tới ${email}:`, error);
                throw error;
            }
        }
    }
};
exports.MailProcessor = MailProcessor;
exports.MailProcessor = MailProcessor = MailProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('mail'),
    __metadata("design:paramtypes", [mailer_1.MailerService])
], MailProcessor);
//# sourceMappingURL=mail.processor.js.map