import type { Env } from '../src/config/env';

export const testEnv: Env = {
  SERPAPI_KEY: 'test-key',
  SUPABASE_URL: 'https://proj.supabase.co',
  DATABASE_URL: 'postgresql://test',
  REDIS_URL: 'redis://test',
  DAILY_CREDIT_CAP: 200,
  APP_ENV: 'dev',
  HANDOFF_SECRET: 'test-handoff-secret-that-is-long-enough-for-hmac',
  PUBLIC_API_URL: 'http://api.test',
  RATE_LIMIT_PER_MINUTE: 1000,
  NODE_ENV: 'test',
  MOCK_DATA: false,
};
