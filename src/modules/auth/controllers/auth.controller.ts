// src/modules/auth/controllers/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Delete, UseGuards, Headers, Ip, Param, Get, Req, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from '../auth.service';
import { RegisterDto, LoginDto, SocialLoginDto, SendOtpDto, ResetPasswordDto, ChangePasswordDto, UpdateProfileDto, RegisterShelterDto } from '../dto/auth.dto';
import { User } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { Throttle } from '@nestjs/throttler'; // BỔ SUNG IMPORT
import { SkipProfileCheck } from 'src/common/decorators/skip-profile-check.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  private setWebCookie(res: Response, token: string, rememberMe?: boolean) {
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: maxAge,
      path: '/',
    });
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } }) // BỔ SUNG: Tối đa 3 lần / 1 phút
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // BỔ SUNG: Chống spam đăng ký
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } }) // BỔ SUNG: Chống spam reset pass
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@User() user: any) {
    return user;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @User('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, changePasswordDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Headers('user-agent') userAgent: string,
    @Headers('x-device-name') deviceNameHeader: string,
    @Headers('x-device-os') deviceOsHeader: string,
    @Headers('x-device-id') deviceIdHeader: string,
    @Headers('x-client-type') clientType: string,
    @Headers('x-forwarded-for') forwardedIp: string,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const realIp = forwardedIp ? forwardedIp.split(',')[0] : ip;
    const result = await this.authService.login(loginDto, userAgent, realIp, deviceNameHeader, deviceOsHeader, deviceIdHeader);

    // SỬ DỤNG TYPE GUARD: Kiểm tra xem accessToken có nằm trong object result không
    if ('accessToken' in result) {
      if (clientType === 'web') {
        this.setWebCookie(res, result.accessToken, loginDto.rememberMe);

        // TypeScript lúc này đã biết chắc chắn result có accessToken
        const { accessToken, ...responseData } = result;
        return responseData;
      }
    }

    return result;
  }

  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  async register2FA(@User() user: any) {
    return this.authService.generateTwoFactorAuthenticationSecret(user.id, user.email);
  }

  @Post('2fa/turn-on')
  @UseGuards(JwtAuthGuard)
  async turnOn2FA(@User('id') userId: string, @Body('code') code: string) {
    return this.authService.turnOnTwoFactorAuthentication(userId, code);
  }

  @Post('2fa/turn-off')
  @UseGuards(JwtAuthGuard)
  async turnOff2FA(@User('id') userId: string) {
    return this.authService.turnOffTwoFactorAuthentication(userId);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } }) // BỔ SUNG
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  async loginWith2fa(
    @Body('tempToken') tempToken: string,
    @Body('code') code: string,
    @Headers('user-agent') userAgent: string,
    @Headers('x-device-name') deviceNameHeader: string,
    @Headers('x-device-os') deviceOsHeader: string,
    @Headers('x-forwarded-for') forwardedIp: string,
    @Ip() ip: string,
  ) {
    const realIp = forwardedIp ? forwardedIp.split(',')[0] : ip;
    return this.authService.loginWith2fa(tempToken, code, userAgent, realIp, deviceNameHeader, deviceOsHeader);
  }

  @Patch('me/profile')
  @SkipProfileCheck()
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(
    @User('id') userId: string,
    @Body() updateData: UpdateProfileDto // Nên tạo thêm UpdateProfileDto cho chuẩn chỉ
  ) {
    return this.authService.updateProfile(userId, updateData);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  async socialLogin(
    @Body() socialLoginDto: SocialLoginDto,
    @Headers('user-agent') userAgent: string,
    @Headers('x-device-name') deviceNameHeader: string,
    @Headers('x-device-os') deviceOsHeader: string,
    @Headers('x-forwarded-for') forwardedIp: string,
    @Headers('x-client-type') clientType: string,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const realIp = forwardedIp ? forwardedIp.split(',')[0] : ip;
    const result = await this.authService.socialLogin(socialLoginDto, userAgent, realIp, deviceNameHeader, deviceOsHeader);

    // SỬ DỤNG TYPE GUARD tương tự cho Social Login
    if ('accessToken' in result) {
      if (clientType === 'web') {
        this.setWebCookie(res, result.accessToken, true);

        const { accessToken, ...responseData } = result;
        return responseData;
      }
    }

    return result;
  }
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register-shelter')
  async registerShelter(@Body() dto: RegisterShelterDto) {
    return this.authService.registerShelter(dto);
  }
  @Post('logout/web')
  @HttpCode(HttpStatus.OK)
  async logoutWeb(@Res({ passthrough: true }) res: Response) {
    res.cookie('accessToken', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/',
    });
    return { success: true, message: 'Đã xóa phiên đăng nhập trên Web.' };
  }

  @Post('block/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @User('id') userId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.authService.blockUser(userId, targetUserId);
  }

  @Delete('block/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unblockUser(
    @User('id') userId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.authService.unblockUser(userId, targetUserId);
  }

  @Get('blocked-users')
  @UseGuards(JwtAuthGuard)
  async getBlockedUsers(@User('id') userId: string) {
    return this.authService.getBlockedUsers(userId);
  }
  @Post('report-user/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async reportUser(
    @User('id') userId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { reason: string; detail?: string; isBlockRequested?: boolean },
  ) {
    return this.authService.reportUser(
      userId,
      targetUserId,
      body.reason,
      body.detail,
      body.isBlockRequested,
    );
  }
  @Get('devices')
  @UseGuards(JwtAuthGuard)
  async getDevices(@User() user: any) {
    return this.authService.getDevices(user.id, user.sessionId);
  }

  @Delete('logout-device/:deviceId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutDevice(
    @User('id') userId: string,
    @Param('deviceId') deviceId: string
  ) {
    return this.authService.logoutDevice(userId, deviceId);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@User('id') userId: string) {
    return this.authService.deleteAccount(userId);
  }
}