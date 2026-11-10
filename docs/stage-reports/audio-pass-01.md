# AUDIO PASS REPORT, STEP 1: generated audio and the sound test page

A change request between stages, not a stage. Step 1 only: the sound test page, then stop for
the user's approval. Stage 7 has not been started, and nothing is wired into the game yet.

## Implemented
- **The decision recorded:** the game generates all of its own audio (decision log AU-1).
  - Book 11 is rewritten for generated audio: direction and references (01), instruments (02),
    voice (08), mix and sliders (09), technical specification (10), production (11), and a new
    "Audio standard" (12).
  - Book 2 section 18, Stage 0 decision 19 (Book 3 and the decision log), the Book 3 audio
    deliverables and rules, Book 8 section 08 and CLAUDE.md are updated to match.
- **Synthesiser and sequencer** (`src/audio/synth/`; AU-2, AU-3):
  - one generated sample per instrument at 32 kHz: plucked lyre, bright harp, breathy flute,
    tin whistle, drone, choir-like pad, bells, horn, frame drum, hand percussion and a gull call;
  - 8 music voices with stealing, one shared echo, buses with sliders and mono;
  - note data in `content/music/`, played with every change on a bar line and seamless loops.
- **Music** (AU-4):
  - the hearth theme with six switchable layers;
  - Skarvholm in summer and in winter;
  - the raid loop with the alarm.
- **Generated sound:**
  - the Wreck Strand ambience, with the wind following the game's own wind field and the tide;
  - the combat set: light hit, both heavy charge levels, parry, block and guard break, with the
    light hit scaled by the gore setting;
  - three tells: Rán, Manannán and the draugr (AU-7);
  - voice blips for Hild, Bran, Runa and Oddi, and none for the steerer (AU-6);
  - captions for all of these.
- **The sound test page:** `sound.html`, a second page of the published build (AU-5).
- **Listening back:** `npm run audio:render` renders every item offline to WAV with its levels
  (AU-8).

## Tests
- `npm run lint`: clean. Content lint covers 237 strings; art lint is clean.
- `npm test`: **26 files, 299 tests, 299 passed.** New: `tests/unit/synth.test.ts` (12 tests).
  The ID registry refs follow the rewritten Book 11 naming row.
- `npm run build`: passes, with two pages (`index.html` and `sound.html`).
- `npm run test:browser`, Chromium: **25 passed.**
  - New: `tests/browser/sound.spec.ts` (4 tests). The page offers every item, and rendered
    offline nothing is silent or clips, the hearth theme loops without a gap, and the alarm lands
    on the next bar line.
  - In one earlier full run, the Stage 6 rescue test timed out while the machine was under
    heavy load; it passed on its own and in the rerun of the full suite.
  - Firefox and WebKit run in CI.

## Listening back (AU-8)
Claude cannot hear. Every item was rendered and measured instead.
- **Pitch-class profiles:**
  - hearth: D, A, E, G, C, F, B, which is D Dorian;
  - Skarvholm summer: E, A, D, G, B, C, F sharp, which is A Dorian;
  - Skarvholm winter: A, E, G, D, C, B, F, which is A Aeolian.
- **Levels (RMS):** music about -21 to -24 dBFS, the strand about -22 dBFS, effects and tells
  standing above the music, and blips about -31 to -34 dBFS. Peaks are all below 0.85.
- **Spectrograms:** every effect and tell has its own shape. The parry is a short bright spike,
  the block a low thud, the level-2 charge a long wavering ring and exhale, and the draugr's
  drips grow louder each drop.
- **Changes made from the measurements:**
  - a softer top on the music;
  - the ambience quieter and the blips louder;
  - quiet warnings and tells raised;
  - no echo on the parry;
  - a softer Rán's hum;
  - shorter plucked rings, so the hearth stays within 8 voices;
  - the raid's calm layers giving way to a louder alarm.

## Deviations
Decision log AU-1 to AU-9, and AP-17: the user kept the extra mockup steps.

## Known issues
- **Medium:** only listening can judge the two tests in the brief: whether the hearth theme
  feels like Chrono Trigger on a cold night, and whether the sea feels like Dredge. That is the
  user's approval step.
- **Low:** until Step 2 the game itself still plays the Stage 5 temporary tones and the
  temporary footsteps (AU-9).
- **Low:** the Stage 6 rescue browser test can time out on a heavily loaded machine.

## Next step ready
WAITING for the user's approval of the sound test page or their changes (Step 2 wires audio
into the game).
