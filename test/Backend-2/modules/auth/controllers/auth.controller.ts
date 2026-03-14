// src/modules/auth/controllers/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Delete, UseGuards } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { RegisterDto, LoginDto, SocialLoginDto, SendOtpDto } from '../dto/auth.dto';
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  async socialLogin(@Body() socialLoginDto: SocialLoginDto) {
    return this.authService.socialLogin(socialLoginDto);
  }
  @Delete('account')
  @UseGuards(JwtAuthGuard) 
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@User('id') userId: string) {
    return this.authService.deleteAccount(userId);
  }
}