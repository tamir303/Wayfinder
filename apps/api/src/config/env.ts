import { z } from 'zod';

const EnvSchema = z.object({
  SERPAPI_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  // dev/staging log at debug with nothing hidden; prod logs at info with request payloads and query strings left out.
  APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  // Signs short-lived handoff links. Keep it long and random; rotating it invalidates open links.
  HANDOFF_SECRET: z.string().min(32),
  // Public base URL of this API, used to build absolute handoff links.
  PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  // MapLibre style URL of the tile provider (a client-side key is fine; it ships in the app). Unset = placeholder map.
  MAP_STYLE_URL: z.string().url().optional(),
  // Requests per minute per client IP, applied to every route.
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  // Comma-separated browser origins allowed to call the API (web build). Defaults to Expo web dev.
  CORS_ORIGINS: z.string().optional(),
  DAILY_CREDIT_CAP: z.coerce.number().int().positive().default(200),
  // NestJS Observe (errors, traces, logs). Reports only when both are set and APP_ENV is not dev. One Observe project per environment.
  OBSERVE_APP_KEY: z.string().min(1).optional(),
  OBSERVE_APP_SECRET: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // dev = mock backend: fixtures instead of SerpAPI, in-memory cache and database, any bearer token accepted.
  // Needs no secrets. Never allowed when NODE_ENV=production.
  MOCK_DATA: z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean().default(false)),
});

// Placeholders so the dev mock backend starts with an empty .env. Never used outside mock mode.
const MOCK_DEFAULTS = {
  SERPAPI_KEY: 'mock',
  SUPABASE_URL: 'http://localhost:54321',
  DATABASE_URL: 'mock',
  REDIS_URL: 'mock',
  HANDOFF_SECRET: 'dev-only-handoff-secret-not-for-real-use',
};

export type Env = z.infer<typeof EnvSchema>;

const stripEmpty = (raw: Record<string, unknown>) => Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== ''));

export const parseEnv = (raw: Record<string, unknown>): Env => {
  const appEnv = raw.APP_ENV ?? 'dev';
  const mock = appEnv === 'dev' && raw.MOCK_DATA !== 'false' && raw.MOCK_DATA !== false;
  if (mock && raw.NODE_ENV === 'production') {
    throw new Error('Invalid environment configuration: MOCK_DATA (the dev mock backend must not run with NODE_ENV=production)');
  }
  const result = EnvSchema.safeParse(mock ? { ...MOCK_DEFAULTS, ...stripEmpty(raw), MOCK_DATA: true } : raw);
  if (!result.success) {
    // Report only which keys are invalid, never their values.
    const keys = [...new Set(result.error.issues.map((i) => i.path.join('.')))];
    throw new Error(`Invalid environment configuration: ${keys.join(', ')}`);
  }
  return result.data;
};
