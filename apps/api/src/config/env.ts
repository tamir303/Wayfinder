import { z } from 'zod';

const EnvSchema = z.object({
  SERPAPI_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
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
