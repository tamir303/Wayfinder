import { createHash } from 'node:crypto';

export type Params = Record<string, string | number | boolean | null | undefined>;

export const canonicalize = (params: Params): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : String(value);
  }
  return out;
};

export const cacheKey = (engine: string, canonical: Record<string, string>): string => {
  const digest = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  return `serp:${engine}:${digest}`;
};
