// src/modules/auth/controllers/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Delete, UseGuards, Headers, Ip, Param, Get } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { RegisterDto, LoginDto, SocialLoginDto, SendOtpDto, ResetPasswordDto, ChangePasswordDto } from '../dto/auth.dto';
import { User } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from '../guards/jwt.guard';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard) // Bắt buộc phải có token đăng nhập
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @User('id') userId: string, // Lấy userId từ token
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, changePasswordDto);
  }

  @Post('google')
  async googleLogin(@Body() body: { email: string; name: string; picture?: string }) {
    return this.authService.googleLogin(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Headers('user-agent') userAgent: string,
    @Headers('x-device-name') deviceNameHeader: string, // Thêm dòng này
    @Headers('x-device-os') deviceOsHeader: string,     // Thêm dòng này
    @Headers('x-forwarded-for') forwardedIp: string,    // Thêm dòng này để chuẩn bị cho deploy thật
    @Ip() ip: string,
  ) {
    const realIp = forwardedIp ? forwardedIp.split(',')[0] : ip;
    return this.authService.login(loginDto, userAgent, realIp, deviceNameHeader, deviceOsHeader);
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

  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  async socialLogin(
    @Body() socialLoginDto: SocialLoginDto,
    @Headers('user-agent') userAgent: string,
    @Headers('x-device-name') deviceNameHeader: string, // Thêm dòng này
    @Headers('x-device-os') deviceOsHeader: string,     // Thêm dòng này
    @Headers('x-forwarded-for') forwardedIp: string,
    @Ip() ip: string,
  ) {
    const realIp = forwardedIp ? forwardedIp.split(',')[0] : ip;
    console.log("social login start debugging!");
    return this.authService.socialLogin(socialLoginDto, userAgent, realIp, deviceNameHeader, deviceOsHeader);
  }
  @Get('devices')
  @UseGuards(JwtAuthGuard)
  async getDevices(@User() user: any) {
    // Lấy userId và sessionId từ token đã giải mã
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