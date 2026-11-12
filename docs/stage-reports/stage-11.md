# STAGE 11 REPORT: boat repairs and the first fitting

In the Book 2 section 23 format: one heading per report field. Decisions are S11-1 to S11-25 in
`docs/decision-log.md`. Built under DD-11 without waiting for approval of the new place, the
redrawn T1 hull or the new props; unlike Stage 10, the Seal Cave mockup was drawn before the place
was built. Everything for the user's review is listed under **Flagged for the user's review**.

## Implemented
- **The ship model and `deriveStats`** (`src/sim/ship/`, `src/content/shipBalance.ts`; S11-2, S11-3):
  - Book 2's `ShipInstance` as `ships.flagship`, with where it lies, Chapter 1's repairs and a
    fitting under way; hull slot layouts in content/hulls.json;
  - `deriveStats` reads every fitting's effect and drawback straight from Book 10's cells, term by
    term, with refits, wear, rowers and load; a boat lacking a repair is not seaworthy, and
    without rigging has no sail;
  - fitting and taking off are exact inverses.
- **The boat** (S11-1): an old six-oared coastal boat drawn up under the bank on Wreck Strand,
  holed, unrigged, its steering oar gone. The approved wreck on the skerry stays as Thorkel's own
  broken boat.
- **The three repairs** (`src/sim/narrative/repairs.ts`, `content/repairs.json`; S11-4 to S11-9),
  each one load, laid by the boat and then worked:
  - **hull boards:** the four salvaged boards and their rivets lie on the shingle beside the boat;
    two worker-days of work patch the hull;
  - **rigging:** at low water, out over the flats to the wreck on the skerry, cut free in one
    action, carried back; a worker-day steps the mast and sets up the stays;
  - **steering oar** from the scavengers' skiff in Seal Cave, four ways: a **trade** at their
    parley (Thorkel's silver, or three days of salt fish), a **theft** unseen (by night at low
    water, in over the flats), a **fight** (the oar is the fight's once it starts), or Runa
    **carves** a new one over two worker-days. A theft seen starts the fight.
  - When all three are done the boat is seaworthy, the beat fires and Hild says it.
- **Crew work while the steerer explores** (S11-8): the shipwright's job, open while there is work
  at the boat; Runa takes it up herself once the shelter has no work, anyone can be given it, and
  the steerer's own hands add to it (a plain action, no timing).
- **One reversible fitting** (S11-6): an extended hold or a raised bow platform, chosen when looking
  the boat over, made by the same work, taken off again in one action.
- **Thorkel's rites** (S11-13 to S11-15): once his body lies on its bier, Hild asks; a ship of
  stones on the machair (the household sets the stones, Bran carries him) or the sea with his
  gold ring for Rán. The household gathers, the lament plays, each speaks, and the rite is
  remembered: friendship by Kin and Faith, Bran's own, the Gain-minded's for the gold, happiness,
  the ring kept by Hild or given to Rán.
- **Seal Cave** (S11-17 to S11-19): a new zone north of the cairn's ground, a cove under a sea
  cliff with the cave's arch in it, the skiff in its mouth on tidal ground, the scavengers' camp on
  the shingle. Its mockup was drawn first and the place built to it.
- **Art** (S11-22), all palette-indexed, compiled and linted: the T1 hull wrecked and patched and
  its layers (rigging, steering oar, hold, bow platform, launch-ready), the skiff, the rigging on
  the skerry, the three loads lying and carried, the ship-setting, the cave face and its dark.
- **Sound** (S11-24), all generated and captioned: the work at the boat, each repair's sound, the
  fitting made and taken off, Runa's adze, the stones, the sea burial, the boat made whole,
  Thorkel's lament, and Seal Cave's ambience.
- **World state version 9** with a migration from 8, and golden save 9; golden saves 1 to 8 are
  frozen and load (S11-23).

## Tests
- `npm run lint`: clean. ESLint, Prettier, content lint (997 strings, 466 registered IDs) and art
  lint (114 sheets, 27,292 frames, 0 placeholders).
- `npm test`: **44 files, 580 passed, 0 failed**. New tests:
  - `tests/unit/ship.test.ts`: 18 tests, `deriveStats` for T1 bare and with each of the ten
    fittings against Book 10's rows, the reversal, slots, rowers, wear, load, the wrecked boat;
  - `tests/unit/shipArt.test.ts`: 6 tests on the drawn frames (check 1);
  - `tests/scenario/repairs.test.ts`: 13 tests, played by `RepairBot` through the sim's commands:
    the hull by Runa while the steerer is away and by hand, the rigging at low water, the oar by
    trade, unseen theft, seen theft, fight and carving, the fitting reversed, the boat made ready,
    and both rites.

  Updated tests: `saves.test.ts` (schema 9, golden 8 frozen, golden 9 added), `art.test.ts` (the
  census of sheets).
- `npm run build`: passes.
- `npm run test:browser -- --project=chromium`: **52 passed, 0 failed** (the whole suite). New:
  `tests/browser/stage11.spec.ts`, 4 tests, stepped with `oeStep`: the boards carried and laid by
  the boat and its work offered; the drawn boat by its repairs; Seal Cave's parley and the oar
  bought with silver and lifted; the boat's words offering the fitting and the carving.
- `npm run audio:render`: every item renders and none clips (see **Balance**).
- CI results: see the run for this commit.

## Gate checks
1. **Each repair visibly changes the boat sprite: PASS.** `shipArt.test.ts` composites the drawn
   frames as the scene draws them: each repair alone, and each step in three orders, changes at
   least 60 pixels; the hull patch changes the boat where its holes were; all three add the
   launch-ready rollers; each fitting changes it and, taken off, the boat is drawn exactly as
   before. See `docs/art/stage-11/t1_states@4x.png` and `t1_repairs.gif`.
2. **`deriveStats` for T1 with each fitting, using Book 10's values: PASS.** `ship.test.ts`.
3. **No task needs a large count of one resource: PASS.** Every material is one load
   (`repairs.test.ts` plays each); the only work is labour, which the household does while the
   steerer is away. No mini-game: the work is a plain action.
4. **The Book 7 section 14 standard: PASS.** `npm run capture -- stage-11` wrote
   `docs/art/captures/stage-11/`. Motion with the camera still (threshold 80%):

   | View | Motion |
   |---|---|
   | Wreck Strand | 93.9% |
   | The boat, wrecked | 87.5% |
   | The boat, ready with the hold | 87.7% |
   | The boat with its loads, Runa at work | 88.5% |
   | The skerry at low water | 82.8% |
   | Seal Cave | 91.3% |
   | The ship-setting | 88.0% |

   And a 10-second clip walking down to Seal Cave (`sealcave-walk.mp4`). See **Art check**.
5. **The Book 11 audio standard, with captions: PASS.** Every repair and task has its generated,
   captioned sound (`audio.test.ts`, `audioCoverage.test.ts`, `homeAudio.test.ts`), Seal Cave has
   its ambience, the lament plays at the rite; rendered and checked by levels (**Balance**). I
   can't hear the renders myself: the user should listen in the sound test's Stage 11 section.

## Art check
- **The captures against `docs/art/reference/`**: the new place uses the reference's palette and
  terrain rules: dual-grid edges, moving plants, cloud shadows, water with foam and sheen, contact
  shadows. Every view is above the motion threshold. Still: the cliff's rock (Book 7 allows solid
  things still), trodden paths.
- **The mockup** (`docs/art/mockups/stage-11/`): Seal Cave, a still and a loop at 640 x 360,
  92.9% motion, drawn before the build, with a self-review against each point of section 14. The
  built place keeps its composition: cliff, arch, skiff in the mouth, camp on the west shingle,
  cove and sea. It differs in its flats (the strand's rippled flats tile) and its plainer cave
  floor.
- **The T1 hull** (`docs/art/stage-11/`): every state at 1x and 4x and a GIF. Inspected: the sheer
  rises to stem and stern, four clinker strakes with rivets, three benches; the two stove-in strakes
  read at 1x, as do the pale patch boards; the mast, stays, yard and furled sail; the steering oar
  on the near quarter; the hold's hides; the bow platform; rollers and oars when ready.
- **Fixed after the first captures:** the open flats were still (S11-21); the cliff face over the
  arch was short and its skyline stepped a tile at a time; the cliff needed its plants (S11-19);
  the hull was boxy (its ends now taper); ink round the rigging made the stays heavy (lines are
  drawn without it).

## Balance
- **New in Book 10** (exported by `npm run balance`): "Chapter 1 repairs" (section 05) and
  "Thorkel's rites" (section 08); see S11-4 and S11-14. All starting values.
- **Audio levels** (`npm run audio:render`; Book 11 section 09: ambience about -22 dBFS RMS, music
  -21 to -24):

  | Sound | Peak | RMS | RMS in dBFS |
  |---|---|---|---|
  | Seal Cave ambience | 0.399 | 0.0669 | -23.5 |
  | Work at the boat | 0.327 | 0.0400 | -28.0 |
  | Rigging cut | 0.257 | 0.0221 | -33.1 |
  | Load laid | 0.308 | 0.0296 | -30.6 |
  | Repair done | 0.336 | 0.0286 | -30.9 |
  | Oar taken | 0.251 | 0.0214 | -33.4 |
  | Fitting made | 0.253 | 0.0190 | -34.4 |
  | Fitting taken off | 0.267 | 0.0281 | -31.0 |
  | Adze (carving) | 0.264 | 0.0381 | -28.4 |
  | Stones set | 0.310 | 0.0366 | -28.7 |
  | Sea burial | 0.306 | 0.0295 | -30.6 |
  | The boat made whole (stinger) | 0.244 | 0.0411 | -27.7 |
  | Thorkel's lament | 0.378 | 0.0576 | -24.8 |

  The effects sit with the existing work sounds (the hammer: 0.333 peak, 0.034 RMS); the lament
  was raised from -34 dBFS to sit with the hearth theme.
- **Fights:** the careful-player bot beats the one scavenger who ran from the fold in at least 2 of
  4 seeds (the test's floor). Three at once with no ally is much harder; the trade and the theft
  are there (S11-10).

## Deviations
- None from the books. Every choice the books leave open is logged as S11-1 to S11-25. Book 9's
  Seal Cave mouth is drawn one block south (S11-18), noted in Book 9.

## Known issues
- The cove's flats use the strand's flats tile, a regular rippled sand; they shimmer now, but the
  pattern is stronger than the mockup's sand.
- The skiff is a little wider than the arch's foot, so its ends tuck behind the cliff.
- Carrying a load far drains stamina (heavy carry): the oar from Seal Cave is set down when the bar
  runs out and must be lifted again. It is the existing carry rule, not new.
- The ship-setting reads small at 1x (about five tiles).
- `tests/unit/standard.test.ts`'s frame-budget check failed once in a full parallel run and passed
  alone; it measures time, and the full suite loads the machine.
- The Book 10 numbers are starting values; the hull's two worker-days take Runa about two days.

## Flagged for the user's review
1. **The boat that is repaired** (S11-1): an old boat drawn up under the bank, not Thorkel's; the
   skerry's wreck is his.
2. **The redrawn T1 hull and its states** (`docs/art/stage-11/`), wired in without approval.
3. **Seal Cave**, its mockup (`docs/art/mockups/stage-11/`) and the built place
   (`docs/art/captures/stage-11/sealcave.png`), and its mouth a block south of Book 9's.
4. **The oar's four ways** (S11-9, S11-10): the trade's prices, the theft by night over the flats,
   a seen theft starting the fight, and the fight being hard alone.
5. **The boards near the boat** (S11-5) rather than in the far debris.
6. **The rites** (S11-13 to S11-15): asked for by Hild at the bier, Thorkel's own gold ring for
   Rán, and the Book 10 numbers.
7. **The flats' shimmer** (S11-21), which also shows on the strand at low water.
8. **The new sounds and the lament**, to be listened to in the sound test (S11-24).

## Next stage ready
Yes. Stage 12 (the launch and the Build 1 gate) can start when the user names it; it is a build
gate.
