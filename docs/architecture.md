# Wayfinder: Architecture

Status: **draft for review.** Companion to `tech-stack.md`. The SerpAPI engine details are in `.claude/serpapi-guide.md`.

## System overview

```
┌──────────────┐   HTTPS/JSON    ┌───────────────────────────────┐        ┌────────────┐
│ Expo app     │ ──────────────▶ │ NestJS API                    │ ─────▶ │ SerpAPI    │
│ (RN, TS)     │ ◀────────────── │  flights | hotels | places    │ ◀───── │ (REST)     │
└──────────────┘  normalized DTO │  trips | auth | provider      │        └────────────┘
                                 └──────┬───────────────┬────────┘
                                        │               │
                                   ┌────▼────┐     ┌────▼─────┐
                                   │ Postgres│     │  Redis   │
                                   │ (users, │     │ (cache,  │
                                   │  trips) │     │  queues) │
                                   └─────────┘     └──────────┘
```

The app never calls SerpAPI. The API owns the key, caching, normalization and rate limiting.

## NestJS modules

| Module | Responsibility |
|---|---|
| `provider` | The only code that imports SerpAPI. A `SerpApiClient` with a cache, retry and credit accounting. Exposes typed methods like `searchFlights()`. |
| `flights` | Search, round-trip leg selection, booking options, price calendar |
| `hotels` | Search, property details, reviews, photos, price calendar |
| `places` | Attractions and restaurants (Tripadvisor), map search and place details (Google Maps), directions |
| `geo` | Autocomplete for airports and cities, and resolving a free-text destination into an airport code, coordinates and a Tripadvisor query |
| `trips` | CRUD for a user's trip: days, saved flights, saved hotel, saved attractions |
| `auth` | JWT guard, user profile |
| `handoff` | Builds the outbound "book this" link and records the click |

Rule: feature modules depend on `provider` and `geo`. They never call each other's internals.

## The provider layer

All SerpAPI traffic goes through one client.

```
feature service
   │  searchFlights(params: FlightQuery)
   ▼
SerpApiClient
   1. normalize params (sort keys, uppercase IATA, trim, fixed defaults)
   2. cache key = engine + canonical params
   3. Redis hit?  → return
   4. in-flight request with same key?  → wait on it (coalescing via a Redis lock, since Vercel is serverless)
   5. call SerpAPI, record credit use
   6. map raw JSON → our DTO (mapper per engine)
   7. store in Redis with a TTL by data type
```

Why normalize: SerpAPI's own cache only matches **identical** params for 1 hour, and cached hits are free. Canonical params raise the hit rate.

Suggested Redis TTLs (tune later):

| Data | TTL |
|---|---|
| Autocomplete | 24 h |
| Flights and hotel prices | 15–30 min (shorter than SerpAPI's 1 h, because users compare prices) |
| Place and attraction details | 24 h |
| Reviews and photos | 7 d |
| Directions | 1 h |

## Core user flows

### 1. Flights (Skyscanner-style)

```
Autocomplete origin/destination ─▶ google_flights_autocomplete
Search (dates, pax, class)      ─▶ google_flights               → best + other flights, price insights
Round trip: pick outbound       ─▶ google_flights(departure_token) → return flights
Pick final itinerary            ─▶ google_flights(booking_token)   → booking options (airline / OTAs)
User taps an option             ─▶ handoff module → open provider link
Flexible dates                  ─▶ google_flights_calendar / google_travel_explore
```

A round trip costs about 3 searches. The UI should fetch the return leg only after the outbound is chosen.

### 2. Stays (Booking-style)

```
Search (destination, dates, guests) ─▶ google_hotels     → list with prices, rating, GPS
Map view                            ─▶ the same results, plotted from GPS coordinates
Detail                              ─▶ google_hotels(property_token) → prices by provider, amenities, nearby
Reviews / photos                    ─▶ google_hotels_reviews / google_hotels_photos
Price calendar                      ─▶ google_hotels_price_calendar
Close the deal                      ─▶ handoff → provider link from the detail response
```

`booking` (Booking.com) is available as a second source if Google Hotels coverage is thin. The `hotels` module hides which engine answered.

### 3. Attractions and planning (Tripadvisor-style)

```
Destination        ─▶ geo resolves it to a place
Things to do       ─▶ tripadvisor (ssrc=A) near the destination
Restaurants        ─▶ tripadvisor (ssrc=r)
Detail and reviews ─▶ tripadvisor_place / tripadvisor_reviews
Map pins           ─▶ google_maps (search or place) for coordinates and hours
Day-to-day routing ─▶ google_maps_directions between consecutive stops
Add to trip        ─▶ trips module (stored in Postgres)
```

### 4. The trip (what ties it together)

A `Trip` has a destination, a date range, and ordered `TripItem`s placed on days. Items are a saved flight, a stay, or an attraction. The app shows the trip as a timeline plus a map of the day.

## Data model (first cut)

```
User(id, email, home_airport, currency, locale)
Trip(id, user_id, title, destination, start_date, end_date)
TripDay(id, trip_id, date)
TripItem(id, trip_id, day_id?, type: flight|stay|attraction|note,
         provider, provider_ref, snapshot JSONB, sort_order)
HandoffClick(id, user_id, trip_item_id?, provider, url, created_at)
SearchLog(id, user_id?, engine, cache_hit, credits, created_at)
```

`snapshot` stores the normalized details at save time. The provider data can disappear or change later, and the saved trip must still render. Prices in a snapshot are labelled "as of {date}".

## API shape (sketch)

```
GET  /geo/suggest?q=...&kind=airport|city
GET  /flights/search?from&to&date&return&adults&class
GET  /flights/return?token=...
GET  /flights/booking-options?token=...
GET  /hotels/search?q&checkIn&checkOut&adults
GET  /hotels/:propertyToken
GET  /places/attractions?destination&category
GET  /places/:id
GET  /places/route?from&to&mode
CRUD /trips, /trips/:id/items
POST /handoff   → { url }
```

Responses are our DTOs from `packages/shared`, never raw SerpAPI JSON.

## Cross-cutting concerns

- **Latency:** Flight searches can take several seconds. Show skeletons and let TanStack Query keep prior results while refetching. For slow searches, consider SerpAPI `async` plus polling in a later phase.
- **Failures:** The provider layer maps SerpAPI errors to a small set of ours: `NO_RESULTS`, `RATE_LIMITED`, `PROVIDER_DOWN`, `BAD_QUERY`. The app has one empty and error state per set.
- **Budgeting:** Log credits per request in `SearchLog`. A per-user and global daily cap stops runaway cost.
- **Secrets:** Env vars only. Never log the SerpAPI key or the full MCP URL.
- **Privacy:** Don't forward user identity (email, name) to SerpAPI. Send only the query.
- **Compliance:** Present prices as indicative. Show the data source. Check SerpAPI and each provider's terms before launch for the outbound-link and affiliate use.
- **Testing:** Record real SerpAPI responses as fixtures, and unit-test each mapper against them. Run one small live smoke test in CI nightly.

## Out of scope for v1

Payments, in-app booking, ticketing, user-generated reviews, multi-city flights, and a web app.
