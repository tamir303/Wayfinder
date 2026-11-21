# Wayfinder backend roadmap: phases B0 to B6

Status on 2026-11-21. Aligned to the frontend quarters in `docs/planning.md`. Each phase ends with something the frontend can switch from mock data to the real API.

## Where we are
**Done and live-verified:** monorepo; NestJS app with config validation, `AppExceptionFilter` (`{code,message}`), `/health`; Prisma schema (`profiles`, `search_logs`), auth-user trigger, RLS, applied to Supabase; Supabase JWT guard (JWKS); `SerpApiClient` (canonical params, Redis cache, request coalescing, retry on 5xx only, atomic per-user daily credit reserve/refund, search log); `geo/suggest`; CORS (`CORS_ORIGINS`); Swagger UI at `/` and `/openapi.json`; Vercel entry; CI. 57 tests.

**Captured, not built:** real `google_flights` fixtures (`tlv-cdg-oneway.json`, `tlv-cdg-oneway-booking.json`). Findings: results are `best_flights` / `other_flights` with `booking_token`; the booking lookup needs route params plus the token; provider links are POSTs (`url` + `post_data`).

**Known gaps:** only 5 error codes (a 404 is reported as `BAD_QUERY`); no staging environment separate from the live project; no per-IP rate limit; logs are not environment-aware; `/me/usage` (used by the frontend profile screen) does not exist.

## The loop (every slice)
1. Contract in `packages/shared` (Zod, shared with the frontend mocks).
2. Real fixture(s) in `apps/api/test/fixtures/<engine>/` (budget: a few credits per slice).
3. Mapper with unit tests (valid fixture, empty result, provider error string, malformed shape).
4. Service on `SerpApiClient.call` (TTL, credits), then controller with `@ApiTags`/`@ApiQuery`/`@ApiBearerAuth`.
5. e2e test (fetch mocked) covering auth, validation, cache hit, cap, errors.
6. Update the frontend mock in `apps/mobile/src/lib/mock/` to match the real contract.
7. Deploy to staging, smoke test, then promote.
Done = lint, typecheck, tests green; Swagger documents it; no secrets in logs; progress ledger updated.

## B0: hardening and shared plumbing (now)
- `GET /me/usage` returning `{used, cap}` from the credit ledger (frontend profile screen needs it).
- Error codes: add `NOT_FOUND` (and keep a 404 from becoming `BAD_QUERY`); mirror in `packages/shared` and the mobile messages (EN and HE).
- Environment-aware logging: `APP_ENV` = dev | staging | prod. staging logs at debug with nothing hidden; prod logs at info with tokens, emails and keys redacted. Request-id on every log line.
- Per-IP rate limit on public routes (`@nestjs/throttler`), applied to `/flights/handoff` and `/health`.
- Staging environment: separate Supabase project, Upstash database, SerpAPI key and Vercel project; `.env.staging` / CI secrets; migration promotion runbook.
- Observability: Sentry (errors, no PII), uptime check on `/health`.
Exit: staging and prod exist with the same code and different config; the frontend profile meter is real.

## B1: Flights (frontend Q1 2027)
- Contracts (`FlightSearchQuery`, `FlightOffer`, `FlightSearchResponse`, price insights) in `packages/shared`.
- `flights` module: `mapFlights` (merge best and other, stops from layovers, emissions, price insights), `GET /flights/search` (TTL 30 min, 1 credit, USD for now).
- `handoff` module: signed `ref` (HMAC with `HANDOFF_SECRET`, user, route and booking token, short expiry) embedded in each offer's `handoffUrl`; `GET /flights/handoff?ref=` is public, verifies the signature, reserves 1 credit for the owning user, calls the booking lookup, records a `HandoffClick`, and returns a small HTML page that auto-submits the provider POST (a chooser page when several providers). New table `handoff_clicks` (+ RLS) and migration.
- Round trip: `GET /flights/return?token=` (`departure_token`), then booking options.
- `GET /flights/calendar` (`google_flights_calendar`) for flexible dates.
- Saved searches: table, RLS, CRUD.
Exit: TLV to Paris to the provider's booking page on staging.

## B2: Stays and maps (Q2 2027) - DONE
Built: `GET /stays/search`, `/stays/suggest`, `/stays/:token` (facts, rating breakdown, other-site ratings, photos, nearby, typical range, prices by provider), `/stays/:token/calendar` (price per start day), `/stays/:token/reviews` (paged, no reviewer profile data), `/stays/handoff` (signed, logs the booking site), favorites CRUD, `GET /maps/config` (tile style URL from `MAP_STYLE_URL`, null until a tile provider is chosen).
Deliberately not built: bounding-box search (the Google Hotels engine searches by text, not by map area, so "search this area" will be a destination search); a separate photos engine (detail already returns up to 12 photos); the `booking` second source (only if Google coverage proves weak).
Exit met: compare stays on a map and click through (map tiles wait on a tile-provider choice).

## B3: Places and trips (Q3 2027)
- `places` module: Tripadvisor search and detail mappers, `google_maps` place search, `google_maps_directions` with decoded route polylines.
- `trips` module and tables (`trips`, `trip_days`, `trip_items` with `snapshot` JSONB), RLS so a user sees only their own, CRUD plus reorder and day assignment, indicative cost estimate (flagged "as of").
- Snapshots so saved trips render offline and after provider data changes.
Exit: build a complete trip end to end.

## B4: Price watch and notifications (Q4 2027)
- `watches` table, a Vercel Cron job that re-checks watched routes and stays cheaply (calendar endpoints, cache-first), push token registration, delivery through the Expo push service, queue for retries (Upstash QStash).
Exit: price-drop push notifications.

## B5: Cost, quotas, analytics, privacy (Q4 2027)
- Per-user quota tiers and a global daily cap; credit dashboard query; alert at 80% of the monthly SerpAPI plan; cache warming for popular routes.
- Analytics events endpoint (funnels including handoff click-through), no PII to third parties.
- Account deletion and data export, retention policy for `search_logs` and `handoff_clicks`.
- Terms and attribution headers in responses where required.

## B6: Launch hardening
- Security review (RLS audit with Supabase advisors, secrets, CORS, signed-ref expiry, dependency audit), load test of search and handoff, backups and restore drill, runbook and on-call, decide whether Swagger stays public in prod (recommendation: staging only, or behind a flag).

## Cross-cutting
- **Cost:** every new SerpAPI engine goes through `SerpApiClient`; one credit reserved per paid call, refunded on failure; fixtures captured once.
- **Privacy:** user identity never leaves our API; only query text goes to SerpAPI.
- **Contract sync:** the shared Zod schemas are the single source; the mobile mock handlers are updated in the same change as the endpoint.
- **Testing:** fixture-driven mapper tests, e2e per endpoint, a nightly live smoke test against staging with a small credit budget.

## Risks
SerpAPI field drift (fixtures and tolerant mappers); handoff POST behaviour differing per provider (chooser page, logging, tests per provider shape); credit cost growth (caching, quotas, plan review); Vercel serverless limits for cron and long requests (measure early on staging).
