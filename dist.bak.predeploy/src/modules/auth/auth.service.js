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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const auth_dto_1 = require("./dto/auth.dto");
const bcrypt = __importStar(require("bcrypt"));
const google_auth_library_1 = require("google-auth-library");
const axios_1 = __importDefault(require("axios"));
const apple_signin_auth_1 = __importDefault(require("apple-signin-auth"));
const mailer_1 = require("@nestjs-modules/mailer");
const r2_service_1 = require("../storage/r2.service");
const notifications_service_1 = require("../notifications/notifications.service");
const client_1 = require("@prisma/client");
const ua_parser_js_1 = require("ua-parser-js");
const geoip = __importStar(require("geoip-lite"));
const speakeasy = __importStar(require("speakeasy"));
const qrcode = __importStar(require("qrcode"));
const redis_service_1 = require("../../database/redis/redis.service");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const https = __importStar(require("https"));
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
let AuthService = class AuthService {
    prisma;
    mailerService;
    jwtService;
    r2Service;
    notificationsService;
    redisService;
    mailQueue;
    googleClient;
    constructor(prisma, mailerService, jwtService, r2Service, notificationsService, redisService, mailQueue) {
        this.prisma = prisma;
        this.mailerService = mailerService;
        this.jwtService = jwtService;
        this.r2Service = r2Service;
        this.notificationsService = notificationsService;
        this.redisService = redisService;
        this.mailQueue = mailQueue;
        this.googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }
    async sendOtp(dto) {
        const { email, type } = dto;
        if (type === auth_dto_1.OtpType.FORGOT_PASSWORD) {
            const userExists = await this.prisma.user.findUnique({ where: { email } });
            if (!userExists)
                throw new common_1.BadRequestException('Email không tồn tại trong hệ thống');
        }
        const otp = this.generateOTP();
        const redisKey = `auth:otp:${type}:${email}`;
        await this.redisService.set(redisKey, { otp }, 300);
        const isSignUp = type === auth_dto_1.OtpType.SIGNUP;
        const subject = isSignUp ? 'Mã xác nhận đăng ký tài khoản' : 'Mã xác nhận khôi phục mật khẩu';
        await this.mailQueue.add('send-otp', { email, subject, otp, isSignUp }, {
            removeOnComplete: true,
            attempts: 3,
        });
        return { message: 'Mã OTP đang được gửi đến email của bạn.' };
    }
    async verifyGoogleSignIn(idToken) {
        const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID, });
        const payload = ticket.getPayload();
        if (!payload || !payload.email)
            throw new Error('Invalid Google Token');
        const { email, name, picture } = payload;
        let user = await this.prisma.user.findUnique({ where: { email } });
        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = await this.prisma.user.create({ data: { email: email, name: name, avatarUrl: picture, }, });
        }
        const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
        return { accessToken, user, isNewUser, };
    }
    async getDevices(userId, currentSessionId) {
        const devices = await this.prisma.deviceSession.findMany({ where: { userId }, orderBy: { lastActive: 'desc' }, });
        return devices.map(device => ({ id: device.id, name: device.deviceName || 'Unknown Device', os: device.os || 'Unknown OS', location: device.location || 'Unknown Location', type: device.deviceType, isCurrentDevice: device.id === currentSessionId, lastActive: device.lastActive.toISOString(), }));
    }
    async logoutDevice(userId, deviceId) {
        const device = await this.prisma.deviceSession.findUnique({ where: { id: deviceId }, });
        if (!device || device.userId !== userId)
            throw new common_1.BadRequestException('Thiết bị không tồn tại hoặc không thuộc quyền sở hữu của bạn.');
        await this.prisma.deviceSession.delete({ where: { id: deviceId } });
        await this.redisService.del(`auth:session:${deviceId}`);
        return { success: true, message: 'Đã đăng xuất khỏi thiết bị.' };
    }
    generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }
    async changePassword(userId, dto) {
        const { currentPassword, newPassword } = dto;
        const user = await this.prisma.user.findUnique({ where: { id: userId }, });
        if (!user)
            throw new common_1.UnauthorizedException('Người dùng không tồn tại.');
        if (!user.password)
            throw new common_1.BadRequestException('Tài khoản này đăng nhập bằng mạng xã hội, không thể đổi mật khẩu.');
        const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordMatch)
            throw new common_1.BadRequestException('Mật khẩu hiện tại không chính xác.');
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({ where: { id: userId }, data: { password: hashedNewPassword }, });
        await this.notificationsService.createAndSendNotification({ userId: user.id, title: '🔒 Cập nhật mật khẩu', body: 'Bạn vừa thay đổi mật khẩu thành công. Nếu không phải bạn thực hiện, vui lòng liên hệ hỗ trợ ngay.', type: client_1.NotificationType.SECURITY, });
        await this.redisService.del(`auth:user_profile:${userId}`);
        return { message: 'Mật khẩu của bạn đã được thay đổi thành công.' };
    }
    async register(dto) {
        const { email, otp, password, name, phone, gender, dob, avatarUrl } = dto;
        const existingUser = await this.prisma.user.findUnique({ where: { email: email } });
        if (existingUser)
            throw new common_1.ConflictException('Địa chỉ email này đã được sử dụng!');
        const redisKey = `auth:otp:${auth_dto_1.OtpType.SIGNUP}:${email}`;
        const otpRecord = await this.redisService.get(redisKey);
        if (!otpRecord)
            throw new common_1.BadRequestException('Vui lòng gửi mã OTP trước khi đăng ký hoặc mã đã hết hạn');
        if (otpRecord.otp !== otp)
            throw new common_1.BadRequestException('Mã OTP không chính xác');
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await this.prisma.$transaction(async (tx) => {
            return await tx.user.create({ data: { email, password: hashedPassword, name, phone, gender, dob, avatarUrl, }, });
        });
        await this.redisService.del(redisKey);
        await this.notificationsService.createAndSendNotification({ userId: newUser.id, title: '🎉 Chào mừng đến với PawLife', body: 'Tài khoản của bạn đã được bảo mật thành công. Hãy bắt đầu hành trình cùng thú cưng nhé!', type: client_1.NotificationType.SECURITY, });
        return { message: 'Đăng ký thành công', user: newUser };
    }
    async resetPassword(dto) {
        const { email, otp, newPassword } = dto;
        const redisKey = `auth:otp:${auth_dto_1.OtpType.FORGOT_PASSWORD}:${email}`;
        const otpRecord = await this.redisService.get(redisKey);
        if (!otpRecord)
            throw new common_1.BadRequestException('Vui lòng gửi yêu cầu quên mật khẩu trước hoặc mã đã hết hạn.');
        if (otpRecord.otp !== otp)
            throw new common_1.BadRequestException('Mã OTP không chính xác.');
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updatedUser = await this.prisma.$transaction(async (tx) => {
            return await tx.user.update({
                where: { email },
                data: { password: hashedPassword },
            });
        });
        await this.redisService.del(redisKey);
        await this.redisService.del(`auth:user_profile:${updatedUser.id}`);
        await this.notificationsService.createAndSendNotification({
            userId: updatedUser.id,
            title: '🔒 Đổi mật khẩu thành công',
            body: 'Mật khẩu tài khoản của bạn vừa được cập nhật. Nếu bạn không thực hiện việc này, vui lòng liên hệ với chúng tôi ngay lập tức.',
            type: client_1.NotificationType.SECURITY,
        });
        return { message: 'Mật khẩu đã được thay đổi thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' };
    }
    async generateTwoFactorAuthenticationSecret(userId, email) {
        const secret = speakeasy.generateSecret({ name: `PawLife (${email})`, });
        await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret.base32 }, });
        if (!secret.otpauth_url)
            throw new common_1.InternalServerErrorException('Lỗi hệ thống: Không thể tạo URL cho 2FA.');
        const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);
        return { secret: secret.base32, qrCodeUrl: qrCodeDataUrl };
    }
    async turnOnTwoFactorAuthentication(userId, code) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.twoFactorSecret)
            throw new common_1.BadRequestException('Chưa tạo mã bí mật 2FA.');
        const isCodeValid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1, });
        if (!isCodeValid)
            throw new common_1.BadRequestException('Mã 2FA không chính xác.');
        await this.prisma.user.update({ where: { id: userId }, data: { isTwoFactorEnabled: true }, });
        return { message: 'Đã bật xác thực 2 bước thành công.' };
    }
    async turnOffTwoFactorAuthentication(userId) {
        await this.prisma.user.update({ where: { id: userId }, data: { isTwoFactorEnabled: false, twoFactorSecret: null }, });
        return { message: 'Đã tắt xác thực 2 bước.' };
    }
    async login(dto, userAgent, ip, deviceNameHeader, deviceOsHeader, deviceIdHeader) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user || !user.password)
            throw new common_1.UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.');
        const isPasswordMatch = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordMatch)
            throw new common_1.UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác.');
        if (user.isTwoFactorEnabled) {
            const tempToken = this.jwtService.sign({ userId: user.id, is2FAPending: true }, { expiresIn: '5m' });
            return { requires2FA: true, tempToken, message: 'Vui lòng nhập mã Authenticator để tiếp tục.', };
        }
        return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader, deviceIdHeader, dto.rememberMe);
    }
    async updateProfile(userId, updateData) {
        const allowedUpdates = {
            name: updateData.name,
            phone: updateData.phone,
            gender: updateData.gender,
            dob: updateData.dob,
            avatarUrl: updateData.avatarUrl,
        };
        Object.keys(allowedUpdates).forEach(key => allowedUpdates[key] === undefined && delete allowedUpdates[key]);
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: allowedUpdates,
        });
        await this.redisService.del(`auth:user_profile:${userId}`);
        return {
            message: 'Cập nhật thành công',
            user: updatedUser
        };
    }
    async loginWith2fa(tempToken, code, userAgent, ip, deviceNameHeader, deviceOsHeader) {
        let decoded;
        try {
            decoded = this.jwtService.verify(tempToken);
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Phiên đăng nhập 2FA đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (!decoded.is2FAPending)
            throw new common_1.UnauthorizedException('Token không hợp lệ.');
        const user = await this.prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user)
            throw new common_1.UnauthorizedException('Người dùng không tồn tại.');
        if (!user.twoFactorSecret)
            throw new common_1.UnauthorizedException('Tài khoản này chưa cài đặt mã bảo mật 2FA.');
        const isCodeValid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1, });
        if (!isCodeValid)
            throw new common_1.UnauthorizedException('Mã 2FA không chính xác.');
        return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader);
    }
    async deleteAccount(userId) {
        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId }, });
            if (!user)
                return { success: true };
            if (user.avatarUrl) {
                const fileKey = this.extractFileKey(user.avatarUrl);
                await this.r2Service.deleteFile(fileKey);
            }
            await this.prisma.$transaction(async (tx) => {
                const deletedEmail = `deleted_${Date.now()}_${user.email}`;
                await tx.user.update({ where: { id: userId }, data: { email: deletedEmail, password: '', avatarUrl: null, name: 'Deleted User', phone: null, isDeleted: true, deletedAt: new Date(), }, });
            });
            await this.redisService.del(`auth:user_profile:${userId}`);
            return { success: true, message: 'Tài khoản đã được xóa vĩnh viễn.' };
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Không thể xóa tài khoản lúc này');
        }
    }
    extractFileKey(url) { const urlObj = new URL(url); return urlObj.pathname.substring(1); }
    async socialLogin(dto, userAgent, ip, deviceNameHeader, deviceOsHeader) {
        let email;
        let name = dto.name || '';
        let picture = null;
        let gender = dto.gender || null;
        let dob = dto.dob ? new Date(dto.dob) : null;
        try {
            switch (dto.provider) {
                case 'GOOGLE': {
                    const ticket = await this.googleClient.verifyIdToken({ idToken: dto.token, audience: process.env.GOOGLE_CLIENT_ID, });
                    const payload = ticket.getPayload();
                    if (!payload || !payload.email)
                        throw new common_1.BadRequestException('Google token không hợp lệ.');
                    email = payload.email;
                    if (!name)
                        name = payload.name || email.split('@')[0];
                    picture = payload.picture || null;
                    break;
                }
                case 'FACEBOOK': {
                    const httpsAgent = new https.Agent({ family: 4 });
                    const { data } = await axios_1.default.get(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${dto.token}`, { httpsAgent });
                    if (!data)
                        throw new common_1.BadRequestException('Không thể kết nối với hệ thống Facebook.');
                    email = data.email || `${data.id}@facebook.pawlife.local`;
                    if (!name)
                        name = data.name || `User_${data.id.substring(0, 6)}`;
                    picture = data.picture?.data?.url || null;
                    break;
                }
                case 'APPLE': {
                    const payload = await apple_signin_auth_1.default.verifyIdToken(dto.token, { audience: process.env.APPLE_CLIENT_ID, ignoreExpiration: true, });
                    if (!payload || typeof payload.email !== 'string')
                        throw new common_1.BadRequestException('Apple token lỗi.');
                    email = payload.email;
                    if (!name)
                        name = email.split('@')[0];
                    break;
                }
                default: throw new common_1.BadRequestException('Provider không được hỗ trợ.');
            }
        }
        catch (error) {
            const realError = error?.response?.data?.error?.message || error?.message || 'Lỗi không xác định';
            console.error('Lỗi Social Login Thật:', realError);
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.UnauthorizedException(`Lỗi thật: ${realError}`);
        }
        let user = await this.prisma.user.findUnique({ where: { email }, });
        if (!user) {
            user = await this.prisma.user.create({ data: { email, name, avatarUrl: picture, gender: gender, dob: dob, }, });
        }
        else {
            const updateData = {};
            if (!user.name || user.name === 'User')
                updateData.name = name;
            if (!user.avatarUrl && picture)
                updateData.avatarUrl = picture;
            if (!user.gender && gender)
                updateData.gender = gender;
            if (!user.dob && dob)
                updateData.dob = dob;
            if (Object.keys(updateData).length > 0) {
                user = await this.prisma.user.update({ where: { email }, data: updateData });
            }
        }
        return await this.generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader);
    }
    async generateAuthResponse(user, userAgent, ip, deviceNameHeader, deviceOsHeader, deviceIdHeader, rememberMe) {
        let updatedData = {};
        let needsUpdate = false;
        if (!user.name || user.name.trim() === '' || user.name === 'User') {
            updatedData.name = user.email.split('@')[0];
            user.name = updatedData.name;
            needsUpdate = true;
        }
        if (!user.gender) {
            updatedData.gender = 'UNKNOWN';
            user.gender = updatedData.gender;
            needsUpdate = true;
        }
        if (needsUpdate) {
            await this.prisma.user.update({ where: { id: user.id }, data: updatedData, });
        }
        const parser = new ua_parser_js_1.UAParser(userAgent);
        const os = parser.getOS();
        const device = parser.getDevice();
        let deviceType = 'smartphone';
        if (device.type === 'tablet')
            deviceType = 'tablet';
        if (!device.type && (os.name === 'Mac OS' || os.name === 'Windows' || os.name === 'Linux' || os.name === 'Ubuntu')) {
            deviceType = 'laptop';
        }
        const geo = geoip.lookup(ip);
        const location = geo ? `${geo.city || ''}, ${geo.country || ''}`.replace(/^, |, $/g, '') || 'Unknown Location' : 'Unknown Location';
        const finalDeviceName = deviceNameHeader || device.model || os.name || 'Unknown Device';
        const finalOsName = deviceOsHeader || `${os.name || ''} ${os.version || ''}`.trim() || 'Unknown OS';
        let session = null;
        if (deviceIdHeader) {
            session = await this.prisma.deviceSession.findFirst({
                where: {
                    userId: user.id,
                    deviceIdentifier: deviceIdHeader,
                }
            });
        }
        if (!session) {
            session = await this.prisma.deviceSession.findFirst({
                where: {
                    userId: user.id,
                    deviceName: finalDeviceName,
                    os: finalOsName,
                }
            });
        }
        if (session) {
            session = await this.prisma.deviceSession.update({
                where: { id: session.id },
                data: {
                    lastActive: new Date(),
                    ipAddress: ip,
                    location: location,
                    deviceIdentifier: deviceIdHeader || session.deviceIdentifier,
                    deviceName: finalDeviceName,
                    os: finalOsName
                }
            });
        }
        else {
            const currentSessionsCount = await this.prisma.deviceSession.count({ where: { userId: user.id } });
            if (currentSessionsCount >= 10) {
                const oldestSession = await this.prisma.deviceSession.findFirst({
                    where: { userId: user.id },
                    orderBy: { lastActive: 'asc' }
                });
                if (oldestSession) {
                    await this.prisma.deviceSession.delete({ where: { id: oldestSession.id } });
                }
            }
            session = await this.prisma.deviceSession.create({
                data: {
                    userId: user.id,
                    deviceIdentifier: deviceIdHeader,
                    deviceName: finalDeviceName,
                    deviceType: deviceType,
                    os: finalOsName,
                    ipAddress: ip,
                    location: location,
                }
            });
        }
        const expiresIn = rememberMe ? '30d' : '1d';
        const redisTtlSeconds = rememberMe ? (30 * 24 * 60 * 60) : (24 * 60 * 60);
        await this.redisService.set(`auth:session:${session.id}`, "active", redisTtlSeconds);
        const payload = { userId: user.id, sessionId: session.id, email: user.email, role: user.role };
        const accessToken = this.jwtService.sign(payload, { expiresIn });
        const isProfileComplete = !!(user.name &&
            user.name !== 'User' &&
            user.name !== user.email.split('@')[0] &&
            user.phone &&
            user.gender &&
            user.gender !== 'UNKNOWN' &&
            user.dob &&
            user.avatarUrl);
        return {
            message: 'Đăng nhập thành công',
            accessToken,
            user: { id: user.id, email: user.email, name: user.name, phone: user.phone, gender: user.gender, dob: user.dob, avatarUrl: user.avatarUrl, isTwoFactorEnabled: user.isTwoFactorEnabled, isProfileComplete, },
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, bullmq_1.InjectQueue)('mail')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mailer_1.MailerService,
        jwt_1.JwtService,
        r2_service_1.R2Service,
        notifications_service_1.NotificationsService,
        redis_service_1.RedisService,
        bullmq_2.Queue])
], AuthService);
//# sourceMappingURL=auth.service.js.map