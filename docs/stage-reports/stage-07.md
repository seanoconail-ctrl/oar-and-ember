# STAGE 7 REPORT: day and night, shelter and first tasks

In the Book 2 section 23 format: one heading per report field. Decisions are S7-1 to S7-26 in
`docs/decision-log.md`. Built without waiting on the mockup's or the new sheets' approval (DD-11);
everything for the user's review is listed under **Flagged for review**.

## Implemented
- **The machair and the broch** (`content/zones/zone_sk_machair.plan.json`, generated
  `zone_sk_machair.json`; `src/tools/levels/zones.ts`): a 96 x 40 zone above Wreck Strand sharing
  the island's terrain, with the broch's ring wall (blocking), its court of turf with a trodden patch
  round the fire and a way to the door, worn paths, boulders, heather, sheep and gulls (S7-1 to S7-3,
  S7-22, S7-23).
- **Walking between zones** (`src/sim/land/zoneLinks.ts`, `src/scenes/playView.ts`): off the
  strand's north edge onto the machair and back, with a short fade; people and pickups in the other
  zone are kept aside, and residents walk on between zones out of view (`src/sim/land/path.ts`,
  `src/sim/people/residents.ts`).
- **Beat 2** (`src/sim/narrative/broch.ts`, `content/camp.json`): 6 s after the bow line Hild leads up
  to the broch, waits when left behind, sits by the fire ring and says what is needed; the beat
  completes when the fire is lit and her leg tended. From the next morning she fishes from the rocks
  06:30 to 17:30, and sleeps by the fire (S7-11). The camp's work opens only once at the broch (S7-26).
- **The camp** (`src/sim/home/camp.ts`): sites for the fire, the beds, the shelter, the stores and five
  places along the weed line; tasks to gather driftwood, fish from the shore (with the hand line
  found in the salvage, S7-15), tend a wound, light the fire, cook, and raise the sail shelter, which
  takes the camp from S0 to S1 (the sail roof, beds, hearth, cleared floor and door). The fire burns
  Book 10's fuel and can go out. Meals, the dawn ration, fresh fish and the tutorial guard (S7-5 to
  S7-7, S7-16).
- **Hands-on actions** (`src/sim/simulation.ts`): a task plants the feet and plays its work loop for
  2.5 s; a press near the mark (the timing ring) adds up to the timing bonus, and a missed press never
  ruins the task; its game minutes then pass, and its small stamina is spent (S7-8).
- **Day and night** (`src/scenes/lightPhase.ts`, `src/scenes/zoneScene.ts`, `assets/art/render.json`):
  the visible day clock (sun, sun on the horizon, moon; "Day 1, spring 16:04"); the night grade; the
  fire's flames, smoke, sparks, moths and its flickering warm pool, larger at dusk and night (S7-25).
- **Sleep and the morning report** (`src/sim/simulation.ts`, `src/scenes/camp.ts`): a bed after 18:00;
  the steerer lies down for 3 s, the night passes under a fade, and the steerer wakes at 06:00 to the
  report, written in sentences (sleep, food, the fire, driftwood, the shelter, wounds, Hild's plan,
  the tide, threats); J reopens it, Escape closes it (S7-13, S7-14).
- **Stamina and condition** (`src/sim/home/stamina.ts`, Book 2 section 24): the bar's length is its
  maximum, cut by named reasons (cold, hunger, starving, wounds, tired, exhausted, a hard day's work)
  with an icon each in its groove and the names beneath; lifted by a hot meal, an hour by a lit fire
  and a full rest; drained by running, heavy carrying and waist wading, and an empty bar winds the
  steerer (S7-9, S7-10, S7-17).
- **World state version 5** (`src/sim/world.ts`, `src/persist/save.ts`) with a migration from 4;
  golden save 5 is new (`tests/golden-saves/golden-05.json`, `npm run golden`); golden saves 1 to 4 are
  frozen and load through the chain (S7-18).
- **Home audio** (`src/audio/synth/home.ts`, `src/audio/placeMusic.ts`, `src/audio/music.ts`,
  `content/audio.json`): the hearth theme by time of day in turns with ambience only (90 s of ambience,
  then 150 s of music: 37.5% ambience only), the first fire bringing it in; the Skarvholm theme away
  from the steading; the steading's life by time of day; the fire's crackle by distance; work, fire,
  timing and sleep sounds, all captioned. The sound test page has a Home section (S7-20).
- **Art** (see Art check): the broch as a banded building sheet (S7-12), its S1 floor, both sails with
  ripples, wall-head turf (S7-24), the camp's props and woodpile, the fire, sheep, the people's work
  loops and sleep, the stamina bar, reason icons, the day clock and the timing ring.
- **Test and capture hooks** `?camp=broch&time=..&fire=lit&tended=1&stage=S1&wood=N&line=1&at=x,y`
  (S7-21); `src/tools/play/campBot.ts`; the capture's Stage 7 views (`src/tools/art/capture.ts`).
- **Book 10** (`docs/10_balance_sheet.md`, `content/balance.json` regenerated): "Work and the wreck
  camp", "Hands-on action", the "Light a fire" row, `startingSkills` and "Untended" wounds (S7-4 to
  S7-8, S7-10).

## Tests
- `npm run lint`: ESLint clean; Prettier clean; content lint clean (453 strings, 2 zone maps, 427
  registered IDs); art lint clean (57 sheets, 6840 frames, 0 placeholders).
- `npm test`: 34 files, **414 passed, 0 failed**. New: `tests/unit/home.test.ts` (33),
  `tests/unit/workLoops.test.ts` (4), `tests/unit/homeAudio.test.ts` (8); updated for Stage 7:
  `audio.test.ts` (the island theme is `MUS_ISLAND_EXPLORE`; home ambience by part of the day),
  `art.test.ts` (new sheets; the steerer atlas now 64 rows; the stale-art check's timeout raised to
  30 s, as it now regenerates more sheets), `strandArt.test.ts` (the work loop states),
  `saves.test.ts` (schema 5, golden 5), `calendar.test.ts` (the collapse as a reason).
- `npm run build`: passes.
- `npm run test:browser -- --project=chromium`: **37 passed, 0 failed**, including the new
  `tests/browser/stage07.spec.ts` (5 tests, all stepped with `oeStep` from the camp hooks). No
  existing browser spec was edited.
- `npm run audio:render`: every item rendered (66), the loudest peak 0.81, nothing clips.
- CI results: see the run for this commit.

## Gate checks
1. **No starvation or spoilage before tutorialComplete: PASS.** `home.test.ts` check 1: eight days on
   five rations, no fish spoiled, no short day, no STARVING; once `tutorialComplete` is set, fresh fish
   spoils after Book 10's days and short days are counted.
2. **Sleeping after 18:00 advances to dawn and produces a morning report in sentences: PASS.**
   `home.test.ts` check 2 (06:00 the next day; TIRED after a short night, EXHAUSTED after a collapse);
   `stage07.spec.ts` sleeps from 20:00 to day 2 at 06:xx and checks every report line is a sentence.
3. **The player's action adds output at their skill; missed timing never ruins a task: PASS.**
   `home.test.ts` check 3: a good press gives base x (1 + timing bonus), late and no press give the
   base exactly; a higher skill gives more.
4. **Each task takes its Book 10 time and only its Book 10 stamina, and plays its work loop for the
   steerer and residents: PASS.** `home.test.ts` check 4 (every task's minutes and stamina; never
   empties the bar; hours count towards a hard day); `workLoops.test.ts` (the steerer's gather and fish
   loops and Hild's fish loop, frames advancing; the sleeper; the fire); `stage07.spec.ts` (lighting
   the fire: the kneel loop's frames advance and the clock moves on 10 minutes or more).
5. **The stamina bar is its maximum, lowered by named reasons by their Book 10 amounts, restored by a
   hot meal, a fire and rest; sprint, waist wading and heavy carrying drain: PASS.** `home.test.ts`
   check 5; `stage07.spec.ts` (the bar shortened and "Cold" named on screen).
6. **The Book 7 terrain art standard: PASS.** Motion with the camera still: Wreck Strand 93.8%, the
   broch by day 82.8%, by night with the fire 85.9%, at S1 by day 80.6% (threshold 80%);
   `tests/unit/standard.test.ts` covers the machair zone's terrain (straight edges, variants, grass).
7. **Sounds meet the Book 11 audio standard, with captions; listened back: PASS.**
   `homeAudio.test.ts` (at least a third of home time ambience only over two hours with the day
   turning; bar-line changes; every home sound generated and captioned; ambience for all four parts
   of the day). Levels (`artifacts/audio/levels.json`, peak / RMS): hearth theme dawn 0.41 / 0.092,
   day 0.44 / 0.094, dusk 0.41 / 0.071, night 0.36 / 0.070; the steading's life with the wind bed
   0.29 / 0.040 for each part of the day (the calls stand 3 to 9 times above the bed in their bands);
   the fire's crackle 0.34 / 0.087; effects from 0.10 / 0.012 (sleep) to 0.33 / 0.034 (mallet), with
   driftwood 0.21, cast 0.18, catch 0.17, tending 0.18, cooking 0.16, lighting 0.22, feeding 0.16, the
   fire going out 0.15 and a good stroke 0.13 (the splash and pickup sit at 0.19 and 0.12).

## Art check
- **Capture** `docs/art/captures/stage-07/` (`npm run capture -- stage-07`): the strand still, its
  motion map and the reference beside it, as at Stage 6; the broch by day, by night and at S1 (1x and
  2x) with motion maps; `compare-day.png` and `compare-night.png` (the approved mockup beside the
  capture at 2x); `broch.mp4`/`.gif` (10 s: walking to the ring and lighting it, pressing on the
  mark) and `sleep.mp4`/`.gif` (8.2 s: lying down, the night, the report). 12 MB in all.
- **Against the mockup** (`docs/art/mockups/stage-07/`): the same broch (ray-cast from the mockup's
  geometry), lean-to, salvage, fire ring, turf court with its trodden patch, wall-head turf, sheep
  outside, and by night the warm pool on the floor and smoke lit from below. Differences: the game
  frames the broch centred on the steerer, so the Kelda stream is out of view; no long cast shadow of
  the tower; fewer stones in the turf; the mockup's gulls' shadows and wheatear are not in; cloud
  shadows are the game's, fainter than the mockup's (the mockup is 99.8% with its clouds, 92.7% frozen;
  the game 82.8%).
- **Against `docs/art/reference/`**: the strand unchanged apart from three more driftwood props and a
  little more sway in its plants (S7-23), 93.8% motion (Stage 6: 92.7%).
- **Sheets for review** (`docs/art/stage-07/`): the work loops and sleep for both steerer bodies, the
  heavy build and Hild at 1x and 4x with GIFs; the sheep and the fire at 1x and 4x with GIFs. Inspected:
  readable at 1x; Hild's kneel reads weakly (flagged).
- **Placeholders:** none.

## Balance
- Added to Book 10 and regenerated: `workerDay` 8 game hours, `wreckStores` 6 rd, `campFuel` 0,
  `fireLight` 1 load, `tutorialGuard`, `actionSeconds` 2.5, `timingMark` 1.5, `timingWindow` 0.3,
  "Light a fire" 10 minutes and 0 stamina, `startingSkills`, "Untended" (S7-4 to S7-8, S7-10).
- Used as written: section 03 rates (driftwood by season, fishing from the shore, fuel, food per
  person), section 06 stamina (base, regeneration, drains, capacity by reason, recovery), section 08
  wounds, section 09 task times and stamina, `playerTimingBonus`, fresh fish.
- Presentation, not tuning, kept out of Book 10: the music's play and rest seconds and the fire's
  hearing distances (`content/audio.json`, S7-20); the fire's light (`assets/art/render.json`, S7-25);
  the plants' calm sway and the steading's sward (S7-23).

## Deviations
S7-1 to S7-26 (`docs/decision-log.md`, "Stage 7 (day and night, shelter and first tasks)").

## Known issues
- **Minor:** Hild fishes her spot in her hours whatever the tide (v0; Stage 8's schedules).
- **Minor:** the strand's own plants sway a little more than at Stage 6 (S7-23 is shared).
- **Minor:** at S1 the motion is just over the line (80.6%); the cleared floor and the south wall are
  the still parts.
- **Minor:** a person standing in the broch's doorway is seen through two or three cut-away bands,
  so they read half-dithered.
- **Minor:** the sheep's north and south facings reuse the side views.
- **Cosmetic:** the steading's life renders share one level because the wind bed dominates the RMS.

## Flagged for review
- The new art (S7-19, S7-24): work loops and sleep (Hild's kneel is weak), sheep, the broch, the sails'
  ripples, the camp's props, the fire, the HUD's clock, stamina bar, reason icons and timing ring.
- The Book 10 additions (S7-4 to S7-8, S7-10) and the steerer waking cold (S7-9).
- The machair as its own zone with a fade between zones (S7-1) and the broch's place in it (S7-3).
- Hild's v0 day (S7-11) and the camp's work opening only at the broch (S7-26).
- The home music schedule (90 s rest, 150 s music) and the Skarvholm theme moving to
  `MUS_ISLAND_EXPLORE` (S7-20).
- The thicker sward and stronger calm sway, which also touch the approved strand (S7-23).

## Next stage ready
YES. Stage 8 can build on the camp (sites, tasks, the dawn ration and the report), the residents'
walking between zones and Hild's v0 day.
