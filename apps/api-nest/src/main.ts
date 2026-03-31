import 'reflect-metadata';

import { join, resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
type AppRuntimeConfig = {
  host: string;
  port: number;
  prefix: string;
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const config = configService.getOrThrow<AppRuntimeConfig>('app', {
    infer: true,
  });

  // Serve attachment storage files at /storage (used as internalBaseUrl for images sent to gateway)
  const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
    ? resolve(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
    : join(process.cwd(), 'storage');
  app.useStaticAssets(storageRoot, { prefix: '/storage' });

  if (config.prefix) {
    app.setGlobalPrefix(config.prefix);
  }

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(config?.port ?? 3001, config?.host ?? '0.0.0.0');
}

void bootstrap();
