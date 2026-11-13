# THE USER'S THIRD PLAYTEST, THE INTERFACE: the pause menu and slots, the intro's skip, the stuck spot and the developer menu

In the Book 2 section 23 format. This is the interface, bug-fix and developer-menu part of the
user's third playtest (requests 9 to 12 and their tests; decisions DG-15 to DG-21 folded, DG-70 to
DG-89 built, in `docs/decision-log.md`). The combat part and the story part are built alongside it
in the same tree and report separately; the main session regenerates golden save 11 and writes the
combined report.

## Implemented

**The stuck spot (DG-20; DG-70 to DG-74).** Reproduced first, through the simulation: on day 1 the
low-water window closes at about 19:30. A steerer standing on the tidal flats at the western
outcrop's seaward foot (by the mast's foot and below the lashing, where the bow is used) when it
closed was held: the flats under the footprint became blocking ground and every step tests the whole
footprint, so every step in every direction was refused. At 20:41 the flood is waist deep there, as
in the screenshot. The edge-walk test then found the same cause's second form: small dry humps
inside flats tiles (the drawn rock's height reaches over the tile) that the rising flood rings with
deep water, which the depth rule never lets anyone enter: 17 probe points, three of them at the mast's
foot, the rest at the eastern outcrop, the strand's south rocks and Seal Cave. Nothing else traps:
not the outcrop's rocks, the mast (a prop, not a collision shape), the stream's mouth or the edge
stop.
- The fix is the rule itself (`stepClear` in `src/sim/land/onFoot.ts`, used by the steerer's step,
  everyone's own walk and fighters' walk in `src/sim/land/fight.ts`): closed tidal ground under a
  body is open to it, and its water however deep is wading water, until it leaves the flats
  (tideClosing); a body overlapping blocking ground or a closed doorway may move any way that does
  not deepen the overlap (neverFrozen; `doorOverlap` in `src/sim/land/doors.ts`). Deep water is
  waded at the waist band's pace (DG-71). Every step the old rule allowed is allowed still: golden
  save 11's scenario reproduces its hash exactly with this change alone (checked on a clean copy of
  the tree).
- The edge-walk test (`tests/unit/noTrap.test.ts`) walks every collision edge of every zone at
  every probe tide with the window open and closed and the doors open and shut, through the real
  movement step (DG-73); the user's spot has its own tests: the reproduction (every step refused
  under the old rule, allowed under the new), the simulation played through (onto the flats at
  19:10, held to 20:41, then walked off onto the foreshore), and every edge within 4 tiles of the
  mast's foot, the lashing and the stream's mouth at each night hour of day 1 and at the four tides.

**The pause menu (DG-15 to DG-18; DG-75 to DG-85).** Escape, P and the pad's Start open it
(`src/ui/pauseMenu.ts` for its rules, `src/scenes/pauseMenuArt.ts` for its art,
`src/scenes/pauseMenuView.ts` for its canvas, input and actions, wired in `src/scenes/playView.ts`):
Resume, Save, Load, Settings, Fullscreen, Reset to the start of this day, Controls, Quit to title.
- Under the safe rule it holds time (no tick runs) over the frame it paused, dimmed by two palette
  steps; with a hostile aware it is an overlay over the running world, and a hostile turning aware
  while it holds time starts time again (`MenuController`, unchanged). Escape on a page goes back to
  the list. Music and ambience fall 12 dB over 0.25 s while it holds time; effects, voice blips and
  tells are silenced (`WebAudioEngine.setPaused`); a soft wooden click for each move and choice, a
  lower knock as it opens (`SFX_MENU_CLICK`, `src/audio/synth/interface.ts`).
- **Save and load**: three manual slots and the autosave card (the newest autosave or checkpoint;
  never saved to). Each card shows the day and season, the time, the place's name, how long ago, and
  the screenshot at 1x (160 x 90, the quarter-scale frame as 4 x 4 means, a PNG within 24 KB,
  `src/ui/thumbnail.ts`); an empty slot is a blank cloth card. Autosaves, checkpoints and the
  day-start take the next frame drawn as theirs (DG-80). The header gains the minute, season, zone,
  place and dev mark (`src/persist/save.ts`; `SaveManager.slotViews`, `dayStart`,
  `attachThumbnail` in `src/persist/manager.ts`). One store of saves for the device (DG-78).
- **The safe rule**: Save is refused while an enemy is aware, with "Not while an enemy is aware of
  you." on one line under the list.
- **Reset to the start of this day** loads the `day-start` save written at every waking (day 1:
  the waking in the surf), after one confirmation.
- **Settings**: display, sound (six sliders and mono), play (Second wind, Rán's mercy, chapter
  timings) and the intro (DG-82). **Controls**: every action with its keys, mouse and pad, remapped
  by choosing it and pressing the new key or button (DG-83). **Fullscreen** toggles (DG-85).
- Load, reset and quit each ask once, naming the last save's age; saving over a used slot asks too.
- **The title screen** (`src/scenes/titleMenu.ts`): New game, Continue, Load, Settings (the intro:
  play or skip; fullscreen) and Fullscreen, in the same panel; "Press any key" is gone.

**Skipping the intro (DG-19; DG-86).** Once the cold open has been seen to its end on the device
(stored in the interface settings, `src/input/interfaceSettings.ts`), a Skip button shows at the
bottom right a second in, fading after four seconds until a key is pressed, with a ring that fills
as any key or pad button is held; a full second, or a click, runs the rest of the cold open unseen
to the black and the waking (`src/ui/introSkip.ts`, `src/scenes/introSkip.ts`). The title's
"Intro: skip" leaves it out of every new game.

**The developer menu (DG-21; DG-87).** Built only in a debug build or with `?dev`
(`src/scenes/devMenu.ts`); F3 toggles it (and is no longer quick command 3 there). It reads the
current aim's journal line, the day and time, the frames per second over a second with the slowest
frame, the zone and the tile; and offers skip 6 hours, teleport to the clicked tile and kill the
clicked enemy, each a simulation command (`DEV_SKIP`, `DEV_TELEPORT`, `DEV_KILL`, `src/sim/dev.ts`)
that replays exactly, marks later saves `dev` and stops the chapter's telemetry.

**Book 10's numbers** for all of it are read from `content/balance.json` by
`src/content/interfaceBalance.ts` (saveSlots, thumbnail, thumbnailBytes, pauseDuck, skipHold,
skipShows, devSkipHours, devTeleport, devReadout, and No trap's probeStep, probeOut, escapeDirs,
escapeDistance, escapeTime, narrowest).

## Tests
TESTS_PLACEHOLDER

## Gate checks
The tests the user asked for, all passing:

| Asked for | File | Test |
|---|---|---|
| Pause stops the simulation, except when an enemy is aware | `tests/unit/pt3ui.test.ts`; `tests/browser/pt3ui.spec.ts` | "pause stops the simulation, except when an enemy is aware": no tick and the same hash over any length of pause; ticks run with a hostile aware (a test hostile and a real aware scavenger); a hostile turning aware starts time again; browser: "Escape pauses the world under the safe rule; the menu is drawn over the dimmed frame" |
| Reset to the start of this day restores the right state | `tests/unit/pt3ui.test.ts`; `tests/browser/pt3ui.spec.ts` | "on day 1 (the waking in the surf) and on a later day, after a sleep, keeping settings and every slot" (the state hash equals the day-start header's; a manual slot and the settings unchanged), "after a fight"; browser: "reset to the start of this day goes back to the waking" |
| Save slots round-trip, with the screenshot stored and shown | `tests/unit/pt3ui.test.ts`; `tests/browser/pt3ui.spec.ts` | "each of the three manual slots loads back the same world, with its day, time, place and screenshot", "the autosave slot shows the newest autosave or checkpoint and cannot be saved to", "an old save without a thumbnail or the new header fields lists and loads"; browser: "a save goes to a slot with its day, time, place and screenshot, and loads back" |
| Saving is refused while an enemy is aware | `tests/unit/pt3ui.test.ts`; `tests/browser/pt3ui.spec.ts` | "the manager refuses with its reason, and the menu says why in one line"; browser: "saving is refused while an enemy is aware, with its reason; the world runs on" (a real fight engaged) |
| Fullscreen is offered on the title screen and in the menu | `tests/unit/pt3ui.test.ts`; `tests/browser/pt3ui.spec.ts` | "the title offers New game, Continue, Load, Settings and Fullscreen", "the pause menu's Fullscreen toggles"; browser: "fullscreen is offered on the title screen and in the menu" |
| Intro skip works only after the intro has been seen once, or via the setting | `tests/unit/pt3ui.test.ts`; `tests/browser/pt3ui.spec.ts` | "before it has been seen, holding or clicking never skips", "once seen, a hold of skipHold skips and a shorter one does not", "a skip lands on the same world as a cold open played through"; browser: "cannot be skipped before it has been seen; once seen, holding a key for a second skips it", "the title's "Intro: skip" leaves it out of a new game" |
| The edge-walk no-trap test | `tests/unit/noTrap.test.ts` | one test a zone, five zones: "from every edge of every collision shape, at every tide, the steerer gets clear" |
| A test reproducing the user's stuck spot | `tests/unit/noTrap.test.ts` | "reproduced: on the flats at the seaward foot as the tide closes, every step was refused", "played through the simulation: walked onto the flats at dusk, held there to 20:41, then walked off", "at night at every tide, every edge within 4 tiles of the mast's foot, its seaward foot and the stream's mouth has a way out" |
| The dev menu is absent without `?dev` in a production build, and its actions work with it | `tests/unit/pt3ui.test.ts`; `tests/browser/pt3ui.spec.ts` | "is on only in a debug build or with ?dev", skip, refused in a fight, teleport, kill with no deed, "developer commands replay exactly"; browser (the production build): "is absent from a production page without ?dev: F3 does nothing of it", "with ?dev, F3 opens it; skip, teleport and kill work through commands" |

## Art check
The menu is final palette-indexed art in the interface's timber and wool (Book 7 section 10), drawn
from palette indices with the new menu lettering `assets/art/ui/font_menu.txt` (97 glyphs; DG-75).
Rendered at 1x and 4x over real frames of the game by `node src/tools/art/render-menu.ts` into
`docs/art/playtest-3/interface/`, and inspected at both scales:

- `pause-main` (the list over the dimmed broch), `pause-overlay` (over a running world at the
  dusk, the refusal under the list), `pause-save` (the autosave card and Slot 1 with their
  screenshots, two blank cloth cards), `pause-load`, `pause-settings`, `pause-controls` (arrows
  and pad buttons by name), `pause-confirm`, and `title-menu`.

Inspected: the lettering is crisp and even at 1x and 4x, with descenders; the highlighted row's
notch and cloth read at a glance; the cards' text fits; the screenshots sit at 1x in their frames.
Also seen in the game (Chromium, stepped): the list over the strand and the save page with "Saved".
The skip button and the dev menu are not player art (the dev menu is plain text by Book 7). No
placeholders.

The menu adds no terrain, people or motion to the world, so the Book 7 section 14 standard's
capture is unchanged by it; the stage's gate capture is the main session's.

## Balance
Read, none changed: Book 10 section 21 "Menus and saves" (saveSlots 3, thumbnail 160 x 90 from 4 x
4 blocks, thumbnailBytes 24 KB, pauseDuck 12 dB over 0.25 s), "The intro" (skipHold 1.0 s,
skipShows 1.0 s and 4 s), "Developer menu" (devSkipHours 6, devTeleport 2 tiles, devReadout 1 s);
section 25 "No trap" (probeStep 0.25, probeOut 0.1, escapeDirs 16, escapeDistance 0.5,
escapeTime 1 s, narrowest + 0.25). Deep water's pace takes the waist band's factor (DG-71).

## Deviations
DG-70 to DG-89 in `docs/decision-log.md`. To flag for the user:
- **DG-70**: the cause had a second form (dry humps ringed by the flood); fixed by the rule, not by
  changing 17 tiles of the plans.
- **DG-76**: over a running world (an enemy aware) the menu does not dim the world behind it.
- **DG-78**: saves now live in one store for the device; saves from before this build (kept per
  campaign) are not listed.
- **DG-82**: the combat prompts option is not in Settings yet (the combat build owns it).
- **DG-86**: once the intro has been seen, holding the steering keys for a second also skips it,
  since Book 10 says any key.
- **DG-88**: the menu's opening knock is the click's low variant, not a second sound ID.

## Known issues
KNOWN_PLACEHOLDER

## Next stage ready
NO: this is one part of the third playtest's rework; the user playtests the whole of it at the
Build 1 gate, and Stage 13 waits for the user.
