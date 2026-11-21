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
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

export const parseEnv = (raw: Record<string, unknown>): Env => {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    // Report only which keys are invalid, never their values.
    const keys = [...new Set(result.error.issues.map((i) => i.path.join('.')))];
    throw new Error(`Invalid environment configuration: ${keys.join(', ')}`);
  }
  return result.data;
};
