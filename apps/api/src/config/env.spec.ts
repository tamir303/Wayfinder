import { parseEnv } from './env';

const valid = {
  SERPAPI_KEY: 'k',
  SUPABASE_URL: 'https://proj.supabase.co',
  DATABASE_URL: 'postgresql://x',
  REDIS_URL: 'redis://x',
  HANDOFF_SECRET: 'x'.repeat(40),
};

describe('parseEnv', () => {
  it('parses a valid env and applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.DAILY_CREDIT_CAP).toBe(200);
    expect(env.NODE_ENV).toBe('development');
    expect(env.APP_ENV).toBe('dev');
    expect(env.RATE_LIMIT_PER_MINUTE).toBe(120);
    expect(env.PUBLIC_API_URL).toBe('http://localhost:3000');
  });

  it('requires a handoff secret of at least 32 characters', () => {
    expect(() => parseEnv({ ...valid, HANDOFF_SECRET: 'short' })).toThrow('HANDOFF_SECRET');
  });

  it('rejects an unknown APP_ENV', () => {
    expect(() => parseEnv({ ...valid, APP_ENV: 'qa' })).toThrow('APP_ENV');
  });

  it('coerces DAILY_CREDIT_CAP from a string', () => {
    expect(parseEnv({ ...valid, DAILY_CREDIT_CAP: '5' }).DAILY_CREDIT_CAP).toBe(5);
  });

  it.each(['SERPAPI_KEY', 'SUPABASE_URL', 'DATABASE_URL', 'REDIS_URL', 'HANDOFF_SECRET'])(
    'throws when %s is missing',
    (key) => {
      const rest: Record<string, string> = { ...valid };
      delete rest[key];
      expect(() => parseEnv(rest)).toThrow(key);
    },
  );

  it('names the invalid keys but never leaks their values', () => {
    expect.assertions(2);
    try {
      parseEnv({ ...valid, SERPAPI_KEY: '', SUPABASE_URL: 'not-a-url' });
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toContain('SUPABASE_URL');
      expect(message).not.toContain('not-a-url');
    }
  });
});
