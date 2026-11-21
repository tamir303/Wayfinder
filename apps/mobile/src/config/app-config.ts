export type AppEnv = 'dev' | 'staging' | 'prod';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppConfig = {
  appEnv: AppEnv;
  /** dev: no network at all, everything served from local mock data. */
  useMocks: boolean;
  /** staging logs at debug and hides nothing; prod logs at info. */
  logLevel: LogLevel;
  /** prod only: mask tokens/emails in logs and encrypt the web session at rest. */
  redact: boolean;
  encryptStorage: boolean;
  apiUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

type RawEnv = Record<string, string | undefined>;

const parseEnv = (value?: string): AppEnv => (value === 'staging' || value === 'prod' ? value : 'dev');

export const buildConfig = (raw: RawEnv): AppConfig => {
  const appEnv = parseEnv(raw.EXPO_PUBLIC_APP_ENV);
  const real = appEnv !== 'dev';
  const config: AppConfig = {
    appEnv,
    useMocks: !real,
    logLevel: appEnv === 'prod' ? 'info' : 'debug',
    redact: appEnv === 'prod',
    encryptStorage: appEnv === 'prod',
    apiUrl: raw.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    supabaseUrl: raw.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: raw.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
  if (real && (!config.supabaseUrl || !config.supabaseAnonKey || !raw.EXPO_PUBLIC_API_URL)) {
    throw new Error(`${appEnv}: EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required`);
  }
  return config;
};

// Expo only inlines EXPO_PUBLIC_* when they are referenced literally, so list them here.
export const config = buildConfig({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
