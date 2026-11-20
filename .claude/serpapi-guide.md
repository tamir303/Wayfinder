# SerpAPI quick guide (for Claude)

Use this to run the **fewest, cheapest** SerpAPI calls when working on Wayfinder. Every uncached search costs a credit.

## Rules of thumb

1. **Don't browse for data you can read from the docs.** Engine parameters are in the MCP resource `serpapi://engines/<engine>`. Read it with `ReadMcpResourceTool` (server `serpapi`) only when a param is unclear. The big tables (`gl`, `hl`, `currency`) are noise.
2. **Prefer** `mcp__serpapi__search` with `mode: "compact"` and, where useful, `json_restrictor` to keep only needed fields.
3. **Identical params within 1 hour are free** (SerpAPI cache). Re-run the exact same params, not a "similar" query. Use `no_cache: true` only when freshness is the point.
4. **One call, then save it.** When a response is needed as a test fixture, write it to `apps/api/test/fixtures/<engine>/<name>.json` and reuse it instead of calling again.
5. Use `output: "md"` to just read a result. Use JSON when the shape matters for a mapper.
6. `search_dashboard` and `search_table` render UI. Don't use them when building code.
7. Never print or commit the MCP URL (it embeds a token).

## Engine map (what Wayfinder needs)

| Need | Engine | Key params |
|---|---|---|
| Airport/city suggest (flights) | `google_flights_autocomplete` | `q`, `exclude_regions` |
| Flight search | `google_flights` | `departure_id`, `arrival_id`, `outbound_date`, `return_date`, `type` (1 round, 2 one-way, 3 multi), `adults`, `travel_class`, `stops`, `sort_by`, `currency`, `gl`, `hl` |
| Return leg of a round trip | `google_flights` | `departure_token` from the outbound result |
| Booking options for a chosen flight | `google_flights` | `booking_token` (dates and filters are ignored) |
| Flexible-date grid | `google_flights_calendar` | read the engine doc first |
| "Anywhere" inspiration | `google_travel_explore` | read the engine doc first |
| Hotel suggest | `google_hotels_autocomplete` | |
| Hotel search | `google_hotels` | `q`, `check_in_date`, `check_out_date` (all three required), `adults`, `children`, `children_ages`, `sort_by` (3 price, 8 rating, 13 reviews), `min_price`, `max_price`, `rating`, `hotel_class`, `free_cancellation`, `next_page_token` |
| Hotel detail | `google_hotels` | `property_token` (then `q` is ignored) |
| Hotel reviews and photos | `google_hotels_reviews`, `google_hotels_photos` | property token |
| Hotel price calendar | `google_hotels_price_calendar` | |
| Alt hotel source | `booking` | `q`, `check_in_date`, `check_out_date`, `adults`, `rooms`, `sort_by`, `limit` (max 100), `offset` |
| Attractions, restaurants | `tripadvisor` | `q`, `ssrc` (`A` things to do, `r` restaurants, `h` hotels, `g` destinations, `a` all), `lat`/`lon`, `limit`, `offset` |
| Attraction detail and reviews | `tripadvisor_place`, `tripadvisor_reviews` | place id from the search result |
| Map search, place detail | `google_maps` | `type` (`search`/`place`), `q`, `ll` (`@lat,lon,14z`), `place_id`, `start` |
| Map autocomplete | `google_maps_autocomplete` | |
| Routing between stops | `google_maps_directions` | read the engine doc first |
| Vacation rentals (later) | `airbnb` | |

## Call recipes

**Autocomplete (airport):**
`{"engine":"google_flights_autocomplete","q":"tel aviv","hl":"en"}`

**One-way flight:**
`{"engine":"google_flights","departure_id":"TLV","arrival_id":"CDG","outbound_date":"2027-03-10","type":"2","currency":"USD","hl":"en"}`

**Round trip:** `type: "1"` with `return_date`. Then, for the return leg, call again with the same params plus `departure_token` from the chosen outbound. Then call with `booking_token` for provider options. About 3 calls per itinerary.

**Hotels:**
`{"engine":"google_hotels","q":"Paris hotels","check_in_date":"2027-03-10","check_out_date":"2027-03-14","adults":2,"currency":"USD","gl":"us","hl":"en"}`

**Attractions:**
`{"engine":"tripadvisor","q":"Paris","ssrc":"A","limit":30}`

**Map places:**
`{"engine":"google_maps","type":"search","q":"museums","ll":"@48.8566,2.3522,13z"}`

## Gotchas

- Flights: dates must be `YYYY-MM-DD` and in the future. `type: "1"` needs `return_date`, and `type: "2"` forbids it. `include_airlines` and `exclude_airlines` can't be combined. `booking_token` and `departure_token` can't be combined.
- Hotels: `check_in_date` and `check_out_date` are required unless `property_token` is used.
- Booking.com engine: without dates there are no prices. The stay is capped at 90 nights.
- Google Maps: `ll`, `location`, and `lat`/`lon` are mutually exclusive. `place_id` and `data_cid` can't be combined. Page with `start` in steps of 20, and stop around 100.
- Tripadvisor: `ssrc=v` (vacation rentals) is discontinued. `offset` and `lat`/`lon` may not work for every query.
- Response field names (`best_flights`, `other_flights`, `properties`, and so on) are **not** in the engine resources. Confirm them from the first real response and record them in the mapper and fixtures.

## Workflow when asked to "try a query"

1. Pick the engine from the table above.
2. If a param is unclear, read `serpapi://engines/<engine>` once.
3. Make **one** call with `mode: "compact"`.
4. Summarize the useful fields. If it will become a fixture, save it.
5. Report the credit-relevant facts: engine, whether params were canonical, and whether `no_cache` was set.
