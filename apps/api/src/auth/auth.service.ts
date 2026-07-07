import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import type { User } from '@prisma/client';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  SetupRequest,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { AppConfig } from '../config/configuration';
import type { AuthUser } from '../common/auth-user';

/** Result of issuing a session: the API response body plus the raw refresh token
 *  (which the controller sets as an httpOnly cookie). */
export interface IssuedSession {
  response: AuthResponse;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  private get jwtConfig(): AppConfig['jwt'] {
    return this.config.getOrThrow<AppConfig['jwt']>('jwt');
  }

  async needsSetup(): Promise<boolean> {
    const count = await this.prisma.user.count();
    return count === 0;
  }

  /** Creates the first admin. Fails if any user already exists. */
  async setup(dto: SetupRequest): Promise<IssuedSession> {
    if (!(await this.needsSetup())) {
      throw new ConflictException('Setup has already been completed');
    }
    const user = await this.createUser(dto, 'ADMIN');
    return this.issueSession(user);
  }

  /** Self-service registration for a normal user. */
  async register(dto: RegisterRequest): Promise<IssuedSession> {
    const user = await this.createUser(dto, 'USER');
    return this.issueSession(user);
  }

  async login(dto: LoginRequest): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return this.issueSession(user);
  }

  /** Rotate a refresh token: verify + revoke the old one, issue a fresh session. */
  async refresh(rawToken: string | undefined): Promise<IssuedSession> {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');

    try {
      await this.jwt.verifyAsync(rawToken, { secret: this.jwtConfig.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this.issueSession(user);
  }

  /** Revoke a refresh token on logout (idempotent). */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // -- helpers ---------------------------------------------------------------

  private async createUser(
    dto: SetupRequest | RegisterRequest,
    role: 'ADMIN' | 'USER',
  ): Promise<User> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, ...(dto.email ? [{ email: dto.email }] : [])],
      },
    });
    if (existing) throw new ConflictException('Username or email is already taken');

    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email ?? null,
        passwordHash,
        role,
      },
    });
  }

  private async issueSession(user: User): Promise<IssuedSession> {
    const payload: AuthUser = {
      sub: user.id,
      username: user.username,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig.accessTtl,
    });

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.jwtConfig.refreshSecret,
        expiresIn: this.jwtConfig.refreshTtl,
        jwtid: randomUUID(),
      },
    );

    const expiresAt = new Date(Date.now() + this.jwtConfig.refreshTtl * 1000);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: this.hashToken(refreshToken), expiresAt },
    });

    return {
      response: {
        user: this.users.toPublic(user),
        tokens: { accessToken, expiresIn: this.jwtConfig.accessTtl },
      },
      refreshToken,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
