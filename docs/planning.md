# Wayfinder: Planning by Quarter

Status: **draft for review.** The dates assume work starts in late November 2026. Scope per quarter is a proposal, so move items freely. Each quarter ends with something a user can actually try.

## Q4 2026 (Nov–Dec): Foundations

**Goal:** a working skeleton, and proof that the SerpAPI data is good enough.

- Monorepo (pnpm + Turborepo), CI, lint and type-check
- Expo app shell with navigation, theme and auth screens
- NestJS app with the `provider`, `geo` and `auth` modules, plus a health check
- `SerpApiClient` with a Redis cache, request coalescing and credit logging
- Decide the open items in `tech-stack.md`
- **Data spike:** run real queries for each engine, save the responses as fixtures, and confirm the fields we need
- Design: brand, a design system and key screens (use the installed design plugins)

**Exit:** the app signs in and calls the API, and the API returns a cached `geo/suggest` result.

## Q1 2027: Flights

**Goal:** a usable Skyscanner-style flight search.

- Airport and city autocomplete
- Search form (one-way and round trip, passengers, class)
- Results list: best vs. other flights, duration, stops, layovers, airline, emissions, price insights
- Filters and sort (stops, airlines, times, price)
- Round-trip flow: outbound, then return, then booking options
- Handoff: open the chosen provider's link and record the click
- Flexible dates: price calendar
- Saved searches

**Exit:** a user can go from "TLV to Paris on a date" to the provider's booking page.

## Q2 2027: Stays and maps

**Goal:** a Booking-style hotel search that works on a map.

- Hotel search (destination, dates, guests) with a list and a map toggle
- Map with price pins, clustering and a bottom sheet of cards
- Filters: price, stars, rating, amenities, free cancellation
- Property detail: photos, amenities, prices by provider, reviews, nearby places
- Price calendar for flexible dates
- Handoff to provider
- Second source (`booking` engine) if Google Hotels coverage is weak
- Favorites

**Exit:** a user can compare stays on a map and click through to book.

## Q3 2027: Attractions and trips

**Goal:** the Tripadvisor part, and the thing that ties all three together.

- Destination page: top attractions, restaurants and tours
- Attraction detail: rating, reviews, hours, map location
- **Trips:** create a trip, then add a flight, a stay and attractions
- Day-by-day itinerary with a drag-to-reorder timeline
- Per-day map with routes between stops (`google_maps_directions`)
- Trip overview: dates, cost estimate (flagged as indicative) and checklist
- Offline view of a saved trip

**Exit:** a user can build a complete trip end to end inside the app.

## Q4 2027: Polish, scale and launch

**Goal:** a store-ready product with controlled costs.

- Performance pass (list virtualization, image caching, startup time)
- Accessibility, localization and multi-currency
- Price-watch alerts and push notifications (Vercel Cron + queue)
- Cost controls: per-user quotas, smarter caching and a SerpAPI plan review
- Analytics and funnels, including handoff click-through
- Legal: privacy policy, terms, data-source attribution and affiliate disclosure
- Beta (TestFlight and Play internal), then store submission

**Exit:** public launch.

## Later / ideas

Shareable trips and collaborative planning, an AI trip-planner using the saved data, multi-city flights, a web app, "explore anywhere" inspiration (`google_travel_explore`), and a vacation-rentals source (`airbnb`).

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| SerpAPI cost grows faster than usage | Margin | Canonical-param caching, quotas and a credit dashboard from Q4 2026 |
| Result fields differ from what we assume | Rework | Data spike in Q4 2026, fixtures and mapper tests |
| Provider terms restrict outbound or affiliate use | Revenue | Legal review before Q4 2027, with plain links as the fallback |
| Slow flight responses hurt UX | Retention | Skeletons, prefetch, cache warming for popular routes |
| Prices shown are stale at click-through | Trust | "As of" timestamps and clear wording |
| Scope creep into booking and payments | Timeline | Stated non-goal; revisit only after launch |

## How we'll work

Each feature starts with a short spec, is built with tests, and is reviewed before merge. Update this file at the end of each quarter with what shipped and what slipped.
