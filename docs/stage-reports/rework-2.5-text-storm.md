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
{{TESTS}}

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
| The cold open: 80% moving with the camera still; frame cost within budget | {{MOTION}} | `storm.spec.ts`; `npm run capture -- rework-2.5-storm` |
| Mist cover 20 to 45%, never over the steerer or the oar | PASS | `storm25.test.ts` (rasterised from the sheet) |
| The mast stores in wading depth at any tide, fetched at high water | PASS | `opening2.test.ts` (2 tests) |
| Old saves get the camp's bindings | PASS | `opening2.test.ts`, `saves.test.ts` golden save 4 |
| Runa seated at the boat while wounded | PASS | `opening2.test.ts` |

## Art check
{{ART}}

## Balance
- Every number is read from `content/balance.json` (`src/content/presentationBalance.ts`:
  `parseTextBalance` for Book 10 section 21 "On-screen text", `parseStormBalance` for section 25
  "The storm"; strict patterns, so a changed wording fails loudly). `content/onfoot.json`'s
  `tipSeconds` and `content/audio.json`'s `captionSeconds` are no longer read by play.
- Book 10 rows added (DF-60): section 25 `firstRain` and `rainCloth`; `npm run balance` run.
- **Listening back** (`npm run audio:render -- storm`; peak / RMS):
{{AUDIO}}

## Deviations
DF-50 to DF-70 in `docs/decision-log.md`, each with its reason.

## Known issues
{{ISSUES}}

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
