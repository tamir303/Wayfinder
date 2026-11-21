import { logLevelsFor, requestLogger } from './logging';

describe('logLevelsFor', () => {
  it('dev and staging include debug, prod does not', () => {
    expect(logLevelsFor('dev')).toContain('debug');
    expect(logLevelsFor('staging')).toContain('debug');
    expect(logLevelsFor('prod')).not.toContain('debug');
    expect(logLevelsFor('prod')).toEqual(expect.arrayContaining(['log', 'warn', 'error']));
  });
});

describe('requestLogger', () => {
  const run = (appEnv: 'dev' | 'staging' | 'prod', url: string, incomingId?: string) => {
    const lines: string[] = [];
    const headers: Record<string, string> = {};
    let onFinish: () => void = () => undefined;
    const req = { method: 'GET', originalUrl: url, headers: incomingId ? { 'x-request-id': incomingId } : {} };
    const res = {
      statusCode: 200,
      setHeader: (k: string, v: string) => (headers[k] = v),
      on: (_e: string, cb: () => void) => (onFinish = cb),
    };
    requestLogger(appEnv, (line) => lines.push(line))(req as never, res as never, () => undefined);
    onFinish();
    return { lines, headers };
  };

  it('sets a request id header and logs method, path, status and duration', () => {
    const { lines, headers } = run('dev', '/health');
    expect(headers['x-request-id']).toMatch(/^[0-9a-f-]{8,}$/);
    expect(lines[0]).toMatch(/GET \/health 200 \d+ms/);
    expect(lines[0]).toContain(headers['x-request-id']);
  });

  it('reuses a safe incoming request id', () => {
    expect(run('dev', '/x', 'abc-123').headers['x-request-id']).toBe('abc-123');
    expect(run('dev', '/x', 'bad id with spaces').headers['x-request-id']).not.toBe('bad id with spaces');
  });

  it('keeps the query string outside prod and drops it in prod', () => {
    expect(run('staging', '/geo/suggest?q=tel%20aviv').lines[0]).toContain('q=tel%20aviv');
    const prod = run('prod', '/geo/suggest?q=tel%20aviv').lines[0];
    expect(prod).toContain('/geo/suggest');
    expect(prod).not.toContain('tel');
  });
});
