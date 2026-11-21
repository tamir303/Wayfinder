# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

pnpm + Turborepo monorepo on branch `feat/foundation`: `apps/api` (NestJS, Prisma, Redis cache, Supabase JWT guard), `apps/mobile` (Expo SDK 58, Expo Router, NativeWind v4, TanStack Query), `packages/shared` (Zod contracts, error codes), `packages/config`. The only built slice is airport autocomplete (`GET /geo/suggest`, `google_flights_autocomplete`). Spec and plan: `docs/superpowers/`.

Commands (repo root): `pnpm lint`, `pnpm typecheck`, `pnpm test` (all via Turbo). API: `pnpm --filter @wayfinder/api dev`. Mobile: `pnpm --filter @wayfinder/mobile dev` (needs a dev client build). DB migrations: `pnpm --filter @wayfinder/api exec prisma migrate deploy` (not `migrate dev`: the shadow DB lacks `auth.users`). Env: `apps/api/.env` and `apps/mobile/.env` are gitignored, see `.env.example`.

Mobile environments (`apps/mobile`, set by `EXPO_PUBLIC_APP_ENV` through `scripts/with-env.mjs`): `dev` = mock data only, no network, mock sign-in (any email, code 123456); `staging` = real API, debug logs, nothing redacted; `prod` = real API, info logs, tokens/emails redacted, web session encrypted at rest. Run with `pnpm --filter @wayfinder/mobile web | web:staging | web:prod` (staging/prod read `.env.staging` / `.env.prod`, copy from the `.example` files). Config lives in `src/config/app-config.ts`, mocks in `src/lib/mock/`. Test the web build with the Playwright MCP tools: export with `pnpm --filter @wayfinder/mobile export:web`, then serve `dist` with `python -m http.server --directory dist` run from outside `dist`.

Localization: all UI strings live in `apps/mobile/src/i18n/{en,he}.ts` (`he` is typed against `en`, so keys can't drift); use `useTranslation().t`, never hardcode text. Hebrew is RTL (web via `document.dir`, native via `I18nManager`, needs an app restart on first switch); use `arrow()` for direction-aware arrows. Playwright runs `*.he.spec.ts` in a `he-IL` project. Add every new string to both files.

Gotchas: the SerpAPI client (`apps/api/src/provider/serpapi.client.ts`) reserves a per-user daily credit before each uncached call and refunds on failure; all SerpAPI traffic goes through it. Jest mock factories may only reference `mock`-prefixed variables. Testing Library v14 `renderHook`, `rerender` and `act` are async.

## Product

Wayfinder is a React Native (Expo) app with a NestJS API. It combines flight search (Skyscanner-style), stays on a map (Booking-style) and attraction/trip planning (Tripadvisor-style). It **never processes payments**: "booking" is an outbound link to the provider. All data comes from SerpAPI, called server-side only. The app talks to our normalized API, never to raw SerpAPI.

Planning docs (drafts, with open decisions flagged): `docs/tech-stack.md`, `docs/architecture.md`, `docs/planning.md` (by quarter).

SerpAPI usage rules and engine map: @.claude/serpapi-guide.md. Follow it before making any SerpAPI call, because each uncached search costs a credit.

## Claude Code setup

- `.mcp.json` defines the `serpapi` HTTP MCP server (tools: `search`, `extract`, `search_dashboard`, `search_table`). The URL embeds an access token, so keep this file out of version control, or move the URL to an env var.
- `.claude/settings.json` approves only the `serpapi` project MCP server (`enableAllProjectMcpServers` is false) and pins the enabled plugins: superpowers, frontend-design, context7, typescript-lsp, claude-code-setup, supabase, figma, the React/React Native skills pack, and ponytail.
- SerpAPI engine names come from the `serpapi://engines` MCP resource, and per-engine parameters from `serpapi://engines/{engine_name}`.
