import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from '../src/app.module';
import { applyCors } from '../src/common/cors';
import { applySwagger } from '../src/common/swagger';
import { ENV } from '../src/common/tokens';
import type { Env } from '../src/config/env';

// Cache the promise, not the result, so concurrent cold-start requests share one app.
let cached: Promise<express.Express> | undefined;

const createServer = async (): Promise<express.Express> => {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  applyCors(app, app.get<Env>(ENV));
  applySwagger(app);
  await app.init();
  return server;
};

const getServer = (): Promise<express.Express> => {
  cached ??= createServer().catch((error) => {
    cached = undefined; // do not cache a failed boot
    throw error;
  });
  return cached;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const server = await getServer();
  server(req, res);
}
