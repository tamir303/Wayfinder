# Foundation and SerpAPI Provider Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Wayfinder monorepo and prove it end to end with one slice: a signed-in user types a city and gets airport suggestions through app, API, Redis cache and SerpAPI `google_flights_autocomplete`.

**Architecture:** pnpm + Turborepo monorepo. `packages/shared` holds Zod contracts used by both apps. `apps/api` is NestJS (Vercel serverless): a global Supabase-JWT guard, one cache-aware `SerpApiClient` (canonical params, Redis cache, Redis lock, retry, per-user daily credit cap, `SearchLog`), and a `geo` module. `apps/mobile` is Expo (Expo Router, NativeWind, TanStack Query) with Supabase email-code sign-in.

**Tech Stack:** pnpm 9, Turborepo 2, TypeScript 5, Zod 3, NestJS 10 + `nestjs-zod`, `jose` 5, `ioredis`, Prisma **6** (pin to major 6), Jest + ts-jest, Expo (current SDK) + Expo Router, NativeWind **4** (pin to major 4), TanStack Query 5, `@supabase/supabase-js` 2, `jest-expo`.

**Spec:** `docs/superpowers/specs/2026-11-21-foundation-design.md`

## Global Constraints

- Every API endpoint requires a valid Supabase JWT except `GET /health`.
- Error codes are exactly: `NO_RESULTS`, `RATE_LIMITED`, `PROVIDER_DOWN`, `BAD_QUERY`, `UNAUTHENTICATED`. Error body is always `{ code, message }`.
- The SerpAPI key and the SerpAPI MCP URL never reach the mobile app. Never log the key or the full MCP URL.
- Neither app imports from the other. Both import contracts from `@wayfinder/shared`. Raw SerpAPI types stay inside `apps/api`.
- Autocomplete cache TTL is 24 h (86400 s). Daily credit cap is `DAILY_CREDIT_CAP` (default 200) per user per UTC day. Cache hits cost 0 credits.
- Sign-in is Supabase email one-time code only. Session is stored in `expo-secure-store`.
- Dev client is a custom EAS build, not Expo Go. iOS and Android both supported.
- Prisma owns the `public` schema. Supabase owns `auth`. RLS is on for `profiles` and `search_logs`.
- Do not call SerpAPI in CI or in tests. Tests use the saved fixture.

## Prerequisites (human, before Task 1)

1. **Supabase project** (dev). In the dashboard: Authentication, JWT Signing Keys: use asymmetric keys (the API verifies with the JWKS endpoint). Authentication, Email Templates, "Magic Link" and "Confirm signup": make sure the body contains `{{ .Token }}` so users get a 6-digit code. Note the project URL, the publishable (anon) key, the pooled connection string and the direct connection string.
2. **Upstash Redis** database. Note the `rediss://` URL. Pick the region nearest the Supabase project.
3. **SerpAPI API key** from the SerpAPI dashboard. This is the REST key, not the MCP URL token.
4. **Node 20+** and **pnpm 9** installed (`corepack enable`).
5. **Rotate the SerpAPI MCP token** and stop tracking `.mcp.json` (it was committed in `514526a`): `git rm --cached .mcp.json && git commit -m "chore: stop tracking .mcp.json"`.

## File Structure

```
package.json, pnpm-workspace.yaml, turbo.json, .npmrc, .prettierrc, .env.example
.github/workflows/ci.yml
packages/config/        package.json, tsconfig.base.json, eslint.mjs
packages/shared/        package.json, tsconfig.json, jest.config.js,
                        src/{errors.ts, geo.ts, index.ts}, src/{errors,geo}.spec.ts
apps/api/
  package.json, tsconfig.json, tsconfig.build.json, nest-cli.json, jest.config.js, vercel.json
  api/index.ts                         Vercel entry
  prisma/schema.prisma, prisma/migrations/<ts>_init/migration.sql
  scripts/refresh-fixture.ts
  src/main.ts, src/app.module.ts
  src/common/{app-error.ts, tokens.ts, app-exception.filter.ts}
  src/config/{env.ts, config.module.ts}
  src/prisma/{prisma.service.ts, prisma.module.ts}
  src/redis/redis.module.ts
  src/auth/{jwt-verifier.ts, auth.guard.ts, public.decorator.ts, current-user.decorator.ts, auth.module.ts}
  src/health/health.controller.ts
  src/provider/{canonicalize.ts, credit-ledger.ts, search-log.service.ts, serpapi.client.ts, provider.module.ts}
  src/geo/{autocomplete.mapper.ts, geo.service.ts, geo.controller.ts, geo.module.ts, geo.dto.ts}
  test/{fake-redis.ts, test-env.ts, geo.e2e.spec.ts, fixtures/google_flights_autocomplete/tel-aviv.json}
apps/mobile/
  package.json, app.json, babel.config.js, metro.config.js, tailwind.config.js, global.css, eas.json, jest.config.js
  app/{_layout.tsx, (auth)/sign-in.tsx, (app)/_layout.tsx, (app)/index.tsx}
  src/lib/{supabase.ts, secure-store-adapter.ts, api.ts, session.tsx}
  src/components/{Input.tsx, SuggestionRow.tsx}
  src/features/geo/{useDebouncedValue.ts, useGeoSuggest.ts, suggest-ui-state.ts, SuggestionList.tsx}
```

The fixture file `apps/api/test/fixtures/google_flights_autocomplete/tel-aviv.json` already exists (captured from one live call on 2026-11-21, archive URLs removed).

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.prettierrc`, `.env.example`
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/eslint.mjs`

**Interfaces:**
- Produces: workspace root with scripts `dev`, `build`, `lint`, `typecheck`, `test`. Package `@wayfinder/config` exporting `./tsconfig.base.json` and `./eslint`.

- [ ] **Step 1: Create root files**

`package.json`:
```json
{
  "name": "wayfinder",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test"
  },
  "devDependencies": {
    "@eslint/js": "^9.15.0",
    "eslint": "^9.15.0",
    "prettier": "^3.3.0",
    "turbo": "^2.3.0",
    "typescript": "^5.6.0",
    "typescript-eslint": "^8.15.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`.npmrc` (Expo needs hoisted node_modules under pnpm):
```
node-linker=hoisted
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true }
  }
}
```

`.prettierrc`:
```json
{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

`.env.example`:
```
# apps/api
SERPAPI_KEY=
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
DATABASE_URL=postgresql://...pooler...:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...:5432/postgres
REDIS_URL=rediss://default:...@...upstash.io:6379
DAILY_CREDIT_CAP=200

# apps/mobile
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 2: Create `packages/config`**

`packages/config/package.json`:
```json
{
  "name": "@wayfinder/config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./eslint": "./eslint.mjs"
  }
}
```

`packages/config/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

`packages/config/eslint.mjs`:
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.expo/**', '.vercel/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

- [ ] **Step 3: Install and verify**

Run: `pnpm install`
Expected: completes, creates `pnpm-lock.yaml`.

Run: `pnpm exec turbo run lint --dry`
Expected: prints a task graph with no errors (no packages define `lint` yet).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json .npmrc .prettierrc .env.example packages/config
git commit -m "chore: scaffold pnpm + turbo monorepo with shared config"
```

---

### Task 2: `packages/shared` contracts

**Files:**
- Create: `packages/shared/{package.json,tsconfig.json,jest.config.js}`
- Create: `packages/shared/src/{errors.ts,geo.ts,index.ts}`
- Test: `packages/shared/src/errors.spec.ts`, `packages/shared/src/geo.spec.ts`

**Interfaces:**
- Produces (exports of `@wayfinder/shared`):
  - `ERROR_CODES` (readonly tuple), `ErrorCodeSchema`, `type ErrorCode`, `ApiErrorSchema`, `type ApiError = { code: ErrorCode; message: string }`, `HTTP_STATUS_BY_CODE: Record<ErrorCode, number>`
  - `GeoSuggestQuerySchema` (`{ q: string (trimmed, 2..80), kind: 'airport' (default 'airport') }`), `type GeoSuggestQuery`
  - `GeoSuggestionSchema` (`{ code: /^[A-Z]{3}$/, name: string, city: string }`), `type GeoSuggestion`
  - `GeoSuggestResponseSchema` (`{ suggestions: GeoSuggestion[] }`), `type GeoSuggestResponse`

- [ ] **Step 1: Package files**

`packages/shared/package.json`:
```json
{
  "name": "@wayfinder/shared",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src",
    "test": "jest"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@wayfinder/config": "workspace:*",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "@wayfinder/config/tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "declaration": true },
  "include": ["src"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`packages/shared/jest.config.js`:
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS', esModuleInterop: true, strict: true } }] },
};
```

`packages/shared/eslint.config.mjs`:
```js
export { default } from '@wayfinder/config/eslint';
```

- [ ] **Step 2: Write the failing tests**

`packages/shared/src/errors.spec.ts`:
```ts
import { ApiErrorSchema, ERROR_CODES, HTTP_STATUS_BY_CODE } from './errors';

describe('errors', () => {
  it('lists exactly the five agreed codes', () => {
    expect([...ERROR_CODES]).toEqual([
      'NO_RESULTS',
      'RATE_LIMITED',
      'PROVIDER_DOWN',
      'BAD_QUERY',
      'UNAUTHENTICATED',
    ]);
  });

  it('maps every code to an HTTP status', () => {
    expect(HTTP_STATUS_BY_CODE).toEqual({
      NO_RESULTS: 404,
      RATE_LIMITED: 429,
      PROVIDER_DOWN: 502,
      BAD_QUERY: 400,
      UNAUTHENTICATED: 401,
    });
  });

  it('accepts a valid error body and rejects an unknown code', () => {
    expect(ApiErrorSchema.safeParse({ code: 'BAD_QUERY', message: 'x' }).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ code: 'NOPE', message: 'x' }).success).toBe(false);
  });
});
```

`packages/shared/src/geo.spec.ts`:
```ts
import { GeoSuggestQuerySchema, GeoSuggestResponseSchema } from './geo';

describe('GeoSuggestQuerySchema', () => {
  it('trims q and defaults kind to airport', () => {
    expect(GeoSuggestQuerySchema.parse({ q: '  tel aviv ' })).toEqual({
      q: 'tel aviv',
      kind: 'airport',
    });
  });

  it('rejects q shorter than 2 characters', () => {
    expect(GeoSuggestQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
  });

  it('rejects q longer than 80 characters', () => {
    expect(GeoSuggestQuerySchema.safeParse({ q: 'a'.repeat(81) }).success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(GeoSuggestQuerySchema.safeParse({ q: 'paris', kind: 'hotel' }).success).toBe(false);
  });
});

describe('GeoSuggestResponseSchema', () => {
  it('accepts a valid suggestion', () => {
    const body = { suggestions: [{ code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv-Yafo' }] };
    expect(GeoSuggestResponseSchema.parse(body)).toEqual(body);
  });

  it('rejects a non-IATA code', () => {
    const body = { suggestions: [{ code: 'tlv1', name: 'x', city: 'y' }] };
    expect(GeoSuggestResponseSchema.safeParse(body).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm install && pnpm --filter @wayfinder/shared test`
Expected: FAIL, `Cannot find module './errors'` and `'./geo'`.

- [ ] **Step 4: Implement**

`packages/shared/src/errors.ts`:
```ts
import { z } from 'zod';

export const ERROR_CODES = [
  'NO_RESULTS',
  'RATE_LIMITED',
  'PROVIDER_DOWN',
  'BAD_QUERY',
  'UNAUTHENTICATED',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({ code: ErrorCodeSchema, message: z.string() });
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  NO_RESULTS: 404,
  RATE_LIMITED: 429,
  PROVIDER_DOWN: 502,
  BAD_QUERY: 400,
  UNAUTHENTICATED: 401,
};
```

`packages/shared/src/geo.ts`:
```ts
import { z } from 'zod';

export const GeoSuggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  kind: z.literal('airport').default('airport'),
});
export type GeoSuggestQuery = z.infer<typeof GeoSuggestQuerySchema>;

export const GeoSuggestionSchema = z.object({
  code: z.string().regex(/^[A-Z]{3}$/),
  name: z.string().min(1),
  city: z.string().min(1),
});
export type GeoSuggestion = z.infer<typeof GeoSuggestionSchema>;

export const GeoSuggestResponseSchema = z.object({
  suggestions: z.array(GeoSuggestionSchema),
});
export type GeoSuggestResponse = z.infer<typeof GeoSuggestResponseSchema>;
```

`packages/shared/src/index.ts`:
```ts
export * from './errors';
export * from './geo';
```

- [ ] **Step 5: Run tests, build, lint**

Run: `pnpm --filter @wayfinder/shared test && pnpm --filter @wayfinder/shared build && pnpm --filter @wayfinder/shared lint`
Expected: all PASS, `packages/shared/dist/index.js` exists.

- [ ] **Step 6: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): add error codes and geo suggest contracts"
```

---

### Task 3: API skeleton (config, errors, health)

**Files:**
- Create: `apps/api/{package.json,tsconfig.json,tsconfig.build.json,nest-cli.json,jest.config.js,eslint.config.mjs}`
- Create: `apps/api/src/common/{app-error.ts,tokens.ts,app-exception.filter.ts}`
- Create: `apps/api/src/config/{env.ts,config.module.ts}`
- Create: `apps/api/src/{main.ts,app.module.ts}`, `apps/api/src/health/health.controller.ts`, `apps/api/src/auth/public.decorator.ts`
- Test: `apps/api/src/config/env.spec.ts`, `apps/api/src/common/app-exception.filter.spec.ts`

**Interfaces:**
- Produces:
  - `class AppError extends Error { constructor(readonly code: ErrorCode, message: string) }`
  - `const ENV = Symbol('ENV')`, `const REDIS = Symbol('REDIS')` (injection tokens, `common/tokens.ts`)
  - `type Env = { SERPAPI_KEY: string; SUPABASE_URL: string; DATABASE_URL: string; REDIS_URL: string; DAILY_CREDIT_CAP: number; NODE_ENV: 'development'|'test'|'production' }`, `parseEnv(raw: Record<string, unknown>): Env`
  - `@Public()` decorator, `IS_PUBLIC` metadata key
  - `AppExceptionFilter` (`@Catch()`), maps `AppError` and `HttpException` to `{ code, message }`

- [ ] **Step 1: Package and config files**

`apps/api/package.json`:
```json
{
  "name": "@wayfinder/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "nest start --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src test api scripts",
    "test": "jest",
    "fixture:refresh": "tsx --env-file=.env scripts/refresh-fixture.ts",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@prisma/client": "^6.0.0",
    "@wayfinder/shared": "workspace:*",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "ioredis": "^5.4.1",
    "jose": "^5.9.6",
    "nestjs-zod": "^3.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/testing": "^10.4.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.14",
    "@types/node": "^20.17.0",
    "@types/supertest": "^6.0.2",
    "@wayfinder/config": "workspace:*",
    "jest": "^29.7.0",
    "prisma": "^6.0.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.0"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "@wayfinder/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false,
    "types": ["node", "jest"]
  },
  "include": ["src", "test", "api", "scripts"]
}
```

`apps/api/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "include": ["src", "api"],
  "exclude": ["**/*.spec.ts", "test"]
}
```

`apps/api/nest-cli.json`:
```json
{
  "sourceRoot": "src",
  "compilerOptions": { "tsConfigPath": "tsconfig.build.json" }
}
```

`apps/api/jest.config.js`:
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};
```

`apps/api/eslint.config.mjs`:
```js
export { default } from '@wayfinder/config/eslint';
```

- [ ] **Step 2: Write failing tests**

`apps/api/src/config/env.spec.ts`:
```ts
import { parseEnv } from './env';

const valid = {
  SERPAPI_KEY: 'k',
  SUPABASE_URL: 'https://proj.supabase.co',
  DATABASE_URL: 'postgresql://x',
  REDIS_URL: 'redis://x',
};

describe('parseEnv', () => {
  it('parses a valid env and applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.DAILY_CREDIT_CAP).toBe(200);
    expect(env.NODE_ENV).toBe('development');
  });

  it('coerces DAILY_CREDIT_CAP from a string', () => {
    expect(parseEnv({ ...valid, DAILY_CREDIT_CAP: '5' }).DAILY_CREDIT_CAP).toBe(5);
  });

  it.each(['SERPAPI_KEY', 'SUPABASE_URL', 'DATABASE_URL', 'REDIS_URL'])(
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
```

`apps/api/src/common/app-exception.filter.spec.ts`:
```ts
import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { AppError } from './app-error';
import { AppExceptionFilter } from './app-exception.filter';

const run = (exception: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new AppExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
};

describe('AppExceptionFilter', () => {
  it('maps AppError to its status and { code, message }', () => {
    expect(run(new AppError('RATE_LIMITED', 'slow down'))).toEqual({
      status: 429,
      body: { code: 'RATE_LIMITED', message: 'slow down' },
    });
  });

  it('maps a 400 HttpException (e.g. zod validation) to BAD_QUERY', () => {
    expect(run(new BadRequestException('bad')).body.code).toBe('BAD_QUERY');
    expect(run(new BadRequestException('bad')).status).toBe(400);
  });

  it('maps a 404 HttpException to BAD_QUERY with status 404', () => {
    expect(run(new NotFoundException()).status).toBe(404);
  });

  it('maps an unknown error to 500 PROVIDER_DOWN with a generic message', () => {
    expect(run(new Error('secret db password'))).toEqual({
      status: 500,
      body: { code: 'PROVIDER_DOWN', message: 'Unexpected error' },
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm install && pnpm --filter @wayfinder/api test -- env.spec app-exception`
Expected: FAIL, modules not found. (`postinstall` runs `prisma generate`; if it errors because `prisma/schema.prisma` does not exist yet, continue. Task 4 adds it. If pnpm aborts on the failing postinstall, temporarily run `pnpm install --ignore-scripts`.)

- [ ] **Step 4: Implement**

`apps/api/src/common/app-error.ts`:
```ts
import type { ErrorCode } from '@wayfinder/shared';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

`apps/api/src/common/tokens.ts`:
```ts
export const ENV = Symbol('ENV');
export const REDIS = Symbol('REDIS');
```

`apps/api/src/config/env.ts`:
```ts
import { z } from 'zod';

const EnvSchema = z.object({
  SERPAPI_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
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
```

`apps/api/src/config/config.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { ENV } from '../common/tokens';
import { parseEnv } from './env';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => parseEnv(process.env) }],
  exports: [ENV],
})
export class ConfigModule {}
```

`apps/api/src/common/app-exception.filter.ts`:
```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { HTTP_STATUS_BY_CODE, type ApiError } from '@wayfinder/shared';
import type { Response } from 'express';
import { AppError } from './app-error';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.translate(exception);
    response.status(status).json(body);
  }

  private translate(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof AppError) {
      return {
        status: HTTP_STATUS_BY_CODE[exception.code],
        body: { code: exception.code, message: exception.message },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = status === 401 ? 'UNAUTHENTICATED' : status < 500 ? 'BAD_QUERY' : 'PROVIDER_DOWN';
      return { status, body: { code, message: status < 500 ? 'Invalid request' : 'Unexpected error' } };
    }
    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return { status: 500, body: { code: 'PROVIDER_DOWN', message: 'Unexpected error' } };
  }
}
```

`apps/api/src/auth/public.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
```

`apps/api/src/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { ok: true };
  }
}
```

`apps/api/src/app.module.ts` (grows in later tasks):
```ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppExceptionFilter } from './common/app-exception.filter';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule {}
```

`apps/api/src/main.ts`:
```ts
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @wayfinder/api test && pnpm --filter @wayfinder/api typecheck`
Expected: PASS. (If `typecheck` complains about `prisma`, there is nothing imported from it yet, so it should not.)

- [ ] **Step 6: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add config validation, error filter and health endpoint"
```

---

### Task 4: Prisma schema, migration and RLS

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_init/migration.sql` (generated, then appended)
- Create: `apps/api/src/prisma/{prisma.service.ts,prisma.module.ts}`

**Interfaces:**
- Produces: `PrismaService extends PrismaClient` (global module `PrismaModule`). Models `Profile` (`profiles`) and `SearchLog` (`search_logs`) with `prisma.searchLog.create({ data: { userId, engine, cacheHit, credits } })`.

- [ ] **Step 1: Write the schema**

`apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Profile {
  id         String      @id @db.Uuid
  createdAt  DateTime    @default(now()) @map("created_at")
  searchLogs SearchLog[]

  @@map("profiles")
}

model SearchLog {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  engine    String
  cacheHit  Boolean  @map("cache_hit")
  credits   Int
  createdAt DateTime @default(now()) @map("created_at")
  profile   Profile  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("search_logs")
}
```

- [ ] **Step 2: Create `apps/api/.env` (not committed) from `.env.example`** with real dev values for `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `SUPABASE_URL`, `SERPAPI_KEY`, `REDIS_URL`.

- [ ] **Step 3: Generate the migration without applying it**

Run: `pnpm --filter @wayfinder/api exec prisma migrate dev --create-only --name init`
Expected: creates `prisma/migrations/<timestamp>_init/migration.sql` with `CREATE TABLE "profiles"` and `"search_logs"`.

- [ ] **Step 4: Append auth link, trigger and RLS to that `migration.sql`**

```sql
-- Link profiles to Supabase auth users
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fkey"
  FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- Create a profile row whenever a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON "profiles"
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- search_logs: RLS on with no policies. Only the API's database role
-- (which bypasses RLS) can read or write it.
ALTER TABLE "search_logs" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 5: Apply and verify**

Run: `pnpm --filter @wayfinder/api exec prisma migrate dev`
Expected: migration applied. Then in the Supabase SQL editor run:
```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('profiles','search_logs');
```
Expected: both rows have `rowsecurity = true`. Create one test user in Supabase Auth, then `select id from profiles;` returns that user's id (trigger works).

- [ ] **Step 6: Prisma service and module**

`apps/api/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter @wayfinder/api typecheck`
Expected: PASS.

```bash
git add apps/api/prisma apps/api/src/prisma
git commit -m "feat(api): add prisma schema, auth trigger and RLS migration"
```

---

### Task 5: Provider layer (`SerpApiClient`)

**Files:**
- Create: `apps/api/src/redis/redis.module.ts`
- Create: `apps/api/src/provider/{canonicalize.ts,credit-ledger.ts,search-log.service.ts,serpapi.client.ts,provider.module.ts}`
- Create: `apps/api/test/{fake-redis.ts,test-env.ts}`
- Test: `apps/api/src/provider/canonicalize.spec.ts`, `credit-ledger.spec.ts`, `serpapi.client.spec.ts`

**Interfaces:**
- Consumes: `ENV`, `REDIS` tokens, `AppError`, `Env`, `PrismaService`.
- Produces:
  - `type Params = Record<string, string | number | boolean | null | undefined>`
  - `canonicalize(params: Params): Record<string, string>`, `cacheKey(engine: string, canonical: Record<string, string>): string`
  - `CreditLedger.assertAvailable(userId: string): Promise<void>` (throws `AppError('RATE_LIMITED', ...)`), `CreditLedger.consume(userId: string): Promise<void>`
  - `SearchLogService.record(entry: { userId: string; engine: string; cacheHit: boolean; credits: number }): Promise<void>` (never throws)
  - `SerpApiClient.call<T>(opts: { engine: string; params: Params; ttlSeconds: number; userId: string; map: (raw: unknown) => T }): Promise<T>`
  - `ProviderModule` exporting `SerpApiClient`
  - test helpers `FakeRedis` (`get`, `set(key, value, ...args)` honoring `NX`, `del`, `incr`, `expire`) and `testEnv: Env`

- [ ] **Step 1: Test helpers**

`apps/api/test/fake-redis.ts`:
```ts
export class FakeRedis {
  readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, ...args: (string | number)[]): Promise<'OK' | null> {
    if (args.includes('NX') && this.store.has(key)) return null;
    this.store.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const next = Number(this.store.get(key) ?? 0) + 1;
    this.store.set(key, String(next));
    return next;
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1;
  }
}
```

`apps/api/test/test-env.ts`:
```ts
import type { Env } from '../src/config/env';

export const testEnv: Env = {
  SERPAPI_KEY: 'test-key',
  SUPABASE_URL: 'https://proj.supabase.co',
  DATABASE_URL: 'postgresql://test',
  REDIS_URL: 'redis://test',
  DAILY_CREDIT_CAP: 200,
  NODE_ENV: 'test',
};
```

- [ ] **Step 2: Write failing tests**

`apps/api/src/provider/canonicalize.spec.ts`:
```ts
import { cacheKey, canonicalize } from './canonicalize';

describe('canonicalize', () => {
  it('sorts keys, trims, collapses spaces, stringifies and drops empty values', () => {
    expect(canonicalize({ q: '  tel   aviv ', hl: 'en', n: 2, skip: undefined, nil: null, ok: true })).toEqual({
      hl: 'en',
      n: '2',
      ok: 'true',
      q: 'tel aviv',
    });
    expect(Object.keys(canonicalize({ z: 'a', a: 'b' }))).toEqual(['a', 'z']);
  });
});

describe('cacheKey', () => {
  it('is identical for equivalent queries regardless of key order or spacing', () => {
    const a = cacheKey('e', canonicalize({ q: 'tel  aviv', hl: 'en' }));
    const b = cacheKey('e', canonicalize({ hl: 'en', q: ' tel aviv ' }));
    expect(a).toBe(b);
  });

  it('differs by engine and by params', () => {
    expect(cacheKey('a', { q: 'x' })).not.toBe(cacheKey('b', { q: 'x' }));
    expect(cacheKey('a', { q: 'x' })).not.toBe(cacheKey('a', { q: 'y' }));
  });

  it('starts with the serp:<engine>: prefix', () => {
    expect(cacheKey('google_flights', { q: 'x' })).toMatch(/^serp:google_flights:[a-f0-9]{64}$/);
  });
});
```

`apps/api/src/provider/credit-ledger.spec.ts`:
```ts
import type Redis from 'ioredis';
import { AppError } from '../common/app-error';
import { FakeRedis } from '../../test/fake-redis';
import { testEnv } from '../../test/test-env';
import { CreditLedger } from './credit-ledger';

const makeLedger = (cap: number) =>
  new CreditLedger({ ...testEnv, DAILY_CREDIT_CAP: cap }, new FakeRedis() as unknown as Redis);

describe('CreditLedger', () => {
  it('allows usage below the cap', async () => {
    const ledger = makeLedger(2);
    await ledger.consume('u1');
    await expect(ledger.assertAvailable('u1')).resolves.toBeUndefined();
  });

  it('throws RATE_LIMITED once the cap is reached', async () => {
    const ledger = makeLedger(2);
    await ledger.consume('u1');
    await ledger.consume('u1');
    await expect(ledger.assertAvailable('u1')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    await expect(ledger.assertAvailable('u1')).rejects.toBeInstanceOf(AppError);
  });

  it('counts each user separately', async () => {
    const ledger = makeLedger(1);
    await ledger.consume('u1');
    await expect(ledger.assertAvailable('u2')).resolves.toBeUndefined();
  });
});
```

`apps/api/src/provider/serpapi.client.spec.ts`:
```ts
import type Redis from 'ioredis';
import { FakeRedis } from '../../test/fake-redis';
import { testEnv } from '../../test/test-env';
import { CreditLedger } from './credit-ledger';
import { cacheKey, canonicalize } from './canonicalize';
import { SerpApiClient } from './serpapi.client';
import type { SearchLogService } from './search-log.service';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => new Response('{}', { status: code });

const setup = (cap = 200) => {
  const redis = new FakeRedis();
  const env = { ...testEnv, DAILY_CREDIT_CAP: cap };
  const ledger = new CreditLedger(env, redis as unknown as Redis);
  const searchLog = { record: jest.fn().mockResolvedValue(undefined) };
  const client = new SerpApiClient(
    env,
    redis as unknown as Redis,
    ledger,
    searchLog as unknown as SearchLogService,
  );
  return { redis, client, searchLog };
};

const call = (client: SerpApiClient, q = 'tel aviv', map = (raw: unknown) => raw) =>
  client.call({
    engine: 'google_flights_autocomplete',
    params: { q, hl: 'en' },
    ttlSeconds: 60,
    userId: 'u1',
    map,
  });

describe('SerpApiClient', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('fetches, maps, caches, and logs a miss with 1 credit', async () => {
    const { client, searchLog, redis } = setup();
    fetchSpy.mockResolvedValue(ok({ hello: 'world' }));

    const result = await call(client);

    expect(result).toEqual({ hello: 'world' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://serpapi.com/search.json');
    expect(url.searchParams.get('engine')).toBe('google_flights_autocomplete');
    expect(url.searchParams.get('api_key')).toBe('test-key');
    expect(url.searchParams.get('q')).toBe('tel aviv');
    expect(searchLog.record).toHaveBeenCalledWith({
      userId: 'u1',
      engine: 'google_flights_autocomplete',
      cacheHit: false,
      credits: 1,
    });
    const key = cacheKey('google_flights_autocomplete', canonicalize({ q: 'tel aviv', hl: 'en' }));
    expect(await redis.get(key)).toBe(JSON.stringify({ hello: 'world' }));
  });

  it('serves an equivalent query from cache with 0 credits and no fetch', async () => {
    const { client, searchLog } = setup();
    fetchSpy.mockResolvedValue(ok({ n: 1 }));
    await call(client, 'tel aviv');
    fetchSpy.mockClear();

    const second = await call(client, '  Tel   Aviv'.toLowerCase());

    expect(second).toEqual({ n: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(searchLog.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ cacheHit: true, credits: 0 }),
    );
  });

  it('retries once on a 5xx and then succeeds', async () => {
    const { client } = setup();
    fetchSpy.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok({ n: 2 }));
    await expect(call(client)).resolves.toEqual({ n: 2 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws PROVIDER_DOWN after two 5xx responses', async () => {
    const { client } = setup();
    fetchSpy.mockResolvedValue(status(500));
    await expect(call(client)).rejects.toMatchObject({ code: 'PROVIDER_DOWN' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 4xx: 400 maps to BAD_QUERY, 401/429 map to PROVIDER_DOWN', async () => {
    const a = setup();
    fetchSpy.mockResolvedValue(status(400));
    await expect(call(a.client)).rejects.toMatchObject({ code: 'BAD_QUERY' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockClear();
    const b = setup();
    fetchSpy.mockResolvedValue(status(401));
    await expect(call(b.client)).rejects.toMatchObject({ code: 'PROVIDER_DOWN' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries once on a network error then throws PROVIDER_DOWN', async () => {
    const { client } = setup();
    fetchSpy.mockRejectedValue(new Error('boom'));
    await expect(call(client)).rejects.toMatchObject({ code: 'PROVIDER_DOWN' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws RATE_LIMITED without fetching once the daily cap is used', async () => {
    const { client } = setup(1);
    fetchSpy.mockResolvedValue(ok({ n: 1 }));
    await call(client, 'paris');
    fetchSpy.mockClear();
    await expect(call(client, 'london')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not cache or charge when the mapper throws', async () => {
    const { client, redis, searchLog } = setup();
    fetchSpy.mockResolvedValue(ok({ bad: true }));
    const map = () => {
      throw new Error('mapper failed');
    };
    await expect(call(client, 'tel aviv', map)).rejects.toThrow('mapper failed');
    expect(redis.store.size).toBe(0);
    expect(searchLog.record).not.toHaveBeenCalled();
  });

  it('waits for a concurrent holder of the lock and reuses its cached result', async () => {
    const { client, redis, searchLog } = setup();
    const key = cacheKey('google_flights_autocomplete', canonicalize({ q: 'tel aviv', hl: 'en' }));
    await redis.set(`${key}:lock`, '1');
    setTimeout(() => void redis.set(key, JSON.stringify({ from: 'other' })), 120);

    const result = await call(client);

    expect(result).toEqual({ from: 'other' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(searchLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ cacheHit: true, credits: 0 }),
    );
  });

  it('releases its own lock after a successful call', async () => {
    const { client, redis } = setup();
    fetchSpy.mockResolvedValue(ok({ n: 1 }));
    await call(client);
    const lockKeys = [...redis.store.keys()].filter((k) => k.endsWith(':lock'));
    expect(lockKeys).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @wayfinder/api test -- provider`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement**

`apps/api/src/provider/canonicalize.ts`:
```ts
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
```

`apps/api/src/redis/redis.module.ts`:
```ts
import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, REDIS } from '../common/tokens';
import type { Env } from '../config/env';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) => new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit();
  }
}
```

`apps/api/src/provider/credit-ledger.ts`:
```ts
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { AppError } from '../common/app-error';
import { ENV, REDIS } from '../common/tokens';
import type { Env } from '../config/env';

const TWO_DAYS_SECONDS = 172_800;

@Injectable()
export class CreditLedger {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private key(userId: string): string {
    return `credits:${userId}:${new Date().toISOString().slice(0, 10)}`;
  }

  async assertAvailable(userId: string): Promise<void> {
    const used = Number((await this.redis.get(this.key(userId))) ?? 0);
    if (used >= this.env.DAILY_CREDIT_CAP) {
      throw new AppError('RATE_LIMITED', 'Daily search limit reached');
    }
  }

  async consume(userId: string): Promise<void> {
    const key = this.key(userId);
    const used = await this.redis.incr(key);
    if (used === 1) await this.redis.expire(key, TWO_DAYS_SECONDS);
  }
}
```

`apps/api/src/provider/search-log.service.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SearchLogEntry = {
  userId: string;
  engine: string;
  cacheHit: boolean;
  credits: number;
};

@Injectable()
export class SearchLogService {
  private readonly logger = new Logger(SearchLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: SearchLogEntry): Promise<void> {
    try {
      await this.prisma.searchLog.create({ data: entry });
    } catch (error) {
      this.logger.warn(`search log write failed: ${(error as Error).message}`);
    }
  }
}
```

`apps/api/src/provider/serpapi.client.ts`:
```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { AppError } from '../common/app-error';
import { ENV, REDIS } from '../common/tokens';
import type { Env } from '../config/env';
import { cacheKey, canonicalize, type Params } from './canonicalize';
import { CreditLedger } from './credit-ledger';
import { SearchLogService } from './search-log.service';

const SERPAPI_URL = 'https://serpapi.com/search.json';
const REQUEST_TIMEOUT_MS = 15_000;
const LOCK_TTL_MS = 20_000;
const LOCK_WAIT_MS = 8_000;
const LOCK_POLL_MS = 50;

export type CallOptions<T> = {
  engine: string;
  params: Params;
  ttlSeconds: number;
  userId: string;
  map: (raw: unknown) => T;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class SerpApiClient {
  private readonly logger = new Logger(SerpApiClient.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly ledger: CreditLedger,
    private readonly searchLog: SearchLogService,
  ) {}

  async call<T>(opts: CallOptions<T>): Promise<T> {
    const canonical = canonicalize(opts.params);
    const key = cacheKey(opts.engine, canonical);

    const cached = await this.readCache<T>(key);
    if (cached !== undefined) return this.hit(opts, cached);

    const lockKey = `${key}:lock`;
    const gotLock = (await this.redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX')) === 'OK';
    if (!gotLock) {
      const waited = await this.waitForCache<T>(key);
      if (waited !== undefined) return this.hit(opts, waited);
      // The lock holder failed or timed out. Fall through and fetch ourselves.
    }

    try {
      await this.ledger.assertAvailable(opts.userId);
      const raw = await this.fetchWithRetry(opts.engine, canonical);
      const mapped = this.mapOrLog(opts, raw);
      await this.redis.set(key, JSON.stringify(mapped), 'EX', opts.ttlSeconds);
      await this.ledger.consume(opts.userId);
      await this.searchLog.record({
        userId: opts.userId,
        engine: opts.engine,
        cacheHit: false,
        credits: 1,
      });
      return mapped;
    } finally {
      if (gotLock) await this.redis.del(lockKey);
    }
  }

  private async hit<T>(opts: CallOptions<T>, value: T): Promise<T> {
    await this.searchLog.record({
      userId: opts.userId,
      engine: opts.engine,
      cacheHit: true,
      credits: 0,
    });
    return value;
  }

  private async readCache<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  }

  private async waitForCache<T>(key: string): Promise<T | undefined> {
    const deadline = Date.now() + LOCK_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(LOCK_POLL_MS);
      const value = await this.readCache<T>(key);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  private mapOrLog<T>(opts: CallOptions<T>, raw: unknown): T {
    try {
      return opts.map(raw);
    } catch (error) {
      // Log a bounded snippet of the payload to debug shape changes. The API key is never in the body.
      this.logger.error(
        `mapper failed for ${opts.engine}: ${JSON.stringify(raw).slice(0, 1000)}`,
      );
      throw error;
    }
  }

  private async fetchWithRetry(engine: string, canonical: Record<string, string>): Promise<unknown> {
    const url = new URL(SERPAPI_URL);
    url.search = new URLSearchParams({ ...canonical, engine, api_key: this.env.SERPAPI_KEY }).toString();

    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      } catch {
        if (attempt === 0) continue;
        throw new AppError('PROVIDER_DOWN', 'Provider request failed');
      }
      if (response.status >= 500) {
        if (attempt === 0) continue;
        throw new AppError('PROVIDER_DOWN', 'Provider request failed');
      }
      if (response.status === 400) throw new AppError('BAD_QUERY', 'Provider rejected the query');
      if (response.status >= 400) throw new AppError('PROVIDER_DOWN', 'Provider request failed');
      return response.json();
    }
    throw new AppError('PROVIDER_DOWN', 'Provider request failed');
  }
}
```

`apps/api/src/provider/provider.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { CreditLedger } from './credit-ledger';
import { SearchLogService } from './search-log.service';
import { SerpApiClient } from './serpapi.client';

@Module({
  providers: [CreditLedger, SearchLogService, SerpApiClient],
  exports: [SerpApiClient],
})
export class ProviderModule {}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @wayfinder/api test -- provider`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/provider apps/api/src/redis apps/api/test/fake-redis.ts apps/api/test/test-env.ts
git commit -m "feat(api): add cache-aware SerpApiClient with credit cap and search log"
```

---

### Task 6: Autocomplete mapper and fixture script

**Files:**
- Create: `apps/api/src/geo/autocomplete.mapper.ts`, `apps/api/scripts/refresh-fixture.ts`
- Test: `apps/api/src/geo/autocomplete.mapper.spec.ts`
- Existing: `apps/api/test/fixtures/google_flights_autocomplete/tel-aviv.json`

**Interfaces:**
- Consumes: `AppError`, `GeoSuggestResponseSchema`, `GeoSuggestion`, `GeoSuggestResponse` from `@wayfinder/shared`.
- Produces: `mapAutocomplete(raw: unknown): GeoSuggestResponse`.

Real response shape (captured live): `{ suggestions: [{ position, name, type: 'city' | 'region' | ..., description?, id, airports?: [{ name, id (IATA), city, city_id, distance }] }] }`. Cities carry `airports[]`; regions have none and are skipped. A top-level suggestion of `type: 'airport'` has not been observed yet, so the mapper handles it defensively (IATA `id`, `city` falls back to `name`). Revisit when a live airport-type response is seen.

- [ ] **Step 1: Write the failing test**

`apps/api/src/geo/autocomplete.mapper.spec.ts`:
```ts
import fixture from '../../test/fixtures/google_flights_autocomplete/tel-aviv.json';
import { mapAutocomplete } from './autocomplete.mapper';

describe('mapAutocomplete', () => {
  it('maps the real tel-aviv fixture to the airport list', () => {
    expect(mapAutocomplete(fixture)).toEqual({
      suggestions: [{ code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv-Yafo' }],
    });
  });

  it('skips regions and non-IATA ids', () => {
    const raw = {
      suggestions: [
        { type: 'region', name: 'Some District', id: '/m/1' },
        { type: 'city', name: 'X', id: '/m/2', airports: [{ id: 'toolong', name: 'Bad', city: 'X' }] },
      ],
    };
    expect(mapAutocomplete(raw)).toEqual({ suggestions: [] });
  });

  it('flattens multiple airports and de-duplicates by code', () => {
    const raw = {
      suggestions: [
        {
          type: 'city',
          name: 'London, United Kingdom',
          id: '/m/1',
          airports: [
            { id: 'LHR', name: 'Heathrow Airport', city: 'London' },
            { id: 'LGW', name: 'Gatwick Airport', city: 'London' },
          ],
        },
        {
          type: 'city',
          name: 'London Area',
          id: '/m/2',
          airports: [{ id: 'LHR', name: 'Heathrow Airport', city: 'London' }],
        },
      ],
    };
    expect(mapAutocomplete(raw).suggestions.map((s) => s.code)).toEqual(['LHR', 'LGW']);
  });

  it('falls back to the suggestion name when an airport has no city', () => {
    const raw = {
      suggestions: [
        { type: 'city', name: 'Paris, France', id: '/m/1', airports: [{ id: 'CDG', name: 'Charles de Gaulle' }] },
      ],
    };
    expect(mapAutocomplete(raw).suggestions[0]).toEqual({
      code: 'CDG',
      name: 'Charles de Gaulle',
      city: 'Paris, France',
    });
  });

  it('handles a top-level airport suggestion with an IATA id (unverified shape)', () => {
    const raw = { suggestions: [{ type: 'airport', name: 'Ben Gurion Airport', id: 'TLV' }] };
    expect(mapAutocomplete(raw).suggestions).toEqual([
      { code: 'TLV', name: 'Ben Gurion Airport', city: 'Ben Gurion Airport' },
    ]);
  });

  it('returns an empty list when the provider reports a no-results error string', () => {
    expect(mapAutocomplete({ error: "Google hasn't returned any results for this query." })).toEqual({
      suggestions: [],
    });
  });

  it('throws PROVIDER_DOWN on an unexpected shape', () => {
    expect(() => mapAutocomplete({ foo: 1 })).toThrow(
      expect.objectContaining({ code: 'PROVIDER_DOWN' }),
    );
    expect(() => mapAutocomplete(null)).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapAutocomplete({ suggestions: 'nope' })).toThrow(
      expect.objectContaining({ code: 'PROVIDER_DOWN' }),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wayfinder/api test -- autocomplete.mapper`
Expected: FAIL, `Cannot find module './autocomplete.mapper'`.

- [ ] **Step 3: Implement**

`apps/api/src/geo/autocomplete.mapper.ts`:
```ts
import {
  GeoSuggestResponseSchema,
  type GeoSuggestion,
  type GeoSuggestResponse,
} from '@wayfinder/shared';
import { z } from 'zod';
import { AppError } from '../common/app-error';

const RawAirportSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().optional(),
});

const RawSuggestionSchema = z.object({
  type: z.string(),
  name: z.string(),
  id: z.string().optional(),
  airports: z.array(RawAirportSchema).optional(),
});

const RawResponseSchema = z.object({ suggestions: z.array(RawSuggestionSchema) });

const IATA = /^[A-Z]{3}$/;

const isErrorString = (raw: unknown): boolean =>
  typeof raw === 'object' && raw !== null && typeof (raw as { error?: unknown }).error === 'string';

export const mapAutocomplete = (raw: unknown): GeoSuggestResponse => {
  const parsed = RawResponseSchema.safeParse(raw);
  if (!parsed.success) {
    if (isErrorString(raw)) return { suggestions: [] };
    throw new AppError('PROVIDER_DOWN', 'Unexpected autocomplete response');
  }

  const seen = new Set<string>();
  const suggestions: GeoSuggestion[] = [];
  const add = (suggestion: GeoSuggestion) => {
    if (seen.has(suggestion.code)) return;
    seen.add(suggestion.code);
    suggestions.push(suggestion);
  };

  for (const item of parsed.data.suggestions) {
    if (item.type === 'city') {
      for (const airport of item.airports ?? []) {
        if (IATA.test(airport.id)) {
          add({ code: airport.id, name: airport.name, city: airport.city ?? item.name });
        }
      }
    } else if (item.type === 'airport' && item.id && IATA.test(item.id)) {
      add({ code: item.id, name: item.name, city: item.name });
    }
  }

  const checked = GeoSuggestResponseSchema.safeParse({ suggestions });
  if (!checked.success) throw new AppError('PROVIDER_DOWN', 'Autocomplete mapping failed');
  return checked.data;
};
```

`apps/api/scripts/refresh-fixture.ts` (manual, never run in CI; costs 1 SerpAPI credit):
```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const [query = 'tel aviv', name = 'tel-aviv'] = process.argv.slice(2);
const key = process.env.SERPAPI_KEY;
if (!key) throw new Error('SERPAPI_KEY is required (set it in apps/api/.env)');

const url = new URL('https://serpapi.com/search.json');
url.search = new URLSearchParams({
  engine: 'google_flights_autocomplete',
  q: query,
  hl: 'en',
  gl: 'us',
  api_key: key,
}).toString();

const response = await fetch(url);
if (!response.ok) throw new Error(`SerpAPI responded ${response.status}`);
const body = (await response.json()) as Record<string, unknown>;

// Keep only what the mapper needs. search_metadata holds private archive URLs.
const fixture = { search_parameters: { engine: 'google_flights_autocomplete', q: query, hl: 'en', gl: 'us' }, suggestions: body.suggestions };

const target = join(__dirname, '../test/fixtures/google_flights_autocomplete', `${name}.json`);
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`wrote ${target}`);
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @wayfinder/api test -- autocomplete.mapper && pnpm --filter @wayfinder/api typecheck`
Expected: PASS. (`resolveJsonModule` is already on in the base tsconfig, so the fixture import works.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/geo/autocomplete.mapper.ts apps/api/src/geo/autocomplete.mapper.spec.ts apps/api/scripts apps/api/test/fixtures
git commit -m "feat(api): add autocomplete mapper with real response fixture"
```

---

### Task 7: Auth guard (Supabase JWT)

**Files:**
- Create: `apps/api/src/auth/{jwt-verifier.ts,auth.guard.ts,current-user.decorator.ts,auth.module.ts}`
- Test: `apps/api/src/auth/auth.guard.spec.ts`

**Interfaces:**
- Consumes: `ENV`, `Env`, `AppError`, `IS_PUBLIC`.
- Produces:
  - `class JwtVerifier { constructor(getKey: JWTVerifyGetKey, issuer: string); verify(token: string): Promise<{ userId: string }> }`
  - `AuthGuard implements CanActivate` (sets `request.user = { userId }`)
  - `@CurrentUser()` param decorator returning `{ userId: string }`
  - `AuthModule` (global) providing `JwtVerifier` and registering `AuthGuard` as `APP_GUARD`

- [ ] **Step 1: Write the failing test**

`apps/api/src/auth/auth.guard.spec.ts`:
```ts
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { generateKeyPair, SignJWT, type KeyLike } from 'jose';
import { AuthGuard } from './auth.guard';
import { JwtVerifier } from './jwt-verifier';
import { IS_PUBLIC } from './public.decorator';

const ISSUER = 'https://proj.supabase.co/auth/v1';
const USER_ID = '7d0b2f4e-1111-4222-8333-944455556666';

const sign = (
  key: KeyLike,
  opts: { iat?: number; exp?: number; iss?: string; aud?: string; sub?: string | null } = {},
) => {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({})
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt(opts.iat ?? now)
    .setExpirationTime(opts.exp ?? now + 3600);
  if (opts.sub !== null) jwt.setSubject(opts.sub ?? USER_ID);
  return jwt.sign(key);
};

const contextFor = (headers: Record<string, string>, isPublic = false) => {
  const request: { headers: Record<string, string>; user?: unknown } = { headers };
  const handler = () => undefined;
  if (isPublic) Reflect.defineMetadata(IS_PUBLIC, true, handler);
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { context, request };
};

describe('AuthGuard', () => {
  let goodKeys: Awaited<ReturnType<typeof generateKeyPair>>;
  let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;
  let guard: AuthGuard;

  beforeAll(async () => {
    goodKeys = await generateKeyPair('ES256');
    otherKeys = await generateKeyPair('ES256');
    guard = new AuthGuard(new Reflector(), new JwtVerifier(async () => goodKeys.publicKey, ISSUER));
  });

  it('accepts a valid token and sets request.user', async () => {
    const token = await sign(goodKeys.privateKey);
    const { context, request } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: USER_ID });
  });

  it('rejects a missing header', async () => {
    const { context } = contextFor({});
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects a non-Bearer scheme', async () => {
    const { context } = contextFor({ authorization: 'Basic abc' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(goodKeys.privateKey, { iat: now - 7200, exp: now - 3600 });
    const { context } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects a token signed with a different key', async () => {
    const token = await sign(otherKeys.privateKey);
    const { context } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects a wrong issuer and a wrong audience', async () => {
    const badIssuer = await sign(goodKeys.privateKey, { iss: 'https://evil.example/auth/v1' });
    const badAudience = await sign(goodKeys.privateKey, { aud: 'anon' });
    for (const token of [badIssuer, badAudience]) {
      const { context } = contextFor({ authorization: `Bearer ${token}` });
      await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    }
  });

  it('rejects a token without a subject', async () => {
    const token = await sign(goodKeys.privateKey, { sub: null });
    const { context } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('lets @Public() routes through without a token', async () => {
    const { context } = contextFor({}, true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wayfinder/api test -- auth.guard`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`apps/api/src/auth/jwt-verifier.ts`:
```ts
import { jwtVerify, type JWTVerifyGetKey } from 'jose';

export class JwtVerifier {
  constructor(
    private readonly getKey: JWTVerifyGetKey,
    private readonly issuer: string,
  ) {}

  async verify(token: string): Promise<{ userId: string }> {
    const { payload } = await jwtVerify(token, this.getKey, {
      issuer: this.issuer,
      audience: 'authenticated',
    });
    if (!payload.sub) throw new Error('token has no subject');
    return { userId: payload.sub };
  }
}
```

`apps/api/src/auth/auth.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../common/app-error';
import { JwtVerifier } from './jwt-verifier';
import { IS_PUBLIC } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { userId: string };
    }>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError('UNAUTHENTICATED', 'Missing bearer token');
    }

    try {
      request.user = await this.verifier.verify(token);
    } catch {
      throw new AppError('UNAUTHENTICATED', 'Invalid or expired token');
    }
    return true;
  }
}
```

`apps/api/src/auth/current-user.decorator.ts`:
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUser = { userId: string };

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  return context.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
```

`apps/api/src/auth/auth.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createRemoteJWKSet } from 'jose';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';
import { AuthGuard } from './auth.guard';
import { JwtVerifier } from './jwt-verifier';

@Global()
@Module({
  providers: [
    {
      provide: JwtVerifier,
      inject: [ENV],
      useFactory: (env: Env) =>
        new JwtVerifier(
          createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)),
          `${env.SUPABASE_URL}/auth/v1`,
        ),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [JwtVerifier],
})
export class AuthModule {}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @wayfinder/api test -- auth.guard`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(api): add Supabase JWT auth guard"
```

---

### Task 8: Geo module and API end-to-end test

**Files:**
- Create: `apps/api/src/geo/{geo.dto.ts,geo.service.ts,geo.controller.ts,geo.module.ts}`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/geo.e2e.spec.ts`

**Interfaces:**
- Consumes: `SerpApiClient.call`, `mapAutocomplete`, `CurrentUser`, `GeoSuggestQuerySchema`.
- Produces: `GET /geo/suggest?q&kind` returning `GeoSuggestResponse`.

- [ ] **Step 1: Write the failing e2e test**

`apps/api/test/geo.e2e.spec.ts`:
```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtVerifier } from '../src/auth/jwt-verifier';
import { ENV, REDIS } from '../src/common/tokens';
import { PrismaService } from '../src/prisma/prisma.service';
import fixture from './fixtures/google_flights_autocomplete/tel-aviv.json';
import { FakeRedis } from './fake-redis';
import { testEnv } from './test-env';

const ISSUER = `${testEnv.SUPABASE_URL}/auth/v1`;
const USER_ID = '7d0b2f4e-1111-4222-8333-944455556666';

describe('GET /geo/suggest (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let fetchSpy: jest.SpyInstance;
  const searchLogCreate = jest.fn().mockResolvedValue({});

  beforeAll(async () => {
    const keys = await generateKeyPair('ES256');
    token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setSubject(USER_ID)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keys.privateKey);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue({ ...testEnv, DAILY_CREDIT_CAP: 1 })
      .overrideProvider(REDIS)
      .useValue(new FakeRedis())
      .overrideProvider(PrismaService)
      .useValue({ searchLog: { create: searchLogCreate } })
      .overrideProvider(JwtVerifier)
      .useValue(new JwtVerifier(async () => keys.publicKey, ISSUER))
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    searchLogCreate.mockClear();
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(fixture), { status: 200 }));
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => app.close());

  const get = (path: string, withToken = true) => {
    const req = request(app.getHttpServer()).get(path);
    return withToken ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('GET /health is public', async () => {
    await get('/health', false).expect(200, { ok: true });
  });

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const res = await get('/geo/suggest?q=tel%20aviv', false).expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 400 BAD_QUERY for a too-short query', async () => {
    const res = await get('/geo/suggest?q=a').expect(400);
    expect(res.body).toEqual({ code: 'BAD_QUERY', message: 'Invalid request' });
  });

  it('returns 400 BAD_QUERY for an unsupported kind', async () => {
    await get('/geo/suggest?q=paris&kind=hotel').expect(400);
  });

  it('returns suggestions, then serves the same query from cache and logs both', async () => {
    const expected = {
      suggestions: [{ code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv-Yafo' }],
    };

    await get('/geo/suggest?q=Tel%20Aviv').expect(200, expected);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(searchLogCreate).toHaveBeenLastCalledWith({
      data: { userId: USER_ID, engine: 'google_flights_autocomplete', cacheHit: false, credits: 1 },
    });

    await get('/geo/suggest?q=%20tel%20%20aviv').expect(200, expected);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(searchLogCreate).toHaveBeenLastCalledWith({
      data: { userId: USER_ID, engine: 'google_flights_autocomplete', cacheHit: true, credits: 0 },
    });
  });

  it('returns 429 RATE_LIMITED for a new query once the daily cap (1) is used', async () => {
    // The previous test already spent the single credit for this user.
    const res = await get('/geo/suggest?q=london').expect(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

Note: these tests depend on running in order within the file (the cache and credit state is shared across the `it` blocks). Keep them in this order.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wayfinder/api test -- geo.e2e`
Expected: FAIL, `Cannot find module '../src/geo/...'` or 404s because the module isn't wired.

- [ ] **Step 3: Implement the geo module**

`apps/api/src/geo/geo.dto.ts`:
```ts
import { GeoSuggestQuerySchema } from '@wayfinder/shared';
import { createZodDto } from 'nestjs-zod';

export class GeoSuggestQueryDto extends createZodDto(GeoSuggestQuerySchema) {}
```

`apps/api/src/geo/geo.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import type { GeoSuggestResponse } from '@wayfinder/shared';
import { SerpApiClient } from '../provider/serpapi.client';
import { mapAutocomplete } from './autocomplete.mapper';

const AUTOCOMPLETE_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class GeoService {
  constructor(private readonly serpApi: SerpApiClient) {}

  suggestAirports(userId: string, q: string): Promise<GeoSuggestResponse> {
    return this.serpApi.call({
      engine: 'google_flights_autocomplete',
      params: { q: q.toLowerCase(), hl: 'en', gl: 'us' },
      ttlSeconds: AUTOCOMPLETE_TTL_SECONDS,
      userId,
      map: mapAutocomplete,
    });
  }
}
```

`apps/api/src/geo/geo.controller.ts`:
```ts
import { Controller, Get, Query } from '@nestjs/common';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { GeoSuggestQueryDto } from './geo.dto';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('suggest')
  suggest(@Query() query: GeoSuggestQueryDto, @CurrentUser() user: AuthUser) {
    return this.geo.suggestAirports(user.userId, query.q);
  }
}
```

`apps/api/src/geo/geo.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ProviderModule } from '../provider/provider.module';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  imports: [ProviderModule],
  controllers: [GeoController],
  providers: [GeoService],
})
export class GeoModule {}
```

Replace `apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { AppExceptionFilter } from './common/app-exception.filter';
import { ConfigModule } from './config/config.module';
import { GeoModule } from './geo/geo.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, AuthModule, GeoModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Run the whole API suite**

Run: `pnpm --filter @wayfinder/api test && pnpm --filter @wayfinder/api typecheck && pnpm --filter @wayfinder/api lint`
Expected: PASS everywhere. If the e2e suite throws from `RedisModule`'s `onApplicationShutdown` because `FakeRedis` has no `quit`, add `async quit() { return 'OK'; }` to `FakeRedis`.

- [ ] **Step 5: Manual smoke check against the real stack**

Run (needs `apps/api/.env` filled in): `pnpm --filter @wayfinder/api dev`
In another shell: `curl -i localhost:3000/health` → `200 {"ok":true}`; `curl -i "localhost:3000/geo/suggest?q=tel%20aviv"` → `401 {"code":"UNAUTHENTICATED",...}`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(api): add geo suggest endpoint with e2e coverage"
```

---

### Task 9: Mobile scaffold (Expo, Router, NativeWind, Query)

**Files:**
- Create: `apps/mobile/*` (Expo project), `apps/mobile/{babel.config.js,metro.config.js,tailwind.config.js,global.css,jest.config.js,eslint.config.mjs}`
- Create: `apps/mobile/src/components/{Input.tsx,SuggestionRow.tsx}`, `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Produces: a running Expo Router app with NativeWind, a `QueryClientProvider`, the theme tokens, and the `Input` and `SuggestionRow` components.
  - `Input(props: TextInputProps & { label?: string })`
  - `SuggestionRow({ code, name, city, onPress }: { code: string; name: string; city: string; onPress: () => void })`

- [ ] **Step 1: Create the Expo app**

Run from the repo root:
```bash
pnpm create expo-app@latest apps/mobile --template blank-typescript --no-install
```
Delete the template's `App.tsx` and `index.ts`. Then set the name and entry in `apps/mobile/package.json`: `"name": "@wayfinder/mobile"`, `"main": "expo-router/entry"`. Add scripts: `"dev": "expo start --dev-client"`, `"typecheck": "tsc --noEmit"`, `"lint": "eslint app src"`, `"test": "jest"`.

- [ ] **Step 2: Install dependencies**

Run in `apps/mobile`:
```bash
pnpm install
pnpm exec expo install expo-router expo-linking expo-constants expo-status-bar expo-secure-store expo-dev-client react-native-safe-area-context react-native-screens react-native-reanimated @react-native-async-storage/async-storage
pnpm add nativewind@^4 @tanstack/react-query@^5 @supabase/supabase-js@^2 react-native-url-polyfill zod@^3.23.8 @wayfinder/shared@workspace:*
pnpm add -D tailwindcss@^3.4 jest-expo jest @types/jest @testing-library/react-native @wayfinder/config@workspace:*
```

- [ ] **Step 3: Config files**

`apps/mobile/app.json`:
```json
{
  "expo": {
    "name": "Wayfinder",
    "slug": "wayfinder",
    "scheme": "wayfinder",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": { "bundleIdentifier": "com.wayfinder.app", "supportsTablet": false },
    "android": { "package": "com.wayfinder.app" },
    "plugins": ["expo-router", "expo-secure-store"],
    "experiments": { "typedRoutes": true }
  }
}
```
(The bundle id `com.wayfinder.app` is hard to change after the first store build. Confirm or change it now.)

`apps/mobile/babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
```

`apps/mobile/metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

`apps/mobile/global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`apps/mobile/tailwind.config.js` (the theme tokens live here):
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0B6BCB', dark: '#084C91', soft: '#E6F0FB' },
        surface: { DEFAULT: '#FFFFFF', muted: '#F4F6F8' },
        ink: { DEFAULT: '#12202F', muted: '#5B6B7B' },
        line: '#D8DFE6',
        danger: '#B3261E',
      },
      borderRadius: { card: '12px' },
      spacing: { gutter: '16px' },
    },
  },
};
```

`apps/mobile/nativewind-env.d.ts`:
```ts
/// <reference types="nativewind/types" />
```

`apps/mobile/tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true, "types": ["jest"] },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "nativewind-env.d.ts"]
}
```

`apps/mobile/jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
};
```

`apps/mobile/eslint.config.mjs`:
```js
export { default } from '@wayfinder/config/eslint';
```

- [ ] **Step 4: Components and root layout**

`apps/mobile/src/components/Input.tsx`:
```tsx
import { Text, TextInput, View, type TextInputProps } from 'react-native';

type InputProps = TextInputProps & { label?: string };

export const Input = ({ label, className, ...rest }: InputProps) => (
  <View className="gap-1">
    {label ? <Text className="text-sm font-medium text-ink-muted">{label}</Text> : null}
    <TextInput
      className={`rounded-card border border-line bg-surface px-gutter py-3 text-base text-ink ${className ?? ''}`}
      placeholderTextColor="#5B6B7B"
      autoCapitalize="none"
      autoCorrect={false}
      {...rest}
    />
  </View>
);
```

`apps/mobile/src/components/SuggestionRow.tsx`:
```tsx
import { Pressable, Text, View } from 'react-native';

type SuggestionRowProps = {
  code: string;
  name: string;
  city: string;
  onPress: () => void;
};

export const SuggestionRow = ({ code, name, city, onPress }: SuggestionRowProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${name}, ${city}, ${code}`}
    className="flex-row items-center gap-3 border-b border-line px-gutter py-3 active:bg-brand-soft"
  >
    <View className="w-14 items-center rounded-card bg-brand-soft py-1">
      <Text className="text-base font-bold text-brand-dark">{code}</Text>
    </View>
    <View className="flex-1">
      <Text className="text-base text-ink" numberOfLines={1}>
        {name}
      </Text>
      <Text className="text-sm text-ink-muted" numberOfLines={1}>
        {city}
      </Text>
    </View>
  </Pressable>
);
```

`apps/mobile/app/_layout.tsx` (session provider is added in Task 10):
```tsx
import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Slot />
    </QueryClientProvider>
  );
}
```

Temporary `apps/mobile/app/index.tsx` so the app boots (deleted in Task 10):
```tsx
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <Text className="text-2xl font-bold text-brand">Wayfinder</Text>
    </View>
  );
}
```

- [ ] **Step 5: Verify**

Run: `pnpm --filter @wayfinder/mobile typecheck && pnpm --filter @wayfinder/mobile lint`
Expected: PASS.

Run: `pnpm --filter @wayfinder/mobile exec expo export --platform android`
Expected: the bundle builds with no Metro errors (confirms NativeWind, workspace imports and the config resolve).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo app with Router, NativeWind and base components"
```

---

### Task 10: Mobile auth (Supabase email code)

**Files:**
- Create: `apps/mobile/src/lib/{secure-store-adapter.ts,supabase.ts,session.tsx}`
- Create: `apps/mobile/app/(auth)/sign-in.tsx`, `apps/mobile/app/(app)/_layout.tsx`, `apps/mobile/app/(app)/index.tsx` (placeholder)
- Modify: `apps/mobile/app/_layout.tsx`; delete `apps/mobile/app/index.tsx`
- Test: `apps/mobile/src/lib/secure-store-adapter.test.ts`

**Interfaces:**
- Produces:
  - `chunkedSecureStore: { getItem(key): Promise<string | null>; setItem(key, value): Promise<void>; removeItem(key): Promise<void> }`
  - `supabase` (a `SupabaseClient`)
  - `SessionProvider`, `useSession(): { session: Session | null; loading: boolean }`

- [ ] **Step 1: Write the failing adapter test**

`apps/mobile/src/lib/secure-store-adapter.test.ts`:
```ts
import { chunkedSecureStore } from './secure-store-adapter';

const memory = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => memory.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (value.length > 2048) throw new Error('value too large for SecureStore');
    memory.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    memory.delete(key);
  }),
}));

describe('chunkedSecureStore', () => {
  beforeEach(() => memory.clear());

  it('round-trips a value larger than the SecureStore limit', async () => {
    const big = 'x'.repeat(5000);
    await chunkedSecureStore.setItem('sb-auth-token', big);
    expect(await chunkedSecureStore.getItem('sb-auth-token')).toBe(big);
  });

  it('returns null for a missing key', async () => {
    expect(await chunkedSecureStore.getItem('nope')).toBeNull();
  });

  it('removes every chunk', async () => {
    await chunkedSecureStore.setItem('k', 'y'.repeat(4000));
    await chunkedSecureStore.removeItem('k');
    expect(memory.size).toBe(0);
    expect(await chunkedSecureStore.getItem('k')).toBeNull();
  });

  it('overwriting with a shorter value leaves no stale chunks', async () => {
    await chunkedSecureStore.setItem('k', 'a'.repeat(5000));
    await chunkedSecureStore.setItem('k', 'short');
    expect(await chunkedSecureStore.getItem('k')).toBe('short');
    expect([...memory.keys()].sort()).toEqual(['k.0', 'k.n']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wayfinder/mobile test`
Expected: FAIL, `Cannot find module './secure-store-adapter'`.

- [ ] **Step 3: Implement**

`apps/mobile/src/lib/secure-store-adapter.ts`:
```ts
import * as SecureStore from 'expo-secure-store';

// SecureStore values are limited to about 2 KB on iOS and Supabase sessions are larger,
// so a value is split into chunks stored under `${key}.${index}` plus a `${key}.n` count.
const CHUNK_SIZE = 1800;

const removeItem = async (key: string): Promise<void> => {
  const count = await SecureStore.getItemAsync(`${key}.n`);
  if (count !== null) {
    for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}.n`);
};

const getItem = async (key: string): Promise<string | null> => {
  const count = await SecureStore.getItemAsync(`${key}.n`);
  if (count === null) return null;
  const parts: string[] = [];
  for (let i = 0; i < Number(count); i++) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
};

const setItem = async (key: string, value: string): Promise<void> => {
  await removeItem(key);
  const chunks = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
  await SecureStore.setItemAsync(`${key}.n`, String(chunks));
};

export const chunkedSecureStore = { getItem, setItem, removeItem };
```

`apps/mobile/src/lib/supabase.ts`:
```ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { chunkedSecureStore } from './secure-store-adapter';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: chunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

`apps/mobile/src/lib/session.tsx`:
```tsx
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

type SessionState = { session: Session | null; loading: boolean };

const SessionContext = createContext<SessionState>({ session: null, loading: true });

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ session, loading: false }),
    );

    // Pause token refresh while the app is in the background.
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    void supabase.auth.startAutoRefresh();

    return () => {
      subscription.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionState => useContext(SessionContext);
```

- [ ] **Step 4: Run the adapter test**

Run: `pnpm --filter @wayfinder/mobile test`
Expected: PASS.

- [ ] **Step 5: Routes**

Delete `apps/mobile/app/index.tsx`. Replace `apps/mobile/app/_layout.tsx`:
```tsx
import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SessionProvider } from '../src/lib/session';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Slot />
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

`apps/mobile/app/(app)/_layout.tsx`:
```tsx
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../src/lib/session';

export default function AppLayout() {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`apps/mobile/app/(app)/index.tsx` (placeholder, replaced in Task 11):
```tsx
import { Pressable, Text, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surface">
      <Text className="text-xl text-ink">Signed in</Text>
      <Pressable onPress={() => void supabase.auth.signOut()}>
        <Text className="text-brand">Sign out</Text>
      </Pressable>
    </View>
  );
}
```

`apps/mobile/app/(auth)/sign-in.tsx`:
```tsx
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Input } from '../../src/components/Input';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';

type Step = 'email' | 'code';

export default function SignIn() {
  const { session } = useSession();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) setError('Could not send the code. Check the email address and try again.');
    else setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (err) setError('That code is invalid or expired.');
    // On success onAuthStateChange updates the session and the redirect above runs.
  };

  const canSend = /\S+@\S+\.\S+/.test(email) && !busy;
  const canVerify = code.trim().length >= 6 && !busy;

  return (
    <View className="flex-1 justify-center gap-4 bg-surface px-gutter">
      <Text className="text-3xl font-bold text-brand">Wayfinder</Text>
      {step === 'email' ? (
        <>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Pressable
            disabled={!canSend}
            onPress={() => void sendCode()}
            className={`items-center rounded-card py-3 ${canSend ? 'bg-brand' : 'bg-line'}`}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Email me a code</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text className="text-ink-muted">Enter the 6-digit code sent to {email}.</Text>
          <Input
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={10}
          />
          <Pressable
            disabled={!canVerify}
            onPress={() => void verify()}
            className={`items-center rounded-card py-3 ${canVerify ? 'bg-brand' : 'bg-line'}`}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Sign in</Text>}
          </Pressable>
          <Pressable onPress={() => { setStep('email'); setCode(''); setError(null); }}>
            <Text className="text-center text-brand">Use a different email</Text>
          </Pressable>
        </>
      )}
      {error ? <Text className="text-danger">{error}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 6: Verify**

Run: `pnpm --filter @wayfinder/mobile typecheck && pnpm --filter @wayfinder/mobile lint && pnpm --filter @wayfinder/mobile test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): add Supabase email-code sign-in with chunked secure storage"
```

---

### Task 11: Mobile API client and the airport-suggest slice

**Files:**
- Create: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/src/features/geo/{useDebouncedValue.ts,useGeoSuggest.ts,suggest-ui-state.ts,SuggestionList.tsx}`
- Modify: `apps/mobile/app/(app)/index.tsx`
- Test: `apps/mobile/src/lib/api.test.ts`, `apps/mobile/src/features/geo/useDebouncedValue.test.ts`, `apps/mobile/src/features/geo/suggest-ui-state.test.ts`

**Interfaces:**
- Consumes: `supabase` (Task 10), `ApiErrorSchema`, `ErrorCode`, `GeoSuggestResponseSchema`, `GeoSuggestion` from `@wayfinder/shared`, `SuggestionRow`, `Input`.
- Produces:
  - `class ApiClientError extends Error { code: ErrorCode; status: number }`, `apiFetch<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>>`
  - `useDebouncedValue<T>(value: T, delayMs: number): T`
  - `normalizeQuery(text: string): string`, `useGeoSuggest(text: string)` (TanStack `UseQueryResult<GeoSuggestResponse>`)
  - `type SuggestUiState`, `toSuggestUiState(input: { text: string; isFetching: boolean; error: unknown; data?: GeoSuggestResponse }): SuggestUiState`

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/lib/api.test.ts`:
```ts
import { z } from 'zod';
import { ApiClientError, apiFetch } from './api';

const getSession = jest.fn();
const refreshSession = jest.fn();
const signOut = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      refreshSession: (...a: unknown[]) => refreshSession(...a),
      signOut: (...a: unknown[]) => signOut(...a),
    },
  },
}));

const Schema = z.object({ ok: z.boolean() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('apiFetch', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok1' } } });
    refreshSession.mockReset();
    signOut.mockReset().mockResolvedValue({});
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends the bearer token and parses the response with the schema', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await expect(apiFetch('/x', Schema)).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/x');
    expect(init.headers.Authorization).toBe('Bearer tok1');
  });

  it('refreshes the session once on 401 and retries with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ code: 'UNAUTHENTICATED', message: 'x' }, 401))
      .mockResolvedValueOnce(json({ ok: true }));
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'tok2' } }, error: null });

    await expect(apiFetch('/x', Schema)).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok2');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out and throws UNAUTHENTICATED when the refresh fails', async () => {
    fetchMock.mockResolvedValue(json({ code: 'UNAUTHENTICATED', message: 'x' }, 401));
    refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('nope') });

    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('signs out when the retry is still 401', async () => {
    fetchMock.mockResolvedValue(json({ code: 'UNAUTHENTICATED', message: 'x' }, 401));
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'tok2' } }, error: null });

    await expect(apiFetch('/x', Schema)).rejects.toBeInstanceOf(ApiClientError);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('turns an API error body into ApiClientError with the code and status', async () => {
    fetchMock.mockResolvedValue(json({ code: 'RATE_LIMITED', message: 'Daily search limit reached' }, 429));
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      message: 'Daily search limit reached',
    });
  });

  it('maps an unparseable error body to PROVIDER_DOWN', async () => {
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status: 502 }));
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'PROVIDER_DOWN', status: 502 });
  });

  it('throws UNAUTHENTICATED without calling the API when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

`apps/mobile/src/features/geo/useDebouncedValue.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react-native';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns the initial value immediately and updates only after the delay', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });
    expect(result.current).toBe('a');

    rerender({ v: 'ab' });
    act(() => void jest.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => void jest.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  it('restarts the timer on each change and keeps only the last value', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'ab' });
    act(() => void jest.advanceTimersByTime(200));
    rerender({ v: 'abc' });
    act(() => void jest.advanceTimersByTime(200));
    expect(result.current).toBe('a');
    act(() => void jest.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});
```

`apps/mobile/src/features/geo/suggest-ui-state.test.ts`:
```ts
import { ApiClientError } from '../../lib/api';
import { toSuggestUiState } from './suggest-ui-state';

jest.mock('../../lib/supabase', () => ({ supabase: { auth: {} } }));

const results = { suggestions: [{ code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv-Yafo' }] };

describe('toSuggestUiState', () => {
  it('is idle for text shorter than 2 characters', () => {
    expect(toSuggestUiState({ text: 'a', isFetching: false, error: null })).toEqual({ kind: 'idle' });
    expect(toSuggestUiState({ text: '  ', isFetching: false, error: null })).toEqual({ kind: 'idle' });
  });

  it('is loading while fetching without data', () => {
    expect(toSuggestUiState({ text: 'tel', isFetching: true, error: null })).toEqual({ kind: 'loading' });
  });

  it('is results when data has suggestions', () => {
    expect(toSuggestUiState({ text: 'tel', isFetching: false, error: null, data: results })).toEqual({
      kind: 'results',
      items: results.suggestions,
    });
  });

  it('is empty when data has no suggestions', () => {
    expect(
      toSuggestUiState({ text: 'zzz', isFetching: false, error: null, data: { suggestions: [] } }),
    ).toEqual({ kind: 'empty' });
  });

  it.each([
    ['RATE_LIMITED', 'daily search limit'],
    ['PROVIDER_DOWN', 'temporarily unavailable'],
    ['BAD_QUERY', 'valid search'],
    ['NO_RESULTS', 'no matches'],
    ['UNAUTHENTICATED', 'sign in'],
  ] as const)('maps %s to a friendly message', (code, fragment) => {
    const state = toSuggestUiState({
      text: 'tel',
      isFetching: false,
      error: new ApiClientError(code, 'server text', 400),
    });
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.code).toBe(code);
      expect(state.message.toLowerCase()).toContain(fragment);
    }
  });

  it('maps a non-API error to PROVIDER_DOWN', () => {
    const state = toSuggestUiState({ text: 'tel', isFetching: false, error: new Error('network') });
    expect(state).toMatchObject({ kind: 'error', code: 'PROVIDER_DOWN' });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @wayfinder/mobile test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`apps/mobile/src/lib/api.ts`:
```ts
import { ApiErrorSchema, type ErrorCode } from '@wayfinder/shared';
import type { z } from 'zod';
import { supabase } from './supabase';

export class ApiClientError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const apiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) throw new Error('EXPO_PUBLIC_API_URL is required');
  return url;
};

const send = (path: string, token: string) =>
  fetch(`${apiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

const unauthenticated = async (): Promise<never> => {
  await supabase.auth.signOut();
  throw new ApiClientError('UNAUTHENTICATED', 'Session expired. Please sign in again.', 401);
};

export const apiFetch = async <S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiClientError('UNAUTHENTICATED', 'Not signed in', 401);

  let response = await send(path, data.session.access_token);

  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) return unauthenticated();
    response = await send(path, refreshed.data.session.access_token);
    if (response.status === 401) return unauthenticated();
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) throw new ApiClientError(parsed.data.code, parsed.data.message, response.status);
    throw new ApiClientError('PROVIDER_DOWN', 'Unexpected response from the server', response.status);
  }

  return schema.parse(body);
};
```

`apps/mobile/src/features/geo/useDebouncedValue.ts`:
```ts
import { useEffect, useState } from 'react';

export const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
```

`apps/mobile/src/features/geo/suggest-ui-state.ts`:
```ts
import type { ErrorCode, GeoSuggestResponse, GeoSuggestion } from '@wayfinder/shared';
import { ApiClientError } from '../../lib/api';

export type SuggestUiState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'results'; items: GeoSuggestion[] }
  | { kind: 'error'; code: ErrorCode; message: string };

const MESSAGES: Record<ErrorCode, string> = {
  RATE_LIMITED: "You've reached today's daily search limit. Try again tomorrow.",
  PROVIDER_DOWN: 'Search is temporarily unavailable. Please try again in a moment.',
  BAD_QUERY: 'Please enter a valid search.',
  NO_RESULTS: 'No matches found.',
  UNAUTHENTICATED: 'Please sign in again.',
};

type Input = { text: string; isFetching: boolean; error: unknown; data?: GeoSuggestResponse };

export const toSuggestUiState = ({ text, isFetching, error, data }: Input): SuggestUiState => {
  if (text.trim().length < 2) return { kind: 'idle' };
  if (error) {
    const code = error instanceof ApiClientError ? error.code : 'PROVIDER_DOWN';
    return { kind: 'error', code, message: MESSAGES[code] };
  }
  if (!data) return isFetching ? { kind: 'loading' } : { kind: 'idle' };
  return data.suggestions.length === 0 ? { kind: 'empty' } : { kind: 'results', items: data.suggestions };
};
```

`apps/mobile/src/features/geo/useGeoSuggest.ts`:
```ts
import { GeoSuggestResponseSchema } from '@wayfinder/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useDebouncedValue } from './useDebouncedValue';

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const normalizeQuery = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();

export const useGeoSuggest = (text: string) => {
  const q = useDebouncedValue(normalizeQuery(text), DEBOUNCE_MS);

  return useQuery({
    queryKey: ['geo', 'suggest', q],
    queryFn: () =>
      apiFetch(`/geo/suggest?${new URLSearchParams({ q, kind: 'airport' }).toString()}`, GeoSuggestResponseSchema),
    enabled: q.length >= MIN_LENGTH,
    staleTime: ONE_DAY_MS,
    retry: false,
  });
};
```

`apps/mobile/src/features/geo/SuggestionList.tsx`:
```tsx
import type { GeoSuggestion } from '@wayfinder/shared';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SuggestionRow } from '../../components/SuggestionRow';
import type { SuggestUiState } from './suggest-ui-state';

type Props = { state: SuggestUiState; onSelect: (item: GeoSuggestion) => void };

export const SuggestionList = ({ state, onSelect }: Props) => {
  switch (state.kind) {
    case 'idle':
      return (
        <Text className="px-gutter py-4 text-ink-muted">Type a city or airport to search.</Text>
      );
    case 'loading':
      return (
        <View className="items-center py-6">
          <ActivityIndicator />
        </View>
      );
    case 'empty':
      return <Text className="px-gutter py-4 text-ink-muted">No airports found.</Text>;
    case 'error':
      return <Text className="px-gutter py-4 text-danger">{state.message}</Text>;
    case 'results':
      return (
        <FlatList
          data={state.items}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <SuggestionRow code={item.code} name={item.name} city={item.city} onPress={() => onSelect(item)} />
          )}
        />
      );
  }
};
```

Replace `apps/mobile/app/(app)/index.tsx`:
```tsx
import type { GeoSuggestion } from '@wayfinder/shared';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { SuggestionList } from '../../src/features/geo/SuggestionList';
import { toSuggestUiState } from '../../src/features/geo/suggest-ui-state';
import { useGeoSuggest } from '../../src/features/geo/useGeoSuggest';
import { supabase } from '../../src/lib/supabase';

export default function Home() {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<GeoSuggestion | null>(null);
  const query = useGeoSuggest(text);
  const state = toSuggestUiState({
    text,
    isFetching: query.isFetching,
    error: query.error,
    data: query.data,
  });

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="gap-3 px-gutter pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-brand">Wayfinder</Text>
          <Pressable onPress={() => void supabase.auth.signOut()}>
            <Text className="text-brand">Sign out</Text>
          </Pressable>
        </View>
        <Input
          label="Where from?"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setSelected(null);
          }}
          placeholder="City or airport"
        />
        {selected ? (
          <Text className="rounded-card bg-brand-soft p-3 text-ink">
            Selected: {selected.code} · {selected.name}
          </Text>
        ) : null}
      </View>
      <SuggestionList state={state} onSelect={setSelected} />
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `pnpm --filter @wayfinder/mobile test && pnpm --filter @wayfinder/mobile typecheck && pnpm --filter @wayfinder/mobile lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): add API client and airport suggest slice"
```

---

### Task 12: CI, Vercel deploy, EAS dev client and final verification

**Files:**
- Create: `.github/workflows/ci.yml`, `apps/api/vercel.json`, `apps/api/api/index.ts`, `apps/mobile/eas.json`
- Create: `apps/mobile/.env.example` is not needed (root `.env.example` covers it). Create the local `apps/mobile/.env` (ignored) from the root example.
- Modify: `.claude/serpapi-guide.md` (record the confirmed autocomplete response fields)

**Interfaces:**
- Produces: a CI pipeline, a deployable Vercel function exposing the Nest app, and EAS development build profiles.

- [ ] **Step 1: CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```
(`pnpm/action-setup` reads the version from `packageManager`. No secrets and no SerpAPI calls are needed. `prisma generate` runs in the API `postinstall` and doesn't need a database.)

- [ ] **Step 2: Vercel entry and config**

`apps/api/api/index.ts`:
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from '../src/app.module';

let cached: express.Express | undefined;

const getServer = async (): Promise<express.Express> => {
  if (!cached) {
    const server = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: ['error', 'warn'],
    });
    await app.init();
    cached = server;
  }
  return cached;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const server = await getServer();
  server(req, res);
}
```

`apps/api/vercel.json`:
```json
{
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm --filter @wayfinder/shared build && pnpm --filter @wayfinder/api exec prisma generate",
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

- [ ] **Step 3: Create the Vercel project (human)**

In Vercel: import the GitHub repo, set **Root Directory** to `apps/api`, enable "Include source files outside of the Root Directory", set the **Function Region** to the one nearest the Supabase project, and add the env vars `SERPAPI_KEY`, `SUPABASE_URL`, `DATABASE_URL` (pooled string), `REDIS_URL`, `DAILY_CREDIT_CAP`. Push a branch to get a preview deployment.

- [ ] **Step 4: Verify the preview**

Run: `curl -i https://<preview-url>/health`
Expected: `200 {"ok":true}`.

Run: `curl -i "https://<preview-url>/geo/suggest?q=tel%20aviv"`
Expected: `401 {"code":"UNAUTHENTICATED","message":"Missing bearer token"}`.

If the function fails to boot, read the Vercel function logs. The usual causes are a missing env var (the boot error lists the invalid keys, not values) or `@wayfinder/shared` not built (check the build command output).

- [ ] **Step 5: EAS development build**

`apps/mobile/eas.json`:
```json
{
  "cli": { "version": ">= 13.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://<preview-or-dev-api-url>" }
    },
    "production": { "autoIncrement": true }
  }
}
```
Fill in the real API URL, and put `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the `development` profile `env` (the anon key is publishable and safe to ship in the app).

Run (human, one-time): `pnpm dlx eas-cli login && pnpm --filter @wayfinder/mobile exec eas init`
Then: `pnpm --filter @wayfinder/mobile exec eas build --profile development --platform android` and the same with `--platform ios`.
Note: an iOS device build needs an Apple Developer account and a registered device (`eas device:create`). Without one, the iOS check in Step 7 is blocked.

- [ ] **Step 6: Record the confirmed response shape**

In `.claude/serpapi-guide.md`, replace the last "Gotchas" bullet about response field names with:
```
- `google_flights_autocomplete` returns `{ suggestions: [{ position, name, type: 'city' | 'region', description?, id, airports?: [{ name, id (IATA), city, city_id, distance }] }] }`. Cities carry `airports[]`. Regions have none. Other engines' field names are still unconfirmed, so confirm them from the first real response.
```

- [ ] **Step 7: Walk the "done" checklist from the spec**

1. Fresh clone: `git clone <repo> /tmp/wf && cd /tmp/wf && pnpm i && pnpm dev` starts the API on `:3000` and Metro. Expected: both start without errors.
2. Sign in on an Android build and an iOS build using an email code. Expected: you land on the airport search screen.
3. Type "tel aviv". Expected: a `TLV · Ben Gurion Airport` row appears. Clear the field, type "Tel Aviv" again. Expected: instant result. In Supabase SQL run
   `select engine, cache_hit, credits from search_logs order by created_at desc limit 2;`
   Expected: newest row `cache_hit = true, credits = 0`, the one before `cache_hit = false, credits = 1`.
4. Sign out and call the API with no token: `401 UNAUTHENTICATED`. Set `DAILY_CREDIT_CAP=1` in the dev API env, restart, search two different cities. Expected: the second shows "You've reached today's daily search limit".
5. Open a PR. Expected: CI is green and the Vercel preview deployment succeeds.

- [ ] **Step 8: Commit**

```bash
git add .github apps/api/vercel.json apps/api/api apps/mobile/eas.json .claude/serpapi-guide.md
git commit -m "chore: add CI, Vercel entry and EAS dev profiles"
```

---

## Self-Review (spec coverage)

| Spec requirement | Task |
|---|---|
| Monorepo pnpm + Turborepo, shared/config, `.gitignore`, CI | 1, 2, 12 (`.gitignore` already committed) |
| Shared Zod contracts + five error codes | 2 |
| `AuthGuard` verifying Supabase JWT via JWKS; `/health` public | 3 (health, `@Public`), 7 |
| `SerpApiClient`: canonical params, cache, Redis lock, timeout, one retry on 5xx only | 5 |
| Mapper validated against shared schema; bad shape gives `PROVIDER_DOWN` and logs a snippet | 5 (`mapOrLog`), 6 |
| Per-user daily credit cap, `SearchLog` per upstream call, 24 h autocomplete TTL | 5, 8 |
| Exception filter with `{ code, message }` | 3 |
| Env validated at boot, secrets not logged | 3 |
| Prisma: `Profile`, `SearchLog`, trigger, RLS, pooled vs direct URL | 4 |
| Mobile: sign-in code flow, secure-store session, 401 refresh-once-then-sign-out | 10, 11 |
| Slice screen: debounce about 300 ms, min 2 chars, state mapping, selection shows code and name | 11 |
| NativeWind tokens, `Input` and `SuggestionRow` | 9 |
| Custom EAS dev client, Android and iOS | 12 |
| Tests: shared, mapper (fixture + malformed), client, guard, e2e, mobile hook | 2, 5, 6, 7, 8, 11 |
| Done criteria 1 to 5 | 12 Step 7 |

Type-consistency check: `ErrorCode`, `ApiError`, `HTTP_STATUS_BY_CODE`, `GeoSuggestion`, `GeoSuggestResponse` are defined in Task 2 and used under those names throughout. `SerpApiClient.call` options (`engine, params, ttlSeconds, userId, map`) match between Tasks 5 and 8. `SearchLogService.record` entry (`userId, engine, cacheHit, credits`) matches the Prisma `searchLog.create` data and the e2e assertions. `apiFetch(path, schema)` and `ApiClientError(code, message, status)` match between Tasks 11's tests and implementation.

Known assumptions to re-check during execution (each has a test or a verification step): the `type: 'airport'` suggestion shape (Task 6, unobserved); Vercel's handling of the Nest function and monorepo install (Task 12 Step 4); pnpm hoisted linker with Metro (Task 9 Step 5); the redundant `FakeRedis.quit` need (Task 8 Step 4).
