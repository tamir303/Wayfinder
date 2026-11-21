import type { INestApplication } from '@nestjs/common';
import type { Env } from '../config/env';

const DEFAULT_ORIGINS = 'http://localhost:8081';

export const parseOrigins = (raw?: string): string[] =>
  (raw ?? DEFAULT_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

// Native apps send no Origin header; only the web build needs this. Requests from other origins get no CORS headers.
export const applyCors = (app: INestApplication, env: Pick<Env, 'CORS_ORIGINS'>): void => {
  app.enableCors({
    origin: parseOrigins(env.CORS_ORIGINS),
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  });
};
