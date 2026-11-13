# REWORK 2.5 REPORT: on-screen text, the storm opening, and 2.4's unbuilt non-combat work

In the Book 2 section 23 format: one heading per report field. This builds design addendum 2.5
sections 2 and 3 (decisions DF-11 to DF-17, folded into the books) and DF-21's non-combat items,
beside the combat rebuild (DF-1 to DF-10) and the rescue fix (DF-18), which other sessions build in
the same working tree at the same time. Choices the books leave open are DF-50 to DF-70 in
`docs/decision-log.md` ("Building on-screen text and the storm"). Nothing is committed by this
session. No world-state version was needed: the only save change is inside the existing version 10
to 11 step (DF-51).

## Implemented
- **The caption view** (`src/ui/captions.ts`, `CaptionDirector`; DF-11): at most one information
  line and one speech line; a new line replaces the old with Book 10's 0.15 s cross-fade (the old
  one fades out under it in the same slot, `p.out`, so lines never stack or queue); lines offered
  in one frame "arrive together" and the highest class shows; a repeat within 20 s is not shown;
  information holds 2.5 s, speech 1 s + 0.05 s a character (2 to 5 s), each fading in over 0.15 s
  and out over 0.4 s; a lower class never cuts a higher one short (DF-54); information captions can
  still be turned off apart from speech.
- **Fights** (`inFight`): Book 10's definition (a hostile alert to the steerer within 12 tiles, or a
  blow struck or taken by the steerer in the last 4 s). In a fight only speech and `SAFETY` lines
  show; the newest of the most important other line is held and shown 1 s after the fight if it is
  under 8 s old, else dropped.
- **The text audit** (`src/ui/textAudit.ts`; Book 8 section 10; DF-13, DF-69): every information
  line goes through it by its string key, from the play view and from the audio router's sound
  captions (`AudioRouter.takeCaptions`). Kept lines have their class (safety, direction, story,
  sound); a key with no row is never shown. **Combat sounds are never captioned, in any mode**
  (DF-80 withdrew DF-14's option, so no option was built; any `caption.sfx.*` key the combat
  rebuild adds is cut by the audit). In the play view:
  - cut: someone walking up, a foe yielding or running, healing (and "Too spent"), doors, the
    opening's actions and moments (the net, the flint and flame, the chest, the storm, the ring),
    the stone's hush and gust, music, the other stingers, combat and missile sounds, work, camp,
    repair, rites and launch sounds and lines;
  - merged: Thorkel's shout into his speech line; the prompt line's notices into refusal words at
    the cursor ("Below the tide line", "No room", "Hands full"); a refused job into the talk panel
    under the line it answers; a refused crew order into the person's bark (DF-58);
  - kept: speech; a distant call's direction; search and talk information (in the talk panel while
    talking); brought home and left behind; the safety lines (edges, the neck's gale, the horn, the
    supernatural tells, a blade over a downed ally, "Down. An ally can lift you", and "An arrow
    whistles past" with its direction when the shooter is out of view, DF-59); the pale light with
    its direction; the stone's whisper; the dispute stinger; "They saw you take it".
- **Placement** (`src/ui/overlay.ts` `showCaptionSlots`): the information slot over the speech slot,
  bottom centre, within the lowest 16% of the view just above the hotbar; the slot's name moves
  beside the hotbar's left end (DF-57, flagged).
- **Tutorial prompts and tooltips** (`src/ui/prompts.ts`; DF-12, DF-56, DF-68): the move hint and a
  timed task's press fade out over 0.5 s while a speech line, a direction or story line, a story
  beat, a scene or a talk shows, come back 2 s after, and go for good once done (moving: 2 tiles
  walked; the press: pressed once); interaction prompts hide during beats, scenes and talk; a pickup
  tooltip shows 8 s of play (time hidden does not count) or until its controls are used twice.
- **The cursor** (`src/scenes/cursor.ts`; DF-15, DF-67): hidden through the cold open, the strike and
  black, the waking until the first input, the first night's fire and every scene that takes
  control, the rites and the launch; it shows again on the first mouse movement once control
  returns, or at once when a panel, the sea map, game over or the help page offers a pointer.
- **The storm** (`src/scenes/storm.ts`, `src/scenes/openingView.ts` `coldOpenScene`; DF-16, DF-17,
  DF-61 to DF-66), all from Book 10 section 25 on the presentation's own seeded stream:
  - lightning 6 to 14 s apart with the scripted strike at 25 s showing the skerry; each a double
    flicker (bright 4 ticks, dim 3, bright 3, then a 0.4 s fade; never more than two flashes in a
    second) lighting ship, sea and land to 70% of the day grade with hard shadows away from the
    strike and a forked bolt far off; with reduced flashes one soft swell at half strength;
  - thunder 0.6 to 3 s after each flash by its distance (near: a crack and a 4 s roll; far: a
    rumble);
  - two layers of mist (`fx_storm_mist`) drifting downwind at 0.3 and 0.6 tiles a second, about 27%
    cover, never over the steerer or the steering oar; the night's light varying 12% in drifting
    8-tile patches (a new post-pass term, `patches`); the stern lantern's warm 3-tile pool swinging
    with the ship;
  - the camera swaying 3 px with the pitch and 2 px with the roll, in whole pixels, none with
    reduced motion;
  - swells 3 to 4 tiles apart rolling in at 1.2 tiles a second with foam streaks along their
    crests, drawn only over open sea; a wave breaking on the hull every 3 to 6 s in 10 to 18 spray
    particles 20 to 40 px up, falling back across the deck; green water over the gunwale every 8 to
    12 s, sheeting off through the scuppers; 80 to 120 raindrops slanting 25 degrees;
  - the ship pitching (12 strips lifted in 1 px steps, the bow up and down 4 px over 3.2 s) and
    rolling (three roll frames over 5.4 s, the mast's head leaning 2 px), the people, Thorkel, the
    sail and the lantern riding the deck (DF-62).
- **Storm sounds** (`src/audio/synth/storm.ts`; DF-66): `SFX_THUNDER_NEAR`, `SFX_THUNDER_FAR`,
  `SFX_WAVE_HULL`, `SFX_GREEN_WATER`, and `AMB_COLD_STORM` (rain on the sea and the deck, the sail
  flogging, timber groaning and the mast creaking in time with the pitch and roll) under the
  strand's wind at full storm, stopping at the black. Registered in `content/ids.json` and
  `content/audio.json`, on the sound test page (`storm:bed`, `storm:rain`) and in the renders.
- **2.4's unbuilt items (DF-21)**:
  - rain on the sail cloth with drops beading and running on it (`fx_rain_cloth`) and its patter
    under the sail (`AMB_RAIN_CLOTH`), in the first rain over the island (Book 10 `firstRain`, new,
    DF-60, flagged);
  - the Hag's Stone's glow in a reserved accent of its own, *The Cailleach's cold light* (DF-50,
    flagged);
  - Runa, seriously wounded, works the boat seated beside its bow, off the steerer's work tile
    (DF-52);
  - saves from before version 11 get the camp's bindings when the migration has Book 10; the game's
    reload passes it (DF-51);
  - the mast stores (the user's DF-82): the bundle lands in the stream's mouth off the outcrop's
    foot, ankle deep at every tide and reached without a swim, drawn falling under the lashing and
    carried there by the swell (DF-53); the bot no longer waits for low water;
  - the timing: measured, not changed (DF-70; below).

## Tests
- `npm run lint`: clean (ESLint, Prettier, content lint: 1364 strings, 518 registered IDs; art lint:
  146 sheets, 0 placeholders).
- `npm run build`: succeeds (the usual chunk-size warning).
- `npm test` (last full run, shared tree): **788 passed, 4 failed, 1 skipped** (793 tests in 52
  files). The four are not this work's: golden save 11 "is reproduced exactly by its scenario" (the
  chapter run changes with every session's work; the golden saves are remade in the final pass),
  the two Seal Cave theft scenarios (`repairs.test.ts`) and "the bow cannot be had before the chest
  is opened" (`missiles.test.ts`), both moving the steerer through the combat rebuild's new
  acceleration. New: `tests/unit/text25.test.ts` (19 tests: Book 10's timings, the caption view and
  a property test over random event streams, the audit, prompts and tooltips, the cursor),
  `tests/unit/storm25.test.ts` (17 tests: Book 10's storm numbers, lightning and thunder, the
  two-flash limit, reduced flashes, sway, pitch, roll, waves and spray, green water, rain, mist
  cover from the sheet, the first rain, the hull's geometry, the reserved accent), and 4 more in
  `tests/unit/opening2.test.ts` (the mast stores at every tide and at high water, old saves'
  bindings, Runa seated). Updated: `palette.test.ts` (the fifth accent), `art.test.ts` (the new
  sheets), `saves.test.ts` golden save 4 (the bindings the migration now lays).
- `npm run test:browser -- --project=chromium` (full suite, shared tree under heavy load from the
  other sessions): **74 passed, 3 failed**: `sound.spec.ts` counts 33 sound buttons and finds 40 (the
  combat rebuild's seven new cues, not this work); `standard.spec.ts` and `storm.spec.ts`'s frame
  budget read 6.29 and 9.42 ms with the machine at a load of 10 on 4 cores. Run again with one
  worker as the load fell: the strand **96.4% moving, 3.66 ms**, passed; the cold open **97.4%
  moving, 1.80 ms** once its start-up has settled, passed (the spec now reads the smoothed cost 7 s
  in, still in the cold open, because its first frames upload the storm's atlases and compile the
  full-detail shaders; the storm's textures are also now drawn once behind the title, `preparePlay`'s
  `storm` step). New: `tests/browser/text25.spec.ts` (5 tests) and `tests/browser/storm.spec.ts`
  (2 tests), all stepped (DE-81) and passing; `opening2.spec.ts` updated for the audit (Thorkel's
  shout is his speech line; the net and the door are not captioned), passing.
- The audit, counted over every `caption.*` string (176): **29 kept, 110 cut, 36 combat or
  missile sounds cut (never shown in any mode), 1 merged** (Thorkel's shout). Over Book 8 section
  10's 30 message kinds: 14 kept, 8 cut, 4 kept in part (the Hag's Stone, stingers, missile sounds,
  work sounds: one or two kept each), 2 merged (Thorkel's shout; the prompt line's notices, with a
  refused job and a refused order), and 2 never in play (the sound test's ambience; strings never
  shown).

## Gate checks
| Check | Result | Evidence |
|---|---|---|
| No more than two lines at once (one information, one speech), many messages at once | PASS | `text25.test.ts` "shows at most one ...", property test over random streams; `text25.spec.ts` "a burst of messages" (every frame for 2 s) |
| No stacking; repeats suppressed | PASS | `text25.test.ts` "replaces the old ...", "suppresses a repeat ..."; `text25.spec.ts` "a repeat within 20 s" |
| In a fight only speech and safety lines; the held line after | PASS | `text25.test.ts` "in a fight ...", "drops the held line ..."; `text25.spec.ts` "in a fight" |
| Tutorial prompts fade in story beats and speech, vanish once done; tooltips | PASS | `text25.test.ts` "tutorial prompts and tooltips"; `text25.spec.ts` "a tutorial prompt fades" |
| The audit: a verdict for every caption string and cue; no combat sound ever shown | PASS | `text25.test.ts` "the text audit" (3 tests) |
| The cursor hidden in cinematic moments | PASS | `text25.test.ts` "the cursor"; `text25.spec.ts` "the cursor is hidden" |
| Lightning, thunder timing, sway, pitch and roll in range | PASS | `storm25.test.ts` (17 tests); `storm.spec.ts` "the storm" (every tick of the cold open in the page) |
| The cold open: 80% moving with the camera still; frame cost within budget | PASS | `storm.spec.ts`; `npm run capture -- rework-2.5-storm` |
| Mist cover 20 to 45%, never over the steerer or the oar | PASS | `storm25.test.ts` (rasterised from the sheet) |
| The mast stores in wading depth at any tide, fetched at high water | PASS | `opening2.test.ts` (2 tests) |
| Old saves get the camp's bindings | PASS | `opening2.test.ts`, `saves.test.ts` golden save 4 |
| Runa seated at the boat while wounded | PASS | `opening2.test.ts` |

## Art check
- **New sheets** (`assets/art/authoring/storm25_art.py`, palette-indexed, compiled; contact sheets at
  1x and 4x in `docs/art/rework-2.5/storm/`, each inspected): `ship_t1_storm` (the approved T1 hull
  cut into 12 strips, three rolls, the water lapping in 4), `ship_t1_storm_mast` (three rolls, the
  pennant in 4), `fx_storm` (foam 6, crest 4, burst 6, green water 8, bolt 3), `fx_storm_drops`
  (spray 4, scupper 4, rain at 25 degrees 4, lantern 2), `fx_storm_mist` (low and high banks in
  ordered dither, 2 each), `fx_rain_cloth` (12 frames of beads growing and running on the lean-to's
  canvas, drops from its edge); `fx_hag`'s glow recoloured into its new reserved accent (DF-50).
  No people were drawn or redrawn (DF-62, flagged). No placeholders; art lint clean (146 sheets).
- **The storm opening, from the real game** (`npm run capture -- rework-2.5-storm`,
  `src/tools/art/captureStorm.ts`):
  - `storm-opening.gif`: 265 frames at 6 a second, **3.97 MB**, the middle 320 x 180 at 1x, from
    the first frame through the strike and the black to the waking; frames a tick or two apart
    round each strike so the double flicker shows.
  - `storm-strip.png` (and @2x): a wave breaking, the storm, the mist and swells, the lightning's
    bright frame (ship, sea and the skerry's rocks lit, a bolt far off, the sail bright), the
    lightning fading, the strike.
  - `views/storm.png`, `views/lightning.png` (and @4x). Inspected: the sea is no longer a flat blue;
    swells with foam lines, the lantern's pool, the mist banks and the rain read at night; the
    lightning frame lights the whole scene with the rocks of the skerry plain ahead.
- **The first five minutes, recaptured** (`npm run capture -- rework-2.4-opening`,
  `docs/art/rework-2.4/opening/`): `first-five-minutes.gif` 302 frames, 4.35 MB (2.4's was 3.72 MB:
  the storm's rain and mist cost a little more); the strip's first two frames now show the new
  storm. The shelter at night (21:30, in the first rain) shows the rain falling over the camp;
  outside the sail the beads on the cloth show as bright points and darker wet runs.
- **Motion with the camera still** (Book 7 section 14, 80% of cells):

  | View | Moving cells |
  |---|---|
  | The cold open, full detail (`views/cold-open-motion.png`) | 97.2% |
  | The cold open, reduced motion and low detail | 96.7% (threshold 50%) |
  | The cold open in real time (`storm.spec.ts`) | 97.4% (1.80 ms) |
  | The strand (`standard.spec.ts`) | 96.4% (3.66 ms) |
  | Hild in the net / the camp by day / under the sail at night / the broch's door (recaptured) | 93.8% / 85.6% / 93.1% / 82.1% |

- **Frame cost** (script per frame, smoothed; Book 2 budget 5.5 ms): the cold open 1.76 ms stepped (the capture) and 1.80 ms in real time once settled; the strand 3.66 ms (2.4: 4.58). Under the other sessions' load the same specs read 6 to 9 ms; `drawStorm` itself costs 0.09 ms a frame (272 sprites) in Node.
- `docs/art/stage-06-rework` and `docs/art/mockups` were not rewritten.

## Balance
- Every number is read from `content/balance.json` (`src/content/presentationBalance.ts`:
  `parseTextBalance` for Book 10 section 21 "On-screen text", `parseStormBalance` for section 25
  "The storm"; strict patterns, so a changed wording fails loudly). `content/onfoot.json`'s
  `tipSeconds` and `content/audio.json`'s `captionSeconds` are no longer read by play.
- Book 10 rows added (DF-60): section 25 `firstRain` and `rainCloth`; `npm run balance` run.
- **Listening back** (`npm run audio:render -- storm`; peak / RMS):

  | Sound | Peak | RMS |
  |---|---|---|
  | Thunder, near (`SFX_THUNDER_NEAR`) | 0.319 | 0.0193 |
  | Thunder, far (`SFX_THUNDER_FAR`) | 0.108 | 0.0195 |
  | A wave on the hull (`SFX_WAVE_HULL`) | 0.297 | 0.0567 |
  | Green water (`SFX_GREEN_WATER`) | 0.208 | 0.0274 |
  | The storm bed under the full-storm wind (`AMB_COLD_STORM`) | 0.546 | 0.0928 |
  | Rain on the sail cloth (`AMB_RAIN_CLOTH`) | 0.087 | 0.0093 |

  The first render had the far thunder at 0.038 peak and green water at 0.116, too quiet under
  the storm; both were raised to sit with the opening's other effects (0.25 to 0.5 peak, 0.02 to
  0.06 RMS). Rain on the cloth is meant to be soft: it is heard only under the sail.

## Deviations
DF-50 to DF-70 in `docs/decision-log.md`, each with its reason.

## Known issues
- **The first rain is presentation only** (minor, DF-60): the simulation's rain (sight x0.7, noise
  x0.6) does not apply in it until weather is built.
- **No bracing frames** (minor, DF-62): the people on deck ride the pitch in their rowing frames.
- **The skerry and the land are faintly visible between flashes** (cosmetic): Book 7 says they show
  only in the flashes; the night grade is darker now, but the rocks still read as dark shapes.
- **The sound test page still captions combat sounds** as the names of the sounds being auditioned
  (`sound.spec.ts` checks "Parry"); it is a listening page, not play. The play view and the shell
  view never show one. To be decided with the user if DF-80's "any mode" covers that page.
- **Cut caption strings stay** (DF-69): the 2.4 combat cues keep their `caption.sfx.*` keys (the
  audio coverage test asks a caption per cue); the audit never shows them, and the test proves it.
  The combat agent's new cues use a `drawn` field instead; the older cues could move to it later.
- **The opening's timing** (DF-70): the bow at 22 min 9 s (inside 20 to 30), the chapter at 82 min
  16 s at a human pace (outside 45 to 60, longer than 2.4's 62), measured with the other sessions'
  work in progress; not changed here.
- **First-five-minutes GIF** is 4.35 MB (2.4's 3.72 MB): the storm's rain and mist compress less.
- **Golden save 11** is not remade (the final pass does that).
- Not this work (left alone): the four unit failures and the sound test's button count above;
  `tests/unit/probe25.test.ts` is another session's probe.

## Flagged for the user's review
- DF-50: a fifth reserved accent for the Hag's Stone (Book 7 section 08 lists four).
- DF-57: the slot's name beside the hotbar rather than above it.
- DF-60: the first rain's hours (20:00 on day 1 to 04:00 on day 2), presentation only until weather.
- DF-62: no new bracing frames for the people on deck (they ride the pitch in their rowing frames).
- DF-53: the mast stores carried by the swell to the stream's mouth, 4 tiles from under the lashing.
- DF-70: the bow and the chapter's length left outside Book 10's ranges.

## Next stage ready
NO: this is part of the 2.5 change request after the Build 1 gate (DF-20); it stops for the user's
playtest with the combat rebuild and the rescue fix.
