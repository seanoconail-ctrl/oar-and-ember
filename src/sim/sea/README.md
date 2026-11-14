# sim/sea

The sea-map graph, watch-by-watch travel, weather, tide gates, stores and encounters (Book 2
section 09).

- **May depend on:** `core`, `content`, the world state's types, `sim/calendar`, `sim/ship`
  (`deriveStats`) and `sim/ledger` (facts).
- **Built in:** Stage 13 (decisions S13-1 to S13-19).

| File | What it holds |
|---|---|
| `types.ts` | Every type the sea-map screen, the wreck scene and audio read or send |
| `state.ts` | The sea at rest (a new campaign's, and the version 15 migration's) |
| `context.ts` | Content and Book 10 numbers, built once (`seaContext`) |
| `travel.ts` | Bearing, point of sail, effective speed, a leg's minutes |
| `weather.ts` | The daily draw, the forecast, named storms, calm windows |
| `plot.ts` | The quickest known course, with refusals in words |
| `encounters.ts` | Entry filters and the governor |
| `voyage.ts` | Setting out, per-watch resolution, holds, the choice, arrival, stores, home |
| `handoff.ts` | The handoff contract for on-foot scenes and sea battles |
