import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from '../src/app.module';

let cached: express.Express | undefined;

const getServer = async (): Promise<express.Express> => {
  if (!cached) {
    const server = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: ['error', 'warn'],
    });
    await app.init();
    cached = server;
  }
  return cached;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const server = await getServer();
  server(req, res);
}
