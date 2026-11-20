# Foundation and SerpAPI Provider Layer: Design

Date: 2026-11-21. Status: approved in brainstorming, pending written-spec review.
Context: `docs/tech-stack.md`, `docs/architecture.md`, `docs/planning.md` (Q4 2026), `.claude/serpapi-guide.md`.

## Goal

Build the shared base every later feature depends on, and prove every layer works end to end with **one thin vertical slice**: the signed-in user types a city and gets airport suggestions, going app, API, cache, SerpAPI `google_flights_autocomplete`, and back.

## Decisions (settled in brainstorming)

| Topic | Decision |
|---|---|
| Scope | Foundation plus one slice (airport autocomplete). No other search features. |
| Contract sharing | Zod schemas in `packages/shared`, used by the API (via `nestjs-zod`) and the app |
| Sign-in | Supabase Auth, email one-time code (magic link or 6-digit code) only |
| Access | Every API endpoint requires a valid Supabase JWT (except `/health`) |
| Platforms | iOS and Android together, via an EAS custom dev client (not Expo Go) |
| Stack | Expo, NativeWind, TanStack Query; NestJS on Vercel; Prisma on Supabase Postgres; Upstash Redis |

## 1. Repo and packages

```
apps/
  mobile/        Expo app (Expo Router, NativeWind, TanStack Query)
  api/           NestJS app (deployed to Vercel)
packages/
  shared/        Zod schemas, inferred types, error codes
  config/        tsconfig, eslint, prettier presets
```

- pnpm workspaces plus Turborepo (`build`, `lint`, `typecheck`, `test`, with caching).
- `packages/shared` holds contracts only: `GeoSuggestQuery`, `GeoSuggestResponse`, and the error codes `NO_RESULTS`, `RATE_LIMITED`, `PROVIDER_DOWN`, `BAD_QUERY`, `UNAUTHENTICATED`. Its only runtime dependency is Zod.
- Both apps import from `shared`. Neither imports from the other. Raw SerpAPI types stay inside `apps/api`.
- `git init` at the root. `.gitignore` excludes `.mcp.json`, `.env*` and build output.
- CI (GitHub Actions) runs lint, typecheck and test on each PR. Vercel creates API previews. EAS mobile builds are outside the CI scope for this spec.

## 2. API and provider layer

Request path for `GET /geo/suggest?q=tel aviv&kind=airport`:

```
AuthGuard → ZodValidationPipe → GeoController → GeoService → SerpApiClient.call()
  canonicalize → Redis get → (miss) lock → SerpAPI → mapper → Redis set
```

- **`AuthGuard`** verifies the Supabase JWT against the project's JWKS and sets `{ userId }` on the request. A missing or invalid token gives 401 `UNAUTHENTICATED`. Routes are guarded by default, and only `/health` opts out.
- **`SerpApiClient`** is the only code that knows the SerpAPI URL and key.
  - Builds canonical params (sorted keys, trimmed and uppercased codes, fixed `hl` and `gl` defaults). The cache key is the engine plus the canonical params.
  - A Redis lock stops concurrent identical misses from spending two credits.
  - Timeout, and one retry on 5xx, never on 4xx.
  - Passes raw JSON to a per-engine mapper that returns our DTO, validated against the `shared` schema.
- **Slice mapper:** `google_flights_autocomplete` to `GeoSuggestResponse` (name, type, IATA code, city, country). An unexpected shape throws `PROVIDER_DOWN` and logs the raw payload, and it never returns partial data to the app.
- **Cost controls:** a per-user daily credit cap counted in Redis. A `SearchLog` row per upstream call (engine, cache hit, credits, user). Autocomplete TTL is 24 h.
- **Errors:** one Nest exception filter maps failures to the codes in `shared`. The body is `{ code, message }`.
- **Config:** `SERPAPI_KEY`, `SUPABASE_URL`, `DATABASE_URL`, `REDIS_URL`, all validated at boot. The API refuses to start if one is missing. Secrets are never logged.

## 3. Mobile app and data

```
app/
  _layout.tsx          providers: Supabase session, QueryClient, theme
  (auth)/sign-in.tsx   email → one-time code
  (app)/_layout.tsx    redirect to sign-in when there is no session
  (app)/index.tsx      airport search box + suggestions list
src/
  lib/supabase.ts      client, session stored in expo-secure-store
  lib/api.ts           fetch wrapper: Bearer token, errors parsed with shared schemas
  features/geo/        useGeoSuggest hook, SuggestionList component
```

- **Auth:** the user enters their email, Supabase sends a 6-digit code, and the user types it in. The session is kept in secure storage. `lib/api.ts` adds the access token to each request. On a 401 it refreshes the session once and retries, and if that fails it signs the user out.
- **Slice screen:** debounced input (about 300 ms, minimum 2 characters). `useGeoSuggest` is a TanStack Query hook keyed on the normalized text, with a `staleTime` of 24 h. It has loading, empty and error states, each mapped from the four error codes. Selecting an airport only shows its code and name.
- **Styling:** NativeWind with the theme tokens (color, spacing, radius, type scale) in `tailwind.config`. Two components, `Input` and `SuggestionRow`, using tokens only.
- **Database (Prisma, Supabase Postgres):** `Profile(id = auth.users.id, created_at)` and `SearchLog`. A database trigger on `auth.users` creates the profile row. RLS is enabled on both tables in a raw SQL migration. Users can read their own `Profile`, and only the API's service role writes `SearchLog`. Prisma owns the `public` schema. It uses the pooled connection string at runtime and the direct one for migrations.
- **Dev setup:** a custom EAS dev client, because later modules (maps, secure store) need native code. Local dev runs the API against a Supabase project and a Redis instance.

## 4. Testing and done

**Tests**
- `shared`: schema unit tests (valid and invalid payloads).
- Mapper: a test against one saved real response, `apps/api/test/fixtures/google_flights_autocomplete/tel-aviv.json` (the only live SerpAPI call this spec needs, one credit). A second test feeds a malformed payload and expects `PROVIDER_DOWN`.
- `SerpApiClient`: HTTP and Redis mocked. Covers canonicalization (equal queries share a key), cache hit and miss, lock behavior, and retry on 5xx only.
- `AuthGuard`: valid, expired, wrong signature and missing header.
- API e2e (Supertest, SerpAPI mocked): 401 without a token, 400 for a bad query, 200 with the expected DTO.
- Mobile: a `useGeoSuggest` hook test (debounce, error mapping). No UI snapshots yet.
- CI runs all of the above. The only live SerpAPI call is a manual script that refreshes the fixture, never run in CI.

**Done when**
1. A fresh clone runs `pnpm i && pnpm dev` and starts both apps.
2. A user signs in with an email code on an Android build and an iOS build.
3. Typing "tel aviv" shows airport suggestions, and the same query again is a cache hit, which `SearchLog` confirms.
4. A request without a token, or over the daily cap, returns the right error code and the app shows the matching state.
5. CI is green and the API deploys to a Vercel preview.

## Out of scope

Flight, hotel and attraction search, maps, trips, handoff, price watch, social sign-in, anonymous access, the web app, and fixtures for engines other than flight autocomplete.

## Open items to settle in the implementation plan

- Redis provider details (Upstash plan and region) and the Vercel function region next to the Supabase project.
- Whether the daily credit cap is a flat number or configurable per environment.
- Confirm the exact `google_flights_autocomplete` response fields from the first live response, and update `.claude/serpapi-guide.md`.
- Test devices: which iOS and Android devices are available for the sign-in check.
