import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { loadConfig } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MediaModule } from './media/media.module';
import { TrackingModule } from './tracking/tracking.module';
import { RatingsModule } from './ratings/ratings.module';
import { ArtworkModule } from './artwork/artwork.module';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Single source of truth: the repo-root .env (relative to apps/api cwd).
      // In Docker, vars are injected directly and the missing file is ignored.
      envFilePath: ['../../.env'],
      load: [loadConfig],
    }),
    // Available app-wide so the global JwtAuthGuard can verify access tokens.
    JwtModule.register({}),
    PrismaModule,
    AuthModule,
    UsersModule,
    MediaModule,
    TrackingModule,
    RatingsModule,
    ArtworkModule,
  ],
  controllers: [AppController],
  providers: [
    // Global request validation against the shared Zod contracts.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Auth runs first (populates request.user), then role checks.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
