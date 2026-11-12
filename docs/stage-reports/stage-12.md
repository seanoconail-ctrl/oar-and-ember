# STAGE 12 REPORT: the launch and the Build 1 gate

In the Book 2 section 23 format: one heading per report field. Decisions are S12-1 to S12-25 in
`docs/decision-log.md`. Built under DD-11 without waiting for approval of the new art or the new
screens. **This is a build gate: the user playtests now, and Stage 13 waits for the user.** The
playtest script is `docs/playtest/build-1.md`. Everything for the user's review, from Stages 7 to
12, is gathered under **Flagged for the user's review**.

## Implemented
- **The launch, the first story gate** (`src/sim/narrative/launch.ts`, `content/launch.json`;
  S12-1 to S12-9):
  - Book 2's `GateState` in the world's `gates`; the gate opens once the boat is seaworthy and the
    three searches are decided, and starts only on the player's command (S12-2);
  - looking the boat over offers "Launch the boat", which opens the **readiness screen**: the boat,
    the tide, the crew (rowers against the hull's rowing crew), food in days, the weapons in hand,
    allies ("Not known") and Thorkel's rites, each Ready, Short or Not known, with the warning that
    there is no going back (S12-5); time stops while it is open (planning);
  - the boat floats off only on the tide: the screen says when the water will float it, and the
    start is refused while it is out (S12-4);
  - starting makes the checkpoint `launch`, closes Thorkel's rites and, if he had none, writes
    Book 6's `RITES_DENIED` (S12-6).
- **Naming the boat** (S12-10): free text, cleaned (letters with accents, spaces, hyphens and
  apostrophes, at most 24 characters, never a `{variable}`), with eight suggestions; lines say
  `{ship}`.
- **The sail mark** (S12-11, S12-15): Book 7's ten patterns in madder, woad or weld on undyed wool
  (28 marks), chosen with the boat drawn under it, and what the coast will make of a likeness.
- **The launch scene** (S12-8): the household sets hands to the boat, heaves, runs it down its skids
  to the water, climbs aboard one by one (the steerer last), hoists the yard and drops the sail with
  its mark, and rows out, a stroke a second, with Hild naming the boat. Real time; the steerer is
  the scene's while it plays.
- **The launch's music** (S12-17): the Ship theme as note data (`content/music/ship.json`,
  `MUS_LAUNCH`), and the keel on the skids, the splashes, the oars' splash and creak in time with
  the drawn stroke, the sail flapping and filling, the discovery stinger and the chapter's end, all
  generated and captioned.
- **The read-only sea map** (S12-14; `src/scenes/seaMap.ts`): a drawn chart of the Narrow Sea; the
  mist clears from Skarvholm, the coasts show, the household's boat bobs under its mark, smoke rises
  at Carrick Landing ("Smoke on the Irish shore"); the sea shimmers, cloud shadows drift,
  Manannán's mist lies off the Irish shore. The map key shows it again later.
- **The chapter's end** (S12-9): Chapter 1 resolved, Chapter 2 open, the tutorial guard over,
  Carrick rumoured; closing the map passes the trial row's hour, draws the boat up again, makes the
  chapter-end save `chapter-1-end` and shows its card. Build 1 goes on on the island.
- **Telemetry** (S12-12; `src/sim/narrative/telemetry.ts`): the chapter's played time, the time
  menus held the game, and the first moment of 21 milestones (the first fight among them), in the
  save; shown in the system menu (Esc, then T), with `?timings` as a readout that stays up, and on
  the chapter-end card. `src/tools/play/chapterRun.ts` plays Chapter 1 through for it.
- **Art** (S12-16): `ship_t1_launch`, `ship_t1_sail`, `ship_t1_crew`, `ui_seamap`, `fx_seamap`,
  `token_t1`, palette-indexed, compiled and linted (`assets/art/authoring/stage12_art.py`).
- **World state version 10** (`gates`, `telemetry`, `ShipInstance.name`) with a migration from 9;
  **golden save 10, the chapter-end save** (Book 3's "golden save 2", S12-20); golden saves 1 to 9
  are frozen and load.
- **The playtest script**: `docs/playtest/build-1.md`.
- **Fixed on the way**: a downed Bran no longer stalls Thorkel's rite (S12-23); the build's version
  is 0.12.0 (S12-24); the wreck-scavengers, the only speakers in Chapter 1 with no voice, have voice
  blips (S12-25).

## Tests
- `npm run lint`: clean. ESLint, Prettier, content lint (1147 strings, 467 registered IDs) and art
  lint (120 sheets, 27,639 frames, 0 placeholders).
- `npm test`: **46 files, 603 tests, all pass** (one full run; the frame-budget test in
  `standard.test.ts` and the strand art timeouts have flaked under parallel load before and pass
  alone; they passed in this run). New:
  - `tests/scenario/launch.test.ts` (10 tests): the gate closed and opening on its own conditions,
    never starting itself; offered at the boat; the readiness screen's lines and warning; the tide
    out refusing the start; the start's checkpoint, the rites denied, the name cleaned and the mark;
    the rites given writing no deed; the whole scene (its phases, the float line's water, the crew
    aboard, the reveal's facts, the chapter's end, the boat at its berth); determinism; Chapter 1
    played through for its telemetry, at the scripted pace and a human pace;
  - `tests/unit/launch.test.ts` (11 tests): Book 10's launch numbers; the name's cleaning and the
    suggestions; the 28 marks, each drawn differently on the sail and the token; the crew and the
    helm; the sea map's frames; the telemetry in the save; the Ship theme's metre, mode and voices.

  Updated: `saves.test.ts` (schema 10; golden 9 frozen and loading through the migration; golden 10
  added and reproduced by its scenario), `art.test.ts` (the census), `controls.test.ts` (its
  "changing nothing" leaves out the telemetry, which marks on any tick as the clock moves).
- `npm run build`: passes.
- `npm run test:browser -- --project=chromium`: **56 passed** (5.2 min; the standard's motion 96.0%,
  62.3% reduced; script 4.07 ms a frame). New: `tests/browser/stage12.spec.ts`,
  4 tests, stepped with `oeStep`, waiting in game time for residents to pass the boat: the whole
  launch through the boat's words, the readiness screen (time stopped), the name, the mark, the
  scene, the music, the sea map revealed, the chapter's end and its save, the telemetry; "Not yet"
  leaving the gate open; a launch begun with no name asking for it (braces dropped); the timings in
  the system menu.
- `npm run audio:render`: every item renders and none clips (see **Balance**).
- CI results (run 43166105211 for commit 2e01b51, which carries Stages 11 and 12):
  - Chromium: passed (lint, test, build, browser tests).
  - Firefox (macOS): passed.
  - WebKit (Linux, Playwright image): passed.
  - Pages deployed only after all three. The published-address checks passed in all three browsers.
  - Earlier failures on the way, none in the game itself:
    - 318ee10: a Firefox race in the Stage 7 fire test, where Hild's talk prompt came first. Fixed in c978e71.
    - The art lint test timed out. Fixed in 610d47e.
    - 74b9e37: the frame budget measured 4.09 ms under CI load. It is now timed alone (1184e5b, S12-26).
    - 1184e5b: three scenario tests ran past vitest's 5 s default. They now have a 60 s default limit (S12-27).

## Gate checks
1. **Chapter 1 takes 45 to 60 minutes for a new player, with combat inside 25 minutes (by
   telemetry): MEASURED, NOT PROVEN; see the estimate below.** The telemetry is built and tested;
   the honest estimate is in **Timing**.
2. **User playtest: READY.** The build is published by CI from this commit; the script is
   `docs/playtest/build-1.md`.
3. **Art lint clean for every Build 1 asset, no placeholders: PASS.** Art lint: 120 sheets,
   27,639 frames, 0 placeholders; no sheet has `placeholder: true`, no audio cue is `temporary`, no
   placeholder or TODO in the source.
4. **The Book 7 section 14 standard: PASS** for every in-world view (Wreck Strand 93.9%, the boat
   ready 88.9%, the heave 91.7%, afloat 92.4%, against 80%), with the shortfalls named in **Art
   check** (see **Art check**).
5. **Firefox and WebKit block publishing: PASS** (BR-2 to BR-7). `.github/workflows/ci.yml`: `deploy` has
   `needs: [check, browsers-firefox, browsers-webkit]`, and no job has `continue-on-error`.
6. **Audio: PASS.** The launch music and every new sound play, captioned, and were rendered and
   checked by level. Chapter 1 audit below; I cannot hear the renders: the user should listen in
   the sound test's Stage 12 section.

## Timing
Measured by the telemetry, played through the simulation by the scripted players
(`node src/tools/play/chapterRun.ts chapter-1 bot|human`; a test plays it too):

| Run | Chapter 1 played | First fight | Notes |
|---|---|---|---|
| Scripted, fastest route (golden save 10: Bran by the chest's silver, the oar traded for, the boat worked by hand, no fire lit or leg tended) | 28.8 min | none | No fight at all on this route |
| Scripted, a full route (fire and leg; Oddi chest first, Runa by an offering, Bran by fighting at the fold, lost once and taken again from its checkpoint; the oar stolen; a fitting; the rites; the launch) | 66.7 min | 9.1 min | The bot never sleeps: it stands awake through four nights until it collapses at 02:00 |
| The same at a human pace (4 s to read and choose at each talk choice, 6 s looking round in each new zone, 15 s per morning report, 75 s over the readiness, name and mark, 20 s over the map) | 69.7 min (2.8 min of it held by menus) | 9.8 min | As above |

**My honest estimate for a new player: about 45 to 65 minutes, most likely 50 to 60; the first
fight at about 12 to 25 minutes if they go to the sheepfold first or second, and possibly never.**
The reasoning:

- **The scripted full run overstates the waiting.** From Bran's search (14 min) to the hull patched
  (57 min) the bot stood awake through the nights while the tide and Runa's labour came round; about
  20 to 25 of those minutes are nights a player would sleep through (a night passes in three
  seconds in bed after 18:00). Without them the run is about 45 minutes.
- **It understates the finding.** The bots walk straight to every goal. A new player has to learn
  the controls, find Hild, the seax, the bow, the driftwood, each search across four zones, the
  boards, the low-water rigging on the skerry and Seal Cave to the north, read every line and the
  reports, and probably lose the fold's fight once (the bot lost it once in this run). I reckon that
  adds 10 to 20 minutes, which brings it back to about 50 to 65.
- **The repairs are paced by game time, not by tasks.** The boards are near the boat, but the patch
  is two worker-days, the rigging waits for low water and the oar for Seal Cave. A player who works
  on the boat with their own hands (a plain action, 30 game minutes in 2.5 seconds) finishes in a
  few minutes; one who leaves it to Runa waits about two game days (about 20 minutes awake, much less
  if they sleep). This is the biggest swing, and the playtest will show which players do.
- **Combat inside 25 minutes is not guaranteed by design.** The chapter can be finished with no
  fight at all: Bran by sneaking or the chest's silver, the oar traded for, stolen or carved. A player
  who fights at the fold meets the first fight at about 10 minutes (scripted) to 25 (new). Book 1's
  "a combat test inside the first 25 minutes" is met only if the player chooses the fight. **Flagged
  for the user** (no change made: forcing a fight would remove the searches' other ways).

No filler was added to reach a number.

## Art check
Captures in `docs/art/captures/stage-12/` (`npm run capture -- stage-12`; its README lists every
file), mockups in `docs/art/mockups/stage-12/`, and the new art at 1x and 4x with a GIF in
`docs/art/stage-12/`.

| View | Continuous motion with the camera still |
|---|---|
| Wreck Strand (as at Stage 6) | 93.9% |
| The boat ready on its skids (`launch-ready`) | 88.9% |
| The heave and the run down the skids (`launch-heave`) | 91.7% |
| Afloat under the mark, rowing (`launch-sail`) | 92.4% |
| The sea map (a screen, not an in-world view; for the record) | 72.9% |
| Book 7 threshold (in-world views) | 80% |

Compared with `docs/art/reference/` (`wreck-strand-target.png`, `kelda-summer-target.png`,
`target-walk.mp4`):
- **Terrain, water, wind, life, light**: the launch plays on the approved Wreck Strand, so the
  strand's sward, wrack, foam lines, sheen and tide match the reference as at Stage 11; the sea
  keeps moving round the boat, the grass sways, the crew row, the sail billows in four frames.
- **The boat afloat**: the hull is cut at its waterline with the water lapping along it (not a
  sprite pasted on the sea); the crew sit at their oars and dip them in time with the drum; the
  sail's mark reads at 1x (every one of the 28 marks is shown at 1x and 4x in
  `docs/art/stage-12/sail_marks*.png`).
- **The screens** (readiness, naming, mark) are drawn panels over the frozen strand in the game's
  wood-and-wool panel style with the boat drawn by the game's own sheets in the preview (not boxes);
  the naming and mark screens show the boat beached and then afloat under the chosen mark.
- **The sea map** is a drawn chart: shaded coasts with surf lines and cliffs, grass and peat on the
  land, deep and shallow water with a moving sheen, drifting cloud shadows, a mist that clears
  outward and a mist bank that never does, the household's boat as a token under its own mark, and
  smoke rising. Its motion is lower than the strand's because the land on a chart holds still.
- **Shortfalls against the reference**: the heave is read from the people standing at the boat's
  far side in a lean, not a strong pushing pose (no push animation was drawn; see **Known
  issues**); the boat runs broadside down the beach because the hull is side-on.
- The 10-second clip (`launch-clip.mp4`, `launch-clip.gif`) shows the heave, the run down, the
  float and the boarding with the camera following.

## Balance
**Book 10 additions** (section 22, "The launch"; exported by `npm run balance`; S12-3): floats Knee;
skids 8 tiles; slideSpeed 1.8 tiles a second; rowSpeed 1.2 tiles a second; rowOut 9 tiles; trialRow
60 game minutes; tideLookahead 24 game hours; storesShort 3 days. Section 22's two older tables were
given headings ("Gates", "Gate rules") so the export keeps them; no value changed.

**Audio levels** (`npm run audio:render`, full run, no item clips; peak and RMS of the render):

| Item | Peak | RMS |
|---|---|---|
| `MUS_LAUNCH` (the Ship theme, all layers) | 0.452 | 0.0668 (about -23.5 dBFS) |
| `SFX_BEACHING` (the keel on the skids) | 0.278 | 0.0263 |
| `SFX_OAR_SPLASH` | 0.435 | 0.0447 |
| `SFX_OAR_CREAK` | 0.141 | 0.0206 |
| `SFX_SAIL_FLAP` | 0.351 | 0.0296 |
| `SFX_SAIL_FILL` | 0.377 | 0.0285 |
| `MUS_STINGER_CHAPTER_END` | 0.467 | 0.0656 (about -23.7 dBFS) |
| Ketill's voice blips | 0.178 | 0.0214 |
| Svart's voice blips | 0.149 | 0.0160 |
| Conn's voice blips | 0.244 | 0.0238 |

The theme and the stinger sit with the other music (about -23 dBFS RMS); the effects and the new
voices sit with the household's (voices 0.15 to 0.29 peak).

**Chapter 1 audio audit** (Book 11 section 12): every place has its ambience (Wreck Strand, the
machair and the broch with the hearth, the Kelda pool, the Hag's Seat's gale, the cairn and the
fold, Seal Cave); every speaker has a voice (the household, Hild, and now the three scavengers);
every system has its sounds and captions (the fire, fishing, work, sleep, the report, combat and
gore, the searches, the repairs, the rites, the launch). **Without a sound of its own:** the sea map
has no ambience (it plays over the launch's music and the stinger; its sea sounds come with
Stage 13's sea travel).

## Deviations
- None from the books' intent. Every choice the books leave open is logged as S12-1 to S12-25.
  Small book updates: Book 2 section 05 (version 10) and 16 (readiness lines), Book 3 Stage 12 (the
  golden save's number), Book 7 section 04 (the marks), Book 10 section 22 (The launch; two tables
  given headings), Book 11 section 03 (`MUS_LAUNCH`).

## Known issues
- **The timing check is not proven** until the playtest: the scripted players do not sleep and do
  not search, so the 45 to 60 minutes is an estimate (see **Timing**), and a fight can be avoided
  altogether (flagged).
- **The heave has no pushing pose**: the household stand at the boat's far side, leaning, and the
  steerer uses the gathering loop; then the boat runs broadside down the beach (the hull is drawn
  side-on). It reads, but a proper shove animation would read better.
- **The sea map shows no routes, wind or tide, and has no ambience of its own**: those come with
  sea travel (Stage 13). Its motion (72.9%) is below the in-world threshold, which it is not held to.
- **The Ship theme does not sing the boat's name** (Book 11's "can be sung in it once chosen"); left
  for Stage 13's sea music (S12-17).
- **The mockups were rendered from the built scene**, not drawn first (S12-19).
- **After the chapter's end the island goes on with nothing new to do**; the map key shows the
  read-only map again.
- **`launch-clip.mp4` is 4.4 MB** (an MP4 at 2x; the GIF is 1.2 MB).
- **Flaky under load, not failing**: `standard.test.ts`'s frame budget and the strand art tests'
  timeouts can fail when the whole suite runs in parallel on a busy machine; they pass alone and
  passed in the final run. No threshold was changed.
- Firefox and WebKit were not run locally; CI runs them and they now block publishing.

## Flagged for the user's review
Gathered from the stage reports and decision-log sections of Stages 7 to 12. Every one was built
without waiting (DD-11) and wants a look in the playtest.

**Stage 7: day and night, shelter and first tasks**
- The new art (S7-19, S7-24): work loops and sleep (Hild's kneel reads weakly), sheep, the broch, the
  sails' ripples, the camp's props, the fire, the clock, stamina bar, reason icons, timing ring.
- The Book 10 additions (S7-4 to S7-8, S7-10) and the steerer waking cold (S7-9).
- The machair as its own zone with a fade between zones (S7-1), the broch's place in it (S7-3).
- Hild's first day (S7-11) and the camp's work opening only at the broch (S7-26).
- The home music schedule (90 s ambience, 150 s music) and the island theme away from home (S7-20).
- The thicker sward and stronger calm sway, which also touch the approved strand (S7-23).

**Stage 8: people, schedules and talk**
- Hild working at once at half pace, and tending through the talk (S8-5, S8-9).
- The household's hours and jobs; driftwood as a resident's job at 2 to 6 loads a day (S8-6, S8-7,
  S8-29).
- The new Book 10 numbers and re-headed tables (S8-1, S8-2, S8-12); stances moving no number (S8-3);
  the culture rule (S8-4).
- People data choices: codes, stances, traits, kin ties (S8-18).
- Oddi's theft scene: its window, its five judgements, when it first fires (S8-21).
- The Chapter 1 crew's lines (S8-20); Hild's eating loop and the foreshore's glints (S8-22, S8-28);
  the dispute stingers brought forward and the seventeen voices (S8-24, S8-25).

**Playtest notes (PT-0 to PT-7)**, done as asked: menial tasks plain, only fishing timed, driftwood
found and picked up, the camera easing; the driftwood numbers and art (PT-3, PT-5) are mine.

**Stage 9: combat**
- The fighting art for both steerer bodies, the heavy build and the three wreckers (S9-1).
- The fight rules and fighters' habits in Book 10 (S9-2 to S9-8, S9-23), starting values.
- Attack tokens: one attacker at a time, a 2 s rest between (S9-29); flanking (S9-27).
- The options: Second wind off by default, K in the system menu (S9-9); saves in play (S9-20).
- A blade never refused for reach (S9-22); gore timings and the combat music's layers (S9-17,
  S9-21).

**Stage 10: the searches and the southern island**
- Oddi, Bran, Runa and Thorkel's body, wired in without approval (S10-18).
- The Hag's Seat and the fold, their mockups rendered from the built places (S10-19); the cairn and
  the Kelda pool.
- The chest rule (S10-7); the Hag's Seat rule (S10-5, S10-6); the sneak and the bargain (S10-8);
  the wreckers' parley and Bran as an ally (S10-9); the Book 10 numbers (S10-10); the wind heard,
  not seen (S10-21); the southern sounds and the tell (S10-17).

**Stage 11: the boat**
- The boat repaired is an old boat under the bank, not Thorkel's (S11-1).
- The redrawn T1 hull and its states (S11-22); Seal Cave, its mockup and its mouth a block south of
  Book 9's (S11-17, S11-18).
- The oar's four ways and their prices; the fight there hard alone (S11-9, S11-10).
- The boards near the boat (S11-5); the rites, Thorkel's ring and the numbers (S11-13 to S11-15);
  the flats' shimmer (S11-21); the new sounds and the lament (S11-24).

**Stage 12: the launch**
1. **Combat inside 25 minutes is not guaranteed** (see **Timing**): the chapter can be finished
   without a fight. Does the user want a fight the player cannot avoid (it would cut a way out of a
   search)?
2. **The launch waits for the tide** and for everyone to be found (S12-2, S12-4).
3. **The rites close at the launch**, and Book 6's `RITES_DENIED` is written if they were never
   given (S12-6).
4. **The name suggestions** (Cormorant, Skarfr, Grey Seal, Wave-Hound, Storm-Petrel, Driftwood,
   Patched Sow, Second Keel) and the name's rules (S12-10).
5. **The 28 sail marks**, their drawing, and "weld yellow" drawn yellow (S12-11, S12-16); the sail
   drawn face-on (S12-15).
6. **The launch scene's choreography** (S12-8): crew behind the boat, the sideways run down the
   skids, boarding one by one, rowing out east; the boat drawn up again after the map (S12-9).
7. **The sea map's chart** (S12-14): the coasts' shapes and the places' positions are mine, laid out
   from Book 4 and Book 10's route times; only Skarvholm and the smoke are named.
8. **The Ship theme** (`MUS_LAUNCH`, S12-17) and the launch's sounds, to be listened to in the sound
   test's Stage 12 section; the scavengers' new voice blips.
9. **The mockups were rendered from the built scene**, not drawn first (S12-19).
10. **The golden save numbered 10**, not 2 (S12-20).
11. **CLAUDE.md's BR-1 sentence** is out of date (BR-7 ended it); the user may wish to edit it.

## Next stage ready
No: this is the Build 1 gate. Stage 13 (sea-map travel) waits for the user's playtest and word.
