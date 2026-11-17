import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { AppConfig } from './config/configuration';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  // Backup restore posts a whole library as one JSON document; express's
  // 100kb default rejected real backups with a 413.
  app.useBodyParser('json', { limit: '25mb' });
  const config = app.get(ConfigService);

  // All REST routes live under /api so the web app (and any client) has one
  // predictable base path; artwork is served at /api/artwork.
  app.setGlobalPrefix('api');
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<AppConfig['corsOrigins']>('corsOrigins'),
    credentials: true,
  });

  // Swagger is advertised in the README, so it stays on; ENABLE_SWAGGER=false skips building the document.
  if (process.env.ENABLE_SWAGGER !== 'false') {
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
  }

  const port = config.getOrThrow<AppConfig['port']>('port');
  await app.listen(port);
  new Logger('Bootstrap').log(`Cinelog API listening on http://localhost:${port}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
void bootstrap();
