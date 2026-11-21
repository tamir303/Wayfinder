import { config, type LogLevel } from '../config/app-config';

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const SENSITIVE_KEY = /token|secret|password|authorization|api[-_]?key|email|code|cookie/i;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;

export const redactValue = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return value.replace(BEARER, 'Bearer [redacted]');
  if (value === null || typeof value !== 'object' || depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? '[redacted]' : redactValue(v, depth + 1)]),
  );
};

type Sink = (level: LogLevel, line: string, data?: unknown) => void;

const consoleSink: Sink = (level, line, data) => {
  const fn = level === 'debug' ? console.debug : level === 'info' ? console.info : level === 'warn' ? console.warn : console.error;
  if (data === undefined) fn(line);
  else fn(line, data);
};

export const createLogger = (opts: { level: LogLevel; redact: boolean }, sink: Sink = consoleSink) => {
  const emit = (level: LogLevel) => (message: string, data?: unknown) => {
    if (ORDER[level] < ORDER[opts.level]) return;
    sink(level, `[wayfinder] ${message}`, opts.redact ? redactValue(data) : data);
  };
  return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error') };
};

export const log = createLogger({ level: config.logLevel, redact: config.redact });
