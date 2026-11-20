# Wayfinder: Tech Stack

Status: **draft for review.** Items marked **(decide)** are open choices. The rest are recommendations.

## Product in one line

One app that covers the whole trip: find flights (Skyscanner-style), compare stays on a map (Booking-style), and plan attractions (Tripadvisor-style). Wayfinder **never takes payment**. It hands the user off to the provider to close the deal.

## Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native + **Expo** (TypeScript) | Fast iteration, OTA updates, and the installed plugins assume Expo |
| Navigation | Expo Router (file-based) | Typed routes and deep links come for free |
| Server state | TanStack Query | Caching, pagination and retries for slow SerpAPI calls |
| Client state | Zustand | Search form and trip draft; small and simple |
| Maps | `react-native-maps` (Google on Android, Apple on iOS) | Native performance, clustering and markers |
| Lists | FlashList | Flight and hotel result lists are long |
| Animation | Reanimated + Gesture Handler | Bottom sheets over the map, card transitions |
| Styling | **NativeWind** (decided; Tailwind for RN) | Fast to build, with design tokens defined in the Tailwind theme |
| API | **NestJS** (TypeScript) | Modules map cleanly to flights, hotels, places and trips |
| Validation | Zod (shared) or `class-validator` **(decide)** | Zod lets the app and API share one schema |
| Database | PostgreSQL (Supabase-hosted) | Users, trips, saved items; the Supabase plugin is installed |
| ORM | **Prisma** (decided) | Mature NestJS support, typed client, migrations |
| Cache | Redis | SerpAPI response cache, rate limiting and job queue |
| Jobs | **(decide)** Vercel Cron + a queue (e.g. Upstash QStash) instead of BullMQ | BullMQ needs a long-lived worker, which Vercel doesn't run |
| Auth | **Supabase Auth** (decided). The app signs in with `@supabase/supabase-js`; NestJS verifies the JWT in a guard | Avoids hand-rolled auth |
| Data provider | **SerpAPI**, server-side only | Single vendor for flights, hotels, maps and Tripadvisor |
| Monorepo | pnpm workspaces + Turborepo | Shared types between app and API |
| CI/CD | GitHub Actions; EAS Build/Submit for the app | |
| Hosting | **Vercel** (decided) for the NestJS API, with Upstash Redis | Zero-ops deploys and preview environments. Serverless, so see the constraints below |
| Observability | Sentry (app and API), pino logs | Track SerpAPI errors and credit burn |

## Repo layout

```
apps/
  mobile/           Expo app
  api/              NestJS app
packages/
  shared/           Zod schemas, DTO types, enums (airport codes, currencies)
  config/           eslint, tsconfig, prettier presets
docs/               these documents
.claude/            Claude Code config + serpapi-guide.md
```

## Hard rules

1. **The SerpAPI key and MCP URL never reach the app.** All provider calls go through NestJS.
2. **The app talks to our own normalized API**, never to raw SerpAPI JSON. If we ever swap providers, the app doesn't change.
3. **Wayfinder doesn't process payments.** There is no card data and no PCI scope. "Book" means an outbound link, with an affiliate parameter where a provider allows one.
4. **Every SerpAPI call goes through one cache-aware client** (see architecture.md).

## Open decisions

| # | Question | Default if undecided |
|---|---|---|
| 1 | ~~Auth~~ **Decided: Supabase Auth** | n/a |
| 2 | ~~ORM~~ **Decided: Prisma** | n/a |
| 3 | ~~Styling~~ **Decided: NativeWind** | n/a |
| 4 | ~~API host~~ **Decided: Vercel** (changed from Fly.io) | n/a |
| 5 | Web companion app (Next.js)? | Not before Q4 2027 |
| 6 | Launch markets, languages and currencies | English, USD plus the user's local currency |
| 7 | Monetization: affiliate links, ads or subscription | Affiliate links only |

## Vercel constraints (serverless NestJS)

- **No long-lived workers or in-memory state.** Any cache, lock or queue lives in Redis. Request coalescing must use a Redis lock, not an in-process map.
- **Function time limits.** Check the plan's maximum duration against the slowest SerpAPI calls (flights with `deep_search`). Use SerpAPI `async` plus polling if needed.
- **Database connections.** Use the Supabase pooled connection string with Prisma (PgBouncer mode) to avoid exhausting connections. Migrations run from CI with the direct string.
- **Cold starts.** Keep the Nest bootstrap lean and avoid heavy modules.
- **Scheduled work** (price watch) uses Vercel Cron triggering an endpoint, which enqueues work.
- **Region.** Pin the function region next to the Supabase project.

## Cost and risk to watch

- **SerpAPI is billed per search.** Identical searches within 1 hour are served free from SerpAPI's own cache, so we normalize params to hit it. We add our own Redis layer on top. Flights are the most expensive flow because a round trip takes 3 calls.
- **Provider results are not an inventory API.** Prices are indicative and can change by the time the user clicks through. The UI must say so.
- **Scraped sources can change shape.** Parse defensively and keep contract tests against saved fixtures.
