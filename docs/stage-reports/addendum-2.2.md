# CHANGE REQUEST REPORT: design addendum 2.2, Parts 1 and 2

A change request, not a stage. Stage 7 has not been started. Part 3 (the characters and water
rework of Stage 6) stops for the user's approval of the rendered sheets before it is wired in.

## Implemented
- **Part 1: the addendum folded into the books** (decision log DA-1 to DA-16). The books are the
  source of truth again; `docs/design-addendum-2.2.md` is kept as a record.
  - Book 1: revision 2.2; locked requirements; stealth or assault; happiness, friendship and fear;
    disputes, requests and quests; tasks by hand and the home without the steerer; the mainland,
    wilderness, camping, companions, dungeons, movement and collectibles; controls and camera;
    the 32 x 48 people about 40 px tall; new sections 18 (stamina and condition), 19 (the living
    world) and 20 (twists and the unexpected); Build 4 in the builds table.
  - Book 2: the systems' data shapes and runtime rules, the `MAIN_` prefix, input and camera
    (section 21), stamina (24), the living world (25), new budgets and required tests.
  - Book 3, renamed "Stage Plan": 37 stages in seven phases, gates at 12, 20, 24 and 32, Stages 6
    to 9 reworked as the addendum says, and the audio acceptance check in every stage.
  - Books 4 to 9: the mainland of twenty areas, wilderness, dungeons, the living world, twists,
    people and leaders, stealth and assault, water and wading, controls and scale art, voices and
    the stamina wording. Book 10: the numbers (sections 02, 06, 08, 09 and new 14 to 21), and
    `content/balance.json` regenerated (revision 2.2). Book 11: footsteps, mix and production.
  - The stamina instruction and the scale, controls and camera instruction are folded in too.
  - Content, IDs and saves: the registry gains `MAIN_` and `REG_MAINLAND`, the 20 areas and seven
    leaders, and loses the three hinterlands, their zones and Arra Foot; `content/regions.json`
    holds `REG_MAINLAND` with its two home sites; golden save 2 is regenerated (content changed;
    schema unchanged).
- **Part 2: sound.**
  - Footsteps (AU-10): soft, low and dull, no click, varied every step, different by surface and
    gait, at least 10 dB under a light hit. The sound test page has a footsteps panel to compare
    the six surfaces and four gaits, and a panel for the horn, the stingers and the hearth.
  - Step 2 (AU-11): the generated audio plays in the game: the strand's wind and sea following the
    game's wind and tide, footsteps, Hild's voice blips from where she is, the island theme once she
    is safe, the horn and stingers in the shell, ducking. The Stage 5 test tones are gone; only the
    combat music still stands in, flagged. Samples are made in a background worker.

## Tests
- `npm run lint`: clean (content lint 260 strings and 399 registered IDs; art lint clean).
- `npm test`: **27 files, 306 tests, all passed.** New: `tests/unit/audioCoverage.test.ts`
  (7 tests). Updated for the change: the prefix count (39), the place count (27), the music
  tempo in the duck test, the temporary-cue test, and the stated-region check.
- `npm run build`: passes (with the sample worker).
- `npm run test:browser`, Chromium: **26 passed.**
  - New: the footstep measurements.
  - Run with the others, the Stage 6 rescue test timed out once under load; on its own it passed
    in 43 s.
- **Listening back** (`npm run audio:render`), steps by peak and RMS:
  - grass walk 0.068 and 0.0066;
  - shingle 0.047 and 0.0038;
  - sand 0.037 and 0.0034;
  - water 0.054 and 0.0045.
  
  For comparison, the light hit is 0.51 and 0.065. The horn call was raised to 0.0612 RMS, so a
  warning stands with the effects.
- Latest CI before this change (91ad5e4 to 6bf23ea):
  - Chromium passes.
  - Firefox passes at the build and at the published address.
  - WebKit fails (lost WebGL context).
  
  Firefox and WebKit do not block publishing until Stage 12 (BR-1).

## Deviations
Decision log DA-1 to DA-16, AU-10 and AU-11. The proposals for the user's review are listed at
the end of the DA entries.

## Known issues
- **Medium:** the combat music is a stand-in (the raid's alarm) until Stage 9.
- **Medium:** the code still uses `Person.regard`, the 32 x 40 sprites, keyboard-only controls and
  travel-direction look-ahead until the Stage 6 rework (Part 3) and Stage 8 build them.
- **Low:** the Stage 6 rescue browser test can time out on a heavily loaded machine.

## Next step ready
Part 3: the 32 x 48 sheets, wading and particles, rendered for the user's approval.
