import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyCors } from './common/cors';
import { applySwagger } from './common/swagger';
import { ENV } from './common/tokens';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  applyCors(app, app.get<Env>(ENV));
  applySwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
