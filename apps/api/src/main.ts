import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { logLevelsFor, requestLogger } from './common/logging';
import { parseEnv } from './config/env';
import { applyCors } from './common/cors';
import { applySwagger } from './common/swagger';
import { ENV } from './common/tokens';
import { ObserveInstrument } from './observe';
import type { Env } from './config/env';

async function bootstrap() {
  const env = parseEnv(process.env);
  const app = await NestFactory.create(AppModule, { logger: logLevelsFor(env.APP_ENV), instrument: ObserveInstrument });
  app.getHttpAdapter().getInstance().set('trust proxy', 1); // real client IP behind Vercel/proxies, for the rate limit
  app.use(requestLogger(env.APP_ENV));
  app.enableShutdownHooks();
  applyCors(app, app.get<Env>(ENV));
  applySwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
