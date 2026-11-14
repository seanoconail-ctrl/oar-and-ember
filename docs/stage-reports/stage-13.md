# STAGE 13 REPORT: sea-map travel and voyage events

In the Book 2 section 23 format: one heading per report field, with the measures the stage's checks
need (motion, audio, the frame budget). Decisions are S13-1 to S13-88 in `docs/decision-log.md`.
Built in four work packages and an integration pass, run without waiting for approvals under DH-2:
the new place (the reef of Sgeir Dhubh), the new people (Fínán, Derbáil and Ívar) and the new chart
art were made and reviewed against the standard first, logged and **flagged for the user's review**
rather than waited on. Stage 13 is not a build gate; the user asked for Stages 13 to 16 to run on,
stopping after Stage 16 for a playtest of the first raid.

## Implemented
- **The sea's simulation** (package A; `src/sim/sea/`, `content/sea.json`,
  `src/content/seaBalance.ts`, `seaSchema.ts`; S13-1 to S13-19):
  - the sea map from Book 4 with Book 10's times: ten places, the Cauldron and Blue Men's Sound as
    hazard nodes, fourteen `SEA_` edges, four `ENC_` tables;
  - plotting the quickest known course, refused in words when it cannot be sailed (`SEA_PLOT`);
  - per-watch resolution under 2 ms (`SEA_WATCH`): speed by point of sail or the oars, stores
    drained for everyone aboard, storm damage and wear, discovery of routes and places;
  - weather drawn a day at a time on its own stream: wind, strength, visibility, the forecast,
    named storms, the Cailleach's washing and winter's calm windows;
  - the Cauldron's tide gate (slack water only), winter closure, the home's low-detail step while
    the ship is away;
  - the governor (a third of legs eventful, supernatural about once in three or four voyages);
  - the one sea-map choice ("weather rising: press on or shelter", `SEA_CHOOSE`);
  - handoffs to on-foot scenes and the Carrick landing stub (`SEA_HANDOFF_RETURN`, `SEA_TURN_BACK`,
    `DEV_SEA_CHART`); the Carrick raid gate started at departure.
  - The world state is at **version 15**; **golden save 13** is the chapter run's end with a voyage
    to Carrick set out.
- **The sea-map screen** (package B; `src/scenes/seaVoyage.ts`, `seaChart.ts`,
  `src/ui/seaPanels.ts`, `assets/art/authoring/stage13_seamap.py`; S13-20 to S13-36):
  - plotting at home (the map key) and under way;
  - the chart in eight lights (gusts, storm, lightning, night, fog) with real moving water, cloud
    shadows, rain and fog;
  - the painted routes and place pictograms, and the weather cartouche;
  - the token redrawn in eight headings with its wake;
  - the choice panel, the Carrick landing stub, the developer menu's routes, and the play view's
    hook.
- **The wreck with survivors** (package C; `src/sim/sea/wreck.ts`, `src/scenes/seaWreck.ts`,
  `content/wreck.json`, `zone_sea_wreck`, `docs/levels/sea_wreck_tiles.txt`, the authoring scripts
  `stage13_wreck_art.py` and `stage13_wreck_people.py`; S13-40 to S13-59):
  - the *Faoileán* broken on Sgeir Dhubh, with its reveal (Conn mac Colla and the Carrick iron);
  - three adult survivors with sheets, idles and voices;
  - Hild's four answers at the boat's side, and their consequences as facts and deeds;
  - the reef drawn tile for tile from its Book 9 grid, with its mockup.
- **The sea's audio** (package D; `src/audio/seaAudio.ts`, `src/audio/synth/sea.ts`,
  `content/music/sea.json`; S13-60 to S13-74):
  - three sea pieces (calm, wind, storm), D Aeolian, chosen by the weather and silent in fog;
  - the sea's bed;
  - the sail and hull sounds;
  - the wreck's bed, timber and cries;
  - the survivors' voices;
  - captions.
- **The integration pass** (S13-80 to S13-88):
  - **the wreck runs inside the simulation.** It begins at the handoff, is played by `INTERACT`,
    `INTERACT_AT` and `TALK_CHOOSE`, steps each tick, and ends by handing the result back. The scene
    layer is left with presentation and sound only (`src/scenes/seaWreckPlay.ts`). A replay test
    covers it, and Book 2 sections 09 and 21 are updated (S13-80).
  - **the reef's Interact prompt:** "Talk to Fínán" by a survivor and "Back to the boat" at the boat's
    side, from one rule that both the simulation and the play view use. A survivor's words now come
    before lifting them (S13-81).
  - the survivors' look distance is now a Book 10 number (`lookTiles`, S13-82);
  - the checks, the listen-back, the capture, the playtest script's Stage 13 section
    (`docs/playtest/build-1.md`) and this report.

## Tests
- `npm run lint`: **clean.** It covers ESLint, Prettier, the content lint (27 places, 4 hazards,
  13 zones, 39 people, 2,238 strings, 576 registered IDs, the ID lint included) and the art lint
  (172 sheets, 73,239 frames, 0 placeholders).
- `npm test` (load 1.26 at the start):
  - the main run: **79 files, 1,202 tests: 1,201 passed, 1 skipped, 0 failed**. The skipped test is
    the budget test, which is run on its own afterwards.
  - the budget pass (`OE_BUDGET=1`): **1 passed** (its other 7 skipped by design).
- `npm run build`: **builds** (the usual large-chunk warning only).
- `npm run test:browser -- --project=chromium` (load 1.40 at the start, 15.3 min):
  - the main pass: **124 passed, 1 failed**. The failure was this pass's own new assertion. It
    expected the keyboard's prompt where the test had clicked the chart, so the mouse's prompt was
    rightly shown. The assertion was corrected and the test run again: **1 passed** (S13-87).
  - the budget pass: **2 passed, 1 failed**. The broch read 6.08 ms against its 5.5 ms limit, as
    known since DH-161 (see "Frame budget"). The strand read 3.44 ms and the cold open 2.95 ms.
- WebKit cannot be downloaded here; CI runs Chromium and WebKit, and both block publishing. Firefox
  is not tested (BR-9).
- No probe or scratch tests are left in the tree. The comparison worktree of cbcc97b lived in the
  session's scratchpad and has been removed.

## Gate checks
| # | Check | Result | Tests (file: test) |
|---|---|---|---|
| 1 | Travel times are deterministic and match Book 10 | **PASS** | `tests/unit/sea.test.ts`, "Stage 13 check 1: travel times are deterministic and match Book 10": "the T1 boat from Skarvholm to Carrick at every point of sail", "the extended hold: oars slower…", "the Cauldron route to Glen Arra saves about two watches on the Crowwick route", "gives identical state hashes from the same seed and commands", "rounds bearings to eight points and points of sail by points off"; `tests/scenario/seaWreckReplay.test.ts`: "replays the voyage with the answer ABOARD / ASHORE / SALVAGE / LEAVE to identical hashes, from the save and from a save on the reef", "a different answer gives a different history" |
| 2 | The Cauldron passable only at slack water | **PASS** | `tests/unit/sea.test.ts`, "Stage 13 check 2: the Cauldron is passable only at slack water": "isSlack is exactly within the window of a tide turn, over a year of watches", "a voyage held at the Cauldron goes on only at slack, from any watch of a year" |
| 3 | The governor keeps two quiet legs per eventful one over 200 voyages | **PASS** | `tests/property/governor.property.test.ts`: "keeps two quiet legs per eventful one over 200 seeded voyages, within Book 10's band" (0.30 to 0.36), "brings a supernatural encounter about once in three or four voyages (a test table)" |
| 4 | Meets the Book 7 standard (section 14); capture compared with the reference | **PASS** | art lint; `tests/unit/standard.test.ts` (3 tests); `tests/unit/seaWreckStandard.test.ts` (4 tests); `tests/unit/seaPanels.test.ts`, "the chart in the voyage's light (Book 7 section 14)": "keeps at least 80% of the chart moving in every weather, and half with reduced motion", "paints every pixel from the chart's authored frames (palette colours only)"; `tests/browser/stage13.spec.ts`, "the Book 7 standard on the chart" (clear 92.7%, fog 99.1%, storm 99.0%; reduced 82.5%); `tests/browser/seaWreck.spec.ts`, "with the camera still at the wreck, at least 80% of the screen keeps moving" (97.6%); `tests/browser/standard.spec.ts` (the strand 95.8%); the capture below |
| 5 | Sounds meet the Book 11 audio standard, with captions: sea music by weather and the interruption's sounds | **PASS** | `tests/unit/seaAudio.test.ts` (18 tests), among them "plays the calm below windFrom, the wind from it, the storm from stormFrom", "falls silent in fog…", "never needs more than 8 voices…", "loops without a seam…", "reefs to press on, groans under storm damage, takes a sea in a storm, and hears the wreck", "captions every sea and wreck sound…", "gives the survivors voices of their own…"; `tests/unit/audioCoverage.test.ts` ("maps every sound event to a cue with a caption that exists", "captions every generated one-shot"); `tests/unit/seaWreckHooks.test.ts` ("plays cries with their direction until the question is answered…"); `tests/browser/sound.spec.ts` ("the sea music loops without a gap in each of its forms, and every sea item sounds", "every item sounds, and nothing clips"); the listen-back below |

**Also tested (the deliverables):**
- **the wreck played through**: `tests/scenario/seaWreck.test.ts`, 9 tests by commands: every
  answer completed and sailed on to Carrick, determinism, the left survivors' fate by the wind,
  berths, and "Not yet".
- **the reef's prompt**: `tests/unit/seaWreckPrompt.test.ts`, 4 tests, plus the browser wreck test.
- **reachability at both tides**: `tests/reachability/seaWreck.test.ts`.
- **the screen's words and layout**: `tests/unit/seaPanels.test.ts`.
- **the stores, the choice, discovery, winter, the forecast and storms**: `tests/unit/sea.test.ts`.
- **the screen in the browser**: `tests/browser/stage13.spec.ts`, 9 tests.

## Frame budget
The broch at night (`pt4world.spec.ts` @budget, limit 5.5 ms; CI read 3.57 ms at cbcc97b). It was
measured interleaved on this software-rendered machine: each build was made for production and
served side by side, and each measure ran alone with one worker (S13-84).

| Build | Runs (ms) | Mean |
|---|---|---|
| This build (d888576 and the integration pass) | 6.11, 6.09, 5.69, 5.30 | 5.80 |
| cbcc97b (before Stage 13) | 6.00, 6.10, 6.34, 5.73 | 6.04 |

**Stage 13 added no per-frame cost on foot:**
- In the play view, the sea screen's `active` check and the reef's prompt rule return at once when
  off the reef.
- In the tick, the simulation's handoff step returns at once when no voyage is under way.

The measure still fails here about as often as at cbcc97b (DH-161). The limit is unchanged.

## Art check
Captures are in `docs/art/captures/stage-13/` (`npm run capture -- stage-13`, run in this pass;
the README lists every file). The images were inspected: `wreck@2x.png`, `compare.png` and
`chart-storm@2x.png`.

**Motion with the camera still** (Book 7 section 14: at least 80% of cells; 50% with reduced
motion):

| View | Capture | Browser spec |
|---|---|---|
| Wreck Strand | 93.9% | 95.8% |
| The chart, clear day | 92.5% | 92.7% |
| The chart in fog | 99.5% | 99.1% |
| The chart in a storm | 99.0% | 99.0% |
| The chart at night | 90.3% | |
| The chart, reduced motion (fog) | 82.1% | 82.5% |
| The reef of Sgeir Dhubh | 96.2% | 97.6% |
| The broch's four views (unchanged) | | 89.1% to 93.6% |

The capture also recorded a 10.0 s clip (`voyage-clip.mp4` and `.gif`) and a stepped chart frame
of 1.21 ms.

**Compared with `docs/art/reference/`** (`wreck-strand-target.png`, `kelda-summer-target.png`):
- **The reef**: its shingle, thrift, grass, wet stone and foam line follow the reference's outline
  weight, three-step shading and palette. The surf breaks on the skerry, and the boat lies afloat
  with its crew at the oars.
- **The chart**: it is a drawn map, so it is compared for the standard's qualities, not its look:
  - every pixel is a palette colour from an authored frame;
  - the sea lightens over the shallows and darkens over the deep;
  - one wind drives the clouds, the gusts, the fog and the rain;
  - storms darken and flash.
- **Below the reference**: the chart's land is painted flat, as a map; the token reads best at 2x.

**Housekeeping:**
- The capture tool rewrites its README, so package B's hand-written comparison was put back with
  the new figures.
- The old mockups were restored from c7ecdb6 (`docs/art/mockups`, `docs/art/stage-06-rework`).
  `docs/art/mockups/stage-13/` (the reef's mockup, 87.8% motion) is new and kept.

**Sheets rendered and inspected by their packages:**
- `docs/art/stage-13/`: the survivors at 1x and 4x with GIFs; the token, the wake, the bolt and
  the chart's lights.
- No placeholders remain (art lint: 0).

## Audio
`npm run audio:render` was run in full on an idle machine (load 1.38 at the start, all 227 items,
no reload). The figures below are RMS over each render, measured against Book 11 sections 09 and
12 (S13-85):

| Item | Level | Standard |
|---|---|---|
| Sea music: calm / wind / storm | -23.8 / -22.6 / -22.1 dBFS | music about -21 to -24 |
| The sea's bed: calm / wind / storm / fog | -23.5 / -20.4 / -19.0 / -24.8 dBFS | ambience about -22; the storm loud by design |
| The wreck's bed | -22.6 dBFS | |
| Sail reef, luff, strain; hull groan | -31.0, -31.7, -31.1; -30.9 dBFS | the launch's effects -27 to -31 |
| The wreck: break / grind / cries | -25.6 / -31.6 / -27.0 dBFS | |
| Voices: Fínán / Derbáil / Ívar | -34.7 / -36.1 / -35.6 dBFS | the scavengers' -32.5 to -35.9 |

- **Peaks**: the sea items peak at no more than 0.66, and the whole render at no more than 0.81.
  Nothing clips.
- **Loops**: the quietest second over each sea piece's 60 s seam is 0.60 to 0.89 of its median,
  above the floor of 0.3.
- **Music by weather and captions**: both are tested (check 5). Fog is silent by design (S13-62).
- These are the same as package D's figures.

## Balance
- **Book 10 section 02** gained the sea's tables from package A: routes and winter, weather, wind
  strength, visibility, storms and calm windows, encounters and the governor, ship stores, the
  slack window and the choice. Package C added "The wreck with survivors". This pass added
  `lookTiles` (6, S13-82).
- **Book 10 section 25** gained `windFrom` (package D).
- `content/balance.json` was regenerated (`npm run balance`).
- No number is written into the code; the chart's purely visual constants are listed in S13-25.

## Deviations
Every decision is in `docs/decision-log.md`, under "2026-11-14, Stage 13". Rows marked **F** are
flagged for the user's review.
- **Package A, the sea's simulation**:
  - S13-1 to S13-4;
  - **S13-5 F** (loading takes up to capacity);
  - **S13-6 F** (winter closure);
  - S13-7 to S13-14;
  - **S13-15 F** (the Hag's Seat point-out and Manannán's Mist not wired);
  - S13-16, S13-17;
  - **S13-18 F** (no sinking);
  - S13-19.
- **Package B, the sea-map screen**:
  - S13-20 to S13-23;
  - **S13-24 F** (rain drawn on storm days);
  - **S13-25 F** (the storm numbers reused);
  - S13-26 to S13-28;
  - **S13-29 F**, superseded by S13-80;
  - S13-30;
  - **S13-31 F** (an edge is sailed from its own end);
  - S13-32 to S13-35;
  - **S13-36 F**, superseded by S13-80 and S13-81.
- **Package C, the wreck**: all of it is flagged for the user, the content above all.
  - S13-40 to S13-59;
  - **especially S13-40** (the scenario and its reveal), **S13-42** (facts read later),
    **S13-43** (the `C_` prefix), **S13-45** (new characters), **S13-48** (the reef under
    `REG_SK`), **S13-51** (Fínán pays for passage), **S13-58** (the mockup) and **S13-59**.
- **Package D, the audio**:
  - S13-60, S13-61;
  - **S13-62 F** (fog silences the music);
  - S13-63 to S13-68;
  - **S13-69 F** (no watch bell);
  - S13-70 to S13-74.
- **The integration pass**:
  - S13-80 (the wreck in the simulation);
  - **S13-81 F** (the words-before-lift order; the wording "Back to the boat");
  - S13-82, S13-83;
  - **S13-84 F** (the broch's budget on this machine);
  - S13-85 to S13-87;
  - **S13-88 F** (left open).

## Known issues
- **Medium:** the broch's frame-budget measure reads 5.3 to 6.1 ms on this machine against 5.5 ms.
  It read the same before Stage 13 (DH-161). CI read 3.57 ms.
- **Low:** the wreck's facts (`sea.wreck.*`) are written but nothing reads them until Stages 15
  to 18.
- **Low:** the Carrick landing is a stub until Stage 16, and coastal landings are deferred to
  Chapter 3 (S13-12).
- **Low:** no sinking is built (S13-18), and Manannán's moving mist is not built (S13-15).

## Flagged for the user's review
- **The wreck as written:**
  - the reveal;
  - the survivors' look and voices;
  - Fínán paying for passage;
  - the left survivors' fate by tomorrow's wind;
  - the reef's mockup and art;
  - the prompt order: a survivor's words come before lifting them, and the boat's side reads
    "Back to the boat".
- **The sea's rules:**
  - winter closure and its calm windows;
  - loading stores up to capacity;
  - no sinking;
  - fog silencing the music;
  - no watch bell;
  - rain drawn on storm days.

## What to try in Stage 13
The playtest script now has a section for this: `docs/playtest/build-1.md`, "After the chapter:
the sea map".
- **To sail:** after the chapter's end, press **M** on the island to open the chart. Pick Carrick
  Landing and choose **Set sail**. The watches then pass by themselves.
- **The choice:** watch the weather cartouche. Rising weather asks you to press on or shelter.
- **The wreck:** on the first crossing you go ashore on Sgeir Dhubh.
  - Walk up to each survivor and press E (the prompt names them).
  - You can carry Ívar.
  - Go "Back to the boat" and answer Hild. The chart returns once you have answered, and the voyage
    goes on to the landing stub.
- **Testing shortcuts:**
  - With `?dev`, F3 on the chart offers "Chart every route and place" and every route.
  - `?view=play&name=Ash&body=A&camp=broch&crew=1&wreck=1` starts on the reef.
- **What to look for:**
  - whether a course feels like a choice;
  - the chart alive in every weather;
  - the music following the weather;
  - a clear prompt at each survivor and at the boat;
  - a hard answer;
  - cries you can place.

## CI results
To be filled in by the main session after the push: the run, its commit, Chromium and WebKit, the
publish, and the published-address smoke tests.

## Next stage ready
YES, once CI is green on both browsers. Every Stage 13 acceptance check passes here. Stage 14
(the whole island: exploration density, movement verbs and collectibles) needs Stage 13, and its
first step is a mockup for the user's approval (Book 3). Under DH-2 it runs on with the mockup
flagged.
