import type { Env } from '../src/config/env';

export const testEnv: Env = {
  SERPAPI_KEY: 'test-key',
  SUPABASE_URL: 'https://proj.supabase.co',
  DATABASE_URL: 'postgresql://test',
  REDIS_URL: 'redis://test',
  DAILY_CREDIT_CAP: 200,
  APP_ENV: 'dev',
  RATE_LIMIT_PER_MINUTE: 1000,
  NODE_ENV: 'test',
};
