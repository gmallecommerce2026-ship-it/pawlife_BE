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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth.service");
const auth_dto_1 = require("../dto/auth.dto");
const user_decorator_1 = require("../../../common/decorators/user.decorator");
const jwt_guard_1 = require("../guards/jwt.guard");
const throttler_1 = require("@nestjs/throttler");
const skip_profile_check_decorator_1 = require("../../../common/decorators/skip-profile-check.decorator");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async sendOtp(sendOtpDto) {
        return this.authService.sendOtp(sendOtpDto);
    }
    async register(registerDto) {
        return this.authService.register(registerDto);
    }
    async resetPassword(resetPasswordDto) {
        return this.authService.resetPassword(resetPasswordDto);
    }
    async getProfile(user) {
        return user;
    }
    async changePassword(userId, changePasswordDto) {
        return this.authService.changePassword(userId, changePasswordDto);
    }
    async login(loginDto, userAgent, deviceNameHeader, deviceOsHeader, deviceIdHeader, forwardedIp, ip) {
        const realIp = forwardedIp ? forwardedIp.split(',')[0] : ip;
        return this.authService.login(loginDto, userAgent, realIp, deviceNameHeader, deviceOsHeader, deviceIdHeader);
    }
    async register2FA(user) {
        return this.authService.generateTwoFactorAuthenticationSecret(user.id, user.email);
    }
    async turnOn2FA(userId, code) {
        return this.authService.turnOnTwoFactorAuthentication(userId, code);
    }
    async turnOff2FA(userId) {
        return this.authService.turnOffTwoFactorAuthentication(userId);
    }
    async loginWith2fa(tempToken, code, userAgent, deviceNameHeader, deviceOsHeader, forwardedIp, ip) {
        const realIp = forwardedIp ? forwardedIp.split(',')[0] : ip;
        return this.authService.loginWith2fa(tempToken, code, userAgent, realIp, deviceNameHeader, deviceOsHeader);
    }
    async updateMyProfile(userId, updateData) {
        return this.authService.updateProfile(userId, updateData);
    }
    async socialLogin(socialLoginDto, userAgent, deviceNameHeader, deviceOsHeader, forwardedIp, ip) {
        const realIp = forwardedIp ? forwardedIp.split(',')[0] : ip;
        console.log("social login start debugging!");
        return this.authService.socialLogin(socialLoginDto, userAgent, realIp, deviceNameHeader, deviceOsHeader);
    }
    async getDevices(user) {
        return this.authService.getDevices(user.id, user.sessionId);
    }
    async logoutDevice(userId, deviceId) {
        return this.authService.logoutDevice(userId, deviceId);
    }
    async deleteAccount(userId) {
        return this.authService.deleteAccount(userId);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    (0, common_1.Post)('send-otp'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.SendOtpDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "sendOtp", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 60000 } }),
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, auth_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('user-agent')),
    __param(2, (0, common_1.Headers)('x-device-name')),
    __param(3, (0, common_1.Headers)('x-device-os')),
    __param(4, (0, common_1.Headers)('x-device-id')),
    __param(5, (0, common_1.Headers)('x-forwarded-for')),
    __param(6, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('2fa/generate'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register2FA", null);
__decorate([
    (0, common_1.Post)('2fa/turn-on'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Body)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "turnOn2FA", null);
__decorate([
    (0, common_1.Post)('2fa/turn-off'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "turnOff2FA", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.Post)('login/2fa'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)('tempToken')),
    __param(1, (0, common_1.Body)('code')),
    __param(2, (0, common_1.Headers)('user-agent')),
    __param(3, (0, common_1.Headers)('x-device-name')),
    __param(4, (0, common_1.Headers)('x-device-os')),
    __param(5, (0, common_1.Headers)('x-forwarded-for')),
    __param(6, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginWith2fa", null);
__decorate([
    (0, common_1.Patch)('me/profile'),
    (0, skip_profile_check_decorator_1.SkipProfileCheck)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, auth_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateMyProfile", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.Post)('social-login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('user-agent')),
    __param(2, (0, common_1.Headers)('x-device-name')),
    __param(3, (0, common_1.Headers)('x-device-os')),
    __param(4, (0, common_1.Headers)('x-forwarded-for')),
    __param(5, (0, common_1.Ip)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.SocialLoginDto, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "socialLogin", null);
__decorate([
    (0, common_1.Get)('devices'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    __param(0, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getDevices", null);
__decorate([
    (0, common_1.Delete)('logout-device/:deviceId'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, user_decorator_1.User)('id')),
    __param(1, (0, common_1.Param)('deviceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logoutDevice", null);
__decorate([
    (0, common_1.Delete)('account'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, user_decorator_1.User)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "deleteAccount", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map