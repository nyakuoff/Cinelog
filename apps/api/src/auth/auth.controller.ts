import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthResponse, SetupStatus } from '@cinelog/contracts';
import { Public } from '../common/decorators';
import type { AppConfig } from '../config/configuration';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, SetupDto } from './auth.dto';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('status')
  async status(): Promise<SetupStatus> {
    return { needsSetup: await this.auth.needsSetup() };
  }

  @Public()
  @Post('setup')
  async setup(
    @Body() dto: SetupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const session = await this.auth.setup(dto);
    this.setRefreshCookie(res, session.refreshToken);
    return session.response;
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const session = await this.auth.register(dto);
    this.setRefreshCookie(res, session.refreshToken);
    return session.response;
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const session = await this.auth.login(dto);
    this.setRefreshCookie(res, session.refreshToken);
    return session.response;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const session = await this.auth.refresh(this.readRefreshCookie(req));
    this.setRefreshCookie(res, session.refreshToken);
    return session.response;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  // -- cookie helpers --------------------------------------------------------

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[REFRESH_COOKIE];
  }

  private setRefreshCookie(res: Response, token: string): void {
    const jwt = this.config.getOrThrow<AppConfig['jwt']>('jwt');
    res.cookie(REFRESH_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: jwt.refreshTtl * 1000,
    });
  }

  private cookieOptions(): CookieOptions {
    const isProd = this.config.get<AppConfig['nodeEnv']>('nodeEnv') === 'production';
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
    };
  }
}
