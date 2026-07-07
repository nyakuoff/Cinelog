import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import type { AppConfig } from './config/configuration';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  // All REST routes live under /api so the web app (and any client) has one
  // predictable base path; artwork is served at /api/artwork.
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<AppConfig['corsOrigins']>('corsOrigins'),
    credentials: true,
  });

  // Make Swagger understand Zod-based DTOs.
  patchNestJsSwagger();
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cinelog API')
    .setDescription('Self-hosted media watchlist & review platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.getOrThrow<AppConfig['port']>('port');
  await app.listen(port);
  new Logger('Bootstrap').log(`Cinelog API listening on http://localhost:${port}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
void bootstrap();
