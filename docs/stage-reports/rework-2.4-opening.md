# REWORK 2.4 REPORT: the opening, guidance, world fixes and music fades

In the Book 2 section 23 format: one heading per report field. This builds design addendum 2.4
sections 2 to 6 (decisions DE-16 to DE-31, folded into the books) beside combat v2, which another
session builds in the same working tree at the same time (DE-35 to DE-59). Choices the books leave
open are DE-60 to DE-78 in `docs/decision-log.md` ("Building the opening"). Nothing is committed by
this session; the main session commits. World state version 11 is the combat session's bump; this
work adds its fields to that same migration (`src/persist/openingMigration.ts`, chained after
`migrateCombatV2`). Golden saves were not regenerated (the final pass does that).

## Implemented
- **The played cold open and the waking** (`src/sim/narrative/wreck.ts` `beginOpening`,
  `stepWreckPhase`, `wreckCommand`; `src/scenes/openingView.ts` `coldOpenScene`, `coldBoat`):
  - From the naming screen the game opens at night aboard Thorkel's boat, the steerer at the
    steering oar, which answers the keys at once (the oar's angle is `data-coldoar`); rowers,
    Thorkel at the bow shouting (captioned), rain, lightning, the swell; the strike on the skerry
    at 31 s, black at 34, the waking at 38 (`content/opening.json` rework.coldOpen, inside Book
    10's coldOpen 30 to 45 s; DE-77). The storm is the strand ambience at full wind.
  - The waking: lying in the surf, coughing (`SFX_COUGH`), the view fading in; the first movement
    key gets the steerer up (`ch1.getting_up`), then play. No menus: nothing opens in the first
    ten minutes but the naming screen.
- **Hild in the net and the seax** (`netInteract`, `TASK_CUT_NET`, `cutTicksLeft`):
  - Hild is caught in the old boat's net in the shallows; bare-handed the prompt says "Something
    sharp". The seax lies in the wreck's debris on the way (`content/onfoot.json`, 65.5, 34.5).
  - Holding Interact (or right-click) cuts for Book 10's cutHold (1.5 s); letting go keeps what is
    cut (`src/scenes/session.ts` sends `CANCEL_WORK` on release). Waves break over her every 8 s
    while she waits (`NET_WAVE`). Cut, she is lifted and carried as before.
- **Thorkel's locked chest** (`placeChest`, `nameChest`, `homeOutline`, `wreckSetDown`):
  - The chest washed up on the strand; Hild names it; carrying it shows its home's outline at the
    camp (`fx_outline`, for Book 10's homeOutline 10 s once in view), and set down there it settles
    (`CHEST_HOME`, `SFX_CHEST_THUD`).
  - The key comes from Thorkel's body however the Bran search ends: from Bran at the bier
    (`BRAN`), or taken from the body (`BODY`) if Bran is dead or gone (`stepKey`, `giveKey`).
  - Opened at home with the key: the bow and a quiver (Book 10's starting arrows), his chart
    fragment, three bindings (`ITEM_BINDING`, combat v2's, as Book 10 bindingsFound says), a bone
    comb and a whetstone; the bow's tooltip shows at once; Hild's line about the bow.
- **No stern bow**: the bow on the stern and its line are gone (`content/onfoot.json`,
  `c_hild.bark.bow.01` deleted).
- **Oddi's dilemma over the ship's silver** (`ITEM_SHIP_SILVER`, drawn as `prop_strongbox`; DE-71):
  Oddi's lines and the search reworded; a save's strongbox is renamed by the migration.
- **The bow's first use: the mast stores** (`stepMast`, `lashingHit`, `cutLashing`): the stores are
  lashed high on the broken mast; an arrow through the lashing (the missile API as it is: the
  drawn arrow's path against the lashing's drawn box) parts it, the bundle falls on the flats
  (`BUNDLE_SPLASH`) and is carried up as one load (`ITEM_MAST_STORES`, Book 10's mastStoresRd to
  the camp's salt fish).
- **Runa's question** (`runaAsks`, `runaAnswer`, `stepRunaLie`): once her tool chest is safe she asks
  "Where have you put it?" with three answers (the fire, the shelter, the boat); the truth earns
  her trust, a lie is found out when she goes to look (Book 10 runaTruth, runaLiePerWord).
- **Hild walks up at the camp** (`stepWalkUp`): at the first fire's smoke she limps up from the
  strand at the limp speed, gives the shelter aim, and waits by the fire until the sail is raised.
- **The visible shelter raise** (`TASK_RAISE_SHELTER`, `prop_sail_raise`): the folded sail hauled
  up between the oars over six seconds (raise and fill frames), Book 10's 30 minutes and stamina.
- **Every rescued person gets up, goes to camp, works, eats and sleeps under the shelter**
  (`stepRescues`, `wreckHolds`, `bedOf`): set down, a rescued person sits 4 s (rescueGetUp), gets
  up and walks to the camp (at the limp if hurt: DE-63), takes up their day; once the sail is up
  everyone sleeps on its four beds (`content/camp.json` shelterBeds; DE-68).
- **Guidance with no markers** (`src/sim/narrative/aims.ts`; `content/opening.json` aims):
  - 19 aims, each a condition (`src/content/aimSchema.ts`), one journal line and two hints (the
    lint checks both); speech first: an aim is given by a person in earshot, or as a call with its
    direction from the next zone (within Book 10's callCarry), or by Hild when the speaker is not
    yet with the household (DE-69).
  - Stuck help: the first hint after 90 s without progress, the second 90 s later, then up to three
    repeats two minutes apart; quiet in talk and fights (DE-66).
  - The journal (J) shows the current aim as one plain sentence; nothing is drawn in the world.
  - The `REFERS:` string tag (`src/content/strings.ts`, `src/content/steererWords.ts`; DE-74).
- **"Nothing that way"** (`src/sim/land/edges.ts`): walking into deep water, a steep drop, the
  map's edge or the island's end stops the steerer with no sliding above 45 degrees, captioned by
  kind ("The water's too deep" and the rest) once per Book 10 cooldown; linked edges still lead on.
- **Doors** (`src/sim/land/doors.ts`; zone plan `doors`): the broch's door (S1, barrable from inside)
  and the lean-to's flap (S0, once raised) swing open when walked into, block movement and sight
  while shut, close behind after Book 10's closeAfter, each with its sound and caption.
- **The shelter's inside** (`openingView.ts` `decorate`): standing under the raised sail, its cloth
  is cut away (`fx_shelter_cut`), showing the furs, gear and drying clothes, the fire's warm pool
  and the smoke curling out under the edge.
- **The Hag's Stone** (`startHagStone`, `stepHagStone`, `hagCamera`): the hush, the cold grade, the
  hold (Book 10 2.5 to 6.5 s), the gust, the settle; the camera's small pull; the birds gone quiet;
  a figure glimpsed in the mist every second showing (Book 10 figureEvery); the first evening's
  pale light seen from the strand in the west once the searches are placed.
- **Music fades** (`src/audio/music.ts` `MusicFades`, `fadeGain`, `layerJoinAt`;
  `src/audio/synth/sequencer.ts`): a piece fades in over 8 s from one layer, the others joining on
  bar lines over 25 s (the middle of Book 10's 20 to 30; DE-76), and fades out over 6 s; a change
  cross-fades; only stingers are sharp. In rework worlds music starts at the first fire.
- **The first five minutes**: the cold open, the waking, tactile wins (the cut, the chest's weight,
  the flint's sparks and the flame taking, the sail hauled and filling), curiosity rewards (the
  silver arm-ring in the rock pool: `VALUABLE`, to RES_SILVER, DE-70; the seal sinking and the
  standing gulls lifting as the steerer comes near; the crab), Hild's line about the old boat, and
  the first night's fire scene with Hild (`fire.night`: her grief between the jokes, ending on the
  morning's aims).
- **The dusk fight** (the combat session's): the opening's guidance and the fire scene wait for it
  (`ch1.dusk_over`), and nothing in the opening steps while a fight is near (`fightNear`).
- **Sounds** (`src/audio/synth/opening.ts`, 17 generated effects with captions; `content/audio.json`
  events): the strike, the cough, the net parting, the chest dragged and set down, the flint, the
  sail, the key and lid, the lashing, the splash, the ring's clink, the door's creak and knock, the
  flap, the bar, and the Hag's Stone's drone, whisper and gust.
- **Art** (`assets/art/authoring/rework24_art.py`, 17 palette-indexed sheets; the arm-ring frame
  in `missiles.py`): see **Art check**.
- **Captures** (`src/tools/art/captureOpening.ts`, `npm run capture -- rework-2.4-opening`): the cold
  open and waking played with the keys, then the opening's bot playing in the page through a
  player's commands, every tick a real frame of the game.
- **Older stages re-checked** against the new flow: Stage 6 (opening, rescue, controls), 7, 8, 10,
  11 and 12 unit, scenario and browser tests; the bots (`src/tools/play/wreckBot.ts`
  `playToCamp`, `openingBot.ts`, `chapterRun.ts`); the golden-save scenarios
  (`src/tools/saves/golden.ts`, golden 8 and 9 now through `playToCamp` and the chest, key and mast).
- **Test hooks** (`src/scenes/camp.ts`; DE-72): `camp=broch` sets what the opening has done by then;
  `shelter=down`, `searches=dusk`, `scene=fire`, `opening=full` and `kit=seax`.

## Tests
- `npm run lint`: content lint clean (1346 strings, 507 registered IDs); art lint clean (139
  sheets, 30065 frames, 0 placeholders); Prettier clean on this session's files. ESLint fails on two
  of the combat session's files (`src/tools/art/captureCombat2.ts`, `tests/browser/combat2.spec.ts`:
  `type` for `interface`) and Prettier warns on `tests/browser/combat2.spec.ts`; left alone.
- `npm test` (last full run): 666 passed, 2 failed, 1 skipped (669 tests in 48 files). The two:
  golden save 10 "is reproduced exactly by its scenario" (expected until the final pass
  regenerates the golden saves: the scenario now plays the new opening) and the art test "finds
  generated sheets and atlases in step with their sources", which timed out at 35 s while two
  captures ran; alone it passes. Earlier full runs under the same load also failed "save in under
  200 ms" (passes alone) and the combat session's art frame counts (since fixed by that session).
- `npm run build`: succeeds (the usual chunk-size warning).
- `npm run test:browser -- --project=chromium`: RESULTS_BROWSER.
- `tests/browser/standard.spec.ts` now opens the strand straight in play (`view=play`): through
  the naming screen it would measure the cold open at sea, not the strand (DE-67). On the strand:
  96.2% motion with the camera still, 4.58 ms script per frame (budget 5.5); reduced motion and
  low detail 62.8% (threshold 50%). The cold open itself measures 3.0 to 3.5 ms a frame.
- Older browser tests brought to the new flow: `opening.spec.ts` (control within five seconds is
  now the cold open's steering oar; the rescue fetches the seax and cuts the net),
  `controls.spec.ts` (the net cut with a held right-click), and Stages 7 and 8 through the camp
  hooks (DE-72).
- New: `tests/unit/opening2.test.ts` (23 tests, all pass) and `tests/browser/opening2.spec.ts` (5
  tests, stepped and waiting on the game's own state, all pass).

## Gate checks
Each is a test in `tests/unit/opening2.test.ts` unless named.

| Check | Result | Evidence |
|---|---|---|
| The cold open: control at once, its length, the waking, no more than the oar to steer | PASS | "the cold open", `opening2.spec.ts` (oar > 0.3 within 10 frames; WAKING, PLAY; Hild's call within 15 s) |
| Hild in the net: no blade, the hold-to-cut, let go keeps progress, freed | PASS | "the net and the cut"; `opening2.spec.ts` (held E, "The net parts"); `opening.spec.ts` (bare hands, the seax, the cut); `controls.spec.ts` (held right-click) |
| First-minutes targets (seax by 1.5, Hild by 2.5, chest by 4, fire by 5, shelter by 6 min) | PASS | "the first minutes" (bot), and the chapter run below |
| The chest's outline and home; Hild walks up; the visible shelter raise | PASS | "the chest home, the walk up, the visible shelter" |
| The key from the body however the Bran search ends; the chest opened, the bow's tooltip | PASS | "key and chest", "the key on each Bran outcome" |
| The mast shot: a hit cuts the lashing, a miss does not; the bundle carried up | PASS | "the bow's first use" (2 tests) |
| Runa's "Where have you put it?": the truth, and a lie found out | PASS | "Runa truth", "Runa lie" |
| Rescued people sleep under the shelter over two nights (seeded run) | PASS | "rescued people sleep under the shelter" |
| Aims: journal line and two hints for every aim; the stuck-help timings; quiet in talk | PASS | "aims and journal", "stuck timings", "quiet during talk"; `opening2.spec.ts` (J) |
| Edges by EdgeKind, the cooldown, no sliding; linked edges lead on | PASS | "edges"; `opening2.spec.ts` ("The water's too deep") |
| Doors block movement and sight; open, close after; the flap | PASS | "doors and the flap"; `opening2.spec.ts` (the broch door 1.00 then 0.00) |
| The Hag's Stone timing (hush, cold, hold, gust, settle; figure) | PASS | "the Hag's Stone" |
| The music gain envelope (fade in, layers joining, fade out, cross-fade) | PASS | "music fades", PiecePlayer envelope; the render below |
| REFERS lint | PASS | "REFERS" |
| chapterRun plays to the launch | PASS | below |

**The chapter run** (`node src/tools/play/chapterRun.ts chapter-1 [human]`, seed chapter-1):

| Mark | Bot pace | Human pace | Book 10 target |
|---|---|---|---|
| woke | 0:00 | 0:00 | |
| seax | 0:05 | 0:05 | by 1:30 |
| hild_freed | 0:37 | 0:37 | by 2:30 |
| at_broch | 1:03 | 1:09 | |
| chest_at_camp | 1:07 | 1:13 | by 4:00 |
| fire | 2:10 | 2:22 | by 5:00 |
| shelter | 2:59 | 3:11 | by 6:00 |
| hild_tended | 3:59 | 4:19 | |
| dusk_fight | 10:42 | 10:42 | (dark; the scavengers left alone) |
| first_night | 11:24 | 11:24 | |
| search_oddi | 12:57 | 13:12 | |
| search_runa | 14:36 | 15:10 | |
| first_combat | 16:33 | 17:16 | |
| search_bran | 16:39 | 17:23 | |
| bow | 18:05 | 18:50 | 20 to 30 min |
| stores | 19:28 | 20:16 | |
| hull | 50:09 | 51:12 | |
| rigging | 50:42 | 51:45 | |
| oar | 50:50 | 51:52 | |
| fitting | 51:36 | 52:57 | |
| rites | 59:22 | 60:16 | |
| launch | 59:31 | 61:41 | |
| chapter_end | 59:49 | 62:19 | |

The bow comes at 18 to 19 minutes, a little before Book 10's 20 to 30 (flagged). The long gap
from the stores (about 20 min) to the hull (about 50 min) is the repairs' waiting (the boards, low
water for the rigging, the oar's bargain or fight), unchanged by this work.

## Art check
- **New sheets** (`assets/art/authoring/rework24_art.py`, compiled; contact sheets at 1x and 4x
  in `docs/art/rework-2.4/opening/`, each inspected): `prop_strongbox`, `prop_stores_bundle`,
  `prop_mast_broken` (lashed and cut), `prop_chest_open`, `prop_sail_raise` (folded, raise 8,
  fill 6), `prop_shelter_inside` (furs, gear, drying clothes), `prop_door_broch` (4 frames and
  barred), `prop_flap_sail`, `prop_rockpool`, `prop_cold_figures`, `prop_cold_sail`, `fx_outline`,
  `fx_net` (net 4, cut 3, wave 6), `fx_opening` (fibre, spark, puff, spray, drip, rain, smoke,
  light), `fx_hag_mist`, `fx_hag` (glow 4, figure 2), `fx_shelter_cut` (16 frames); and the
  arm-ring lying (`prop_pickup` `silver_arm_ring`). No people were drawn or redrawn: the cold
  open's rowers and Thorkel use the approved crew and Thorkel sheets, the waking uses the
  steerer's `downed` frames (DE-78). No placeholders.
- **The first five minutes** (`docs/art/rework-2.4/opening/`, captured from the real game):
  - `first-five-minutes.gif`: 288 frames at 10 a second (28.8 s), 3.72 MB, the middle 320 x 180
    of the view at 1x. The cold open steered with the keys, the strike and the black, the waking
    in the surf, then the bot's play in real frames: the seax, the net cut, Hild carried up,
    Thorkel's chest dragged home, driftwood, the first fire, Hild arriving, the sail raised.
    Key moments play at their own pace; the walks between are sped up.
  - `first-five-minutes-strip.png` (and @2x): ten key frames, 5 x 2 at 1x: cold open, the strike,
    waking, the net cut, Hild carried up, Thorkel's chest, the first fire, Hild arrives, the sail
    raised, under the sail. Inspected: the cold open reads at night with the boat, the rowers and
    the sail in the rain; the waking shows the steerer lying in the surf; the shelter's inside
    shows the furs, the gear and the drying clothes with the fire's pool.
  - In the capture (game time from the cold open's first frame; the cold open and the waking take
    about 41 s): the net cut at 75.8 s, Hild carried at 77.3 s, the chest lifted at 81.0 s, the
    first fire at 170.9 s, Hild at the fire at 212.6 s and the sail raised from 214.0 s.
- **Motion with the camera still** (Book 7 section 14, 80% of cells):
  | View (`docs/art/rework-2.4/opening/views/`, 1x and 4x, with motion maps) | Moving cells |
  |---|---|
  | Hild in the net on the strand | 93.4% |
  | The camp by day, the sail raised, the fire lit | 85.8% |
  | Under the sail at night (the cloth cut away) | 90.3% |
  | The broch's door (S1) | 82.3% |
  | The strand (`standard.spec.ts`) | 96.2% |
  | Book 7 threshold | 80% |

  Every view meets the threshold; the reference (`docs/art/reference/wreck-strand-target.png`) is
  100% (89.2% with its clouds frozen). The door is the lowest: the broch's stone walls fill much of
  that view.
- `docs/art/stage-06-rework` was not rewritten; no proposed copies were touched.

## Balance
- Every number is read from `content/balance.json` (Book 10 section 25's rows, parsed in
  `src/content/openingBalance.ts`; the limp, starting arrows and the arm-ring's silver from their
  own sections). No Book 10 row was added or changed by this work.
- Where Book 10 gives a range, the build takes: the cold open 38 s (DE-77); layersJoin 25 s
  (DE-76); the Hag's hold Book 10's default 4 s.
- **Listening back** (`npm run audio:render -- opening`; peak / RMS of each render, no item clips):

  | Sound | Peak | RMS |
  |---|---|---|
  | The strike | 0.522 | 0.0383 |
  | Coughing | 0.153 | 0.0165 |
  | The net parts | 0.120 | 0.0120 |
  | The chest dragged | 0.150 | 0.0136 |
  | The chest set down | 0.316 | 0.0418 |
  | Flint | 0.205 | 0.0124 |
  | The sail raised | 0.189 | 0.0395 |
  | Key and lid | 0.101 | 0.0196 |
  | The lashing parts | 0.093 | 0.0122 |
  | The bundle's splash | 0.296 | 0.0209 |
  | The ring's clink | 0.100 | 0.0231 |
  | A door's creak | 0.145 | 0.0252 |
  | A door's knock | 0.205 | 0.0279 |
  | A flap | 0.098 | 0.0053 |
  | A bar dropped | 0.257 | 0.0295 |
  | The Hag's drone and whisper | 0.098 | 0.0200 |
  | The Hag's gust | 0.102 | 0.0095 |
  | The hearth theme with its fades | 0.511 | 0.0776 |

  The first render had the creak, the flap, the net, the cough, the key and the drone too quiet to
  hear over the strand (the creak at 0.004 peak); they were raised to sit with the existing work
  sounds (Stage 11: 0.25 to 0.34 peak, 0.02 to 0.04 RMS). The hearth theme's render shows the
  envelope: RMS 0.002 in the first second rising to 0.067 by the eighth, the layers filling to
  about 0.10 by 25 s, then 0.08 falling to 0.0007 over the 6 s fade from 34 s.

## Deviations
DE-60 to DE-78 in `docs/decision-log.md` ("Building the opening"), each with its reason.

## Known issues
- **No rain yet** (minor): there is no rain in the world, so the rain on the sail and the drops
  beading on the cloth are not shown; `AMB_RAIN_CLOTH` is registered but unused. `AMB_COLD_STORM`
  is registered but the cold open uses the strand ambience at full wind.
- **The mast stores at high tide** (minor, flagged, DE-64): the bundle falls on the flats, so it is
  fetched at low water only.
- **The Hag's Stone** (cosmetic): the plants' stilling scales the wind's effect on them; the glow
  uses pale sea and sky steps and the grade rather than a reserved accent colour.
- **The bow at 18 to 19 minutes** (minor, flagged): Book 10 asks for 20 to 30.
- **Hints for the stores aim** are Hild's until Bran joins (by design, DE-69).
- **The combat session's files** (not this work; left alone): ESLint's two `interface` errors and
  Prettier's warning above.
- **Golden save 10** "is reproduced exactly by its scenario" fails until the final pass regenerates
  the golden saves (the scenario now plays the new opening); golden saves 1 to 10 load.

## Flagged for the user's review
- DE-64: move the mast so the stores fall on shingle, or keep Book 9's flats and the low water.
- The bow's time (18 to 19 min against 20 to 30).
- DE-62 and DE-63: Hild on the strand until the smoke; the limp only on the walk home.
- DE-67: the cold open plays only for a new game (and `opening=full`).
- DE-76: music waits for the first fire in the new opening.

## Next stage ready
NO: this is a change request after the Build 1 gate (DE-33). The rework stops here for the user's
playtest of the opening together with combat v2.
