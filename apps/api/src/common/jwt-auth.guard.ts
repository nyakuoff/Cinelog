import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AppConfig } from '../config/configuration';
import type { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators';

/**
 * Global guard: requires a valid access token unless the route is @Public().
 * Verifies the Bearer token and attaches the decoded payload as request.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (isPublic) {
      // Public routes never require auth, but if a valid token is present we still
      // attach the user — this lets e.g. profile visibility checks tell "anonymous
      // visitor" from "signed-in visitor" without forcing every viewer to log in.
      if (token) {
        try {
          const payload = await this.decode(token);
          (request as Request & { user: AuthUser }).user = payload;
        } catch {
          /* invalid/expired token on a public route: treat as anonymous */
        }
      }
      return true;
    }

    if (!token) throw new UnauthorizedException('Missing access token');
    try {
      (request as Request & { user: AuthUser }).user = await this.decode(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private async decode(token: string): Promise<AuthUser> {
    const jwtConfig = this.config.get<AppConfig['jwt']>('jwt');
    const payload = await this.jwt.verifyAsync<AuthUser>(token, {
      secret: jwtConfig?.accessSecret,
    });
    return { sub: payload.sub, username: payload.username, role: payload.role };
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? value : undefined;
  }
}
