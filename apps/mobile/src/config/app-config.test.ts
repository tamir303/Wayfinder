import { buildConfig } from './app-config';
import { createLogger, redactValue } from '../lib/logger';

const real = {
  EXPO_PUBLIC_API_URL: 'https://api.example',
  EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
};

describe('buildConfig', () => {
  it('dev uses mocks, debug logs, nothing hidden', () => {
    expect(buildConfig({})).toMatchObject({ appEnv: 'dev', useMocks: true, logLevel: 'debug', redact: false, encryptStorage: false });
  });
  it('staging uses the real API with debug logs and nothing hidden', () => {
    expect(buildConfig({ EXPO_PUBLIC_APP_ENV: 'staging', ...real })).toMatchObject({ useMocks: false, logLevel: 'debug', redact: false, encryptStorage: false });
  });
  it('prod uses the real API, info logs, redaction and encrypted storage', () => {
    expect(buildConfig({ EXPO_PUBLIC_APP_ENV: 'prod', ...real })).toMatchObject({ useMocks: false, logLevel: 'info', redact: true, encryptStorage: true });
  });
  it('real environments fail fast when settings are missing', () => {
    expect(() => buildConfig({ EXPO_PUBLIC_APP_ENV: 'staging' })).toThrow(/required/);
  });
  it('unknown values fall back to dev', () => {
    expect(buildConfig({ EXPO_PUBLIC_APP_ENV: 'nope' }).appEnv).toBe('dev');
  });
});

describe('logger', () => {
  const run = (opts: { level: 'debug' | 'info'; redact: boolean }) => {
    const lines: [string, string, unknown][] = [];
    const l = createLogger(opts, (lvl, line, data) => lines.push([lvl, line, data]));
    l.debug('d', { token: 'abc' });
    l.info('i', { email: 'a@b.co', headers: { Authorization: 'Bearer secret.jwt' }, ok: 1 });
    return lines;
  };
  it('info level drops debug lines', () => {
    expect(run({ level: 'info', redact: true }).map((l) => l[0])).toEqual(['info']);
  });
  it('debug level keeps everything and hides nothing', () => {
    const lines = run({ level: 'debug', redact: false });
    expect(lines).toHaveLength(2);
    expect(JSON.stringify(lines)).toContain('Bearer secret.jwt');
  });
  it('redaction masks sensitive keys and bearer tokens', () => {
    const out = JSON.stringify(run({ level: 'info', redact: true }));
    expect(out).not.toContain('a@b.co');
    expect(out).not.toContain('secret.jwt');
    expect(out).toContain('"ok":1');
  });
  it('redactValue masks bearer strings inside text', () => {
    expect(redactValue('got Bearer abc.def.ghi ok')).toBe('got Bearer [redacted] ok');
  });
});
