import { randomUUID } from 'node:crypto';
import type { LogLevel } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { Env } from '../config/env';

type AppEnv = Env['APP_ENV'];

export const logLevelsFor = (appEnv: AppEnv): LogLevel[] =>
  appEnv === 'prod' ? ['log', 'warn', 'error'] : ['log', 'warn', 'error', 'debug', 'verbose'];

const SAFE_ID = /^[A-Za-z0-9._-]{6,64}$/;

// One line per request with an id (also returned as x-request-id). Prod never logs query strings:
// they carry what users typed.
export const requestLogger =
  (appEnv: AppEnv, write: (line: string) => void = (line) => console.log(line)) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', id);
    const started = Date.now();
    res.on('finish', () => {
      const url = appEnv === 'prod' ? req.originalUrl.split('?')[0] : req.originalUrl;
      write(`[${id}] ${req.method} ${url} ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  };
