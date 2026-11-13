# THE USER'S THIRD PLAYTEST, THE COMBAT: finish or let go, the prompts, the teaching foes and the words before a fight

In the Book 2 section 23 format: one heading per report field. This is the combat part of the
user's third playtest (requests 1 to 8 and their tests; decisions DG-2 to DG-11, DG-25, DG-26 and
the combat sounds of DG-29 folded; DG-30 to DG-49 built, in `docs/decision-log.md`, "Building the
combat"). The story part and the interface part are built alongside it in the same tree and report
separately; the main session regenerates golden save 11 and writes the combined report. Nothing is
committed by this session.

## Implemented

**Finish or let go (DG-2 to DG-6).** A foe at or below Book 10 `beatenBelow` (30%) that is
staggered reels for `reel` (90 ticks); one knocked down lies downed (DG-31); one whose band breaks
may beg. Each is a **beaten** state (`beatenOf`, `finishOffer` in `src/sim/land/fight.ts`), and only
then is the choice offered: hold V to finish (one quick blow after the hold), press G to let go
(the new `spare` action, `src/input/actions.ts`). On a pad, while the choice is offered and no other
foe in reach is winding up, the parry button becomes the finisher and interact lets go (DG-46).
- **The finishers**: two for each weapon (seax, axe, spear, sword, Dane axe, club, unarmed),
  standing (on a reeling foe) and lying (downed or begging), with Book 10's frame data, hitstop,
  step and shake (`content/balance.json`, parsed in `src/content/pt3Balance.ts`). One quick blow:
  no torture, no lingering. The steerer's are drawn on both steerer bodies, the heavy build's on
  Bran's and Ketill's sheets (DG-36, DG-37). A finisher writes a killing deed:
  `SURRENDERED_KILLED` on a downed or begging foe, `KILLING` on a reeling one, with the culture's
  row as before.
- **Letting go**: the steerer shouts (a pool of six lines, never the same twice running), the foe
  answers in their own pool or their voice's (Norse, Gaelic) after `spareReply`, drops the weapon
  (it lies as loot, DG-38) and runs. A `SPARED` deed is written with its context. Allies who see a
  foe spared lose `allySpared` cohesion.
- **The spared remembered**: a hidden fate is drawn at the let-go (`addSpared`, on the
  `encounters` stream, DG-33): favour, ambush or gone, from Book 10's bases with the begged, kin
  killed, shamed and robbed modifiers, scaled so gone keeps its floor; with a due day 10 to 40 days
  on and a precursor rumour 3 days before. It is saved in the world (`spared`, version 13). In
  Chapter 1 the island plays it for the scavengers (DG-41): a favour stands aside with its returned
  line and drops its weapon, an ambush speaks its returned line and fights, gone is never placed
  again. The scheduler (`sparedDay`, at every waking) moves a Chapter 1 record to the launch day +
  10 and sends the precursor and the due events; `sparedDueNow` is Stage 13's hook for the road
  ambush, the favours and the grateful survivor.

**The combat prompts (DG-7).** `src/ui/combatPrompts.ts`, drawn by `src/scenes/combatTeach.ts` in a
new overlay region at the screen's right edge (45% to 78% of the height, clear of the captions):
input prompts only, a key cap and its verb, at most two lines, never a report of what happened.
Lock on and strike as a fight starts, parry and dodge at each telegraph aimed at the steerer, block
too with a shield, in the steerer's first three fights only (counted in world state, DG-44), each
retired after three uses (DG-45); the finish-or-let-go choice whenever offered. They fade out at
once while a fighter, a missile or the locked target is drawn under their box, and during story
beats, scenes, talk and narrative speech. The pause menu's settings has the new "Combat prompts:
first fights / always / off" row (Book 10 promptOption).

**The teaching foes (DG-9, DG-10), Chapter 1 only.**
- **Svart parries only**: his guard turns every blow but one struck in the opening his parried
  blow leaves (sparks and the guard-turn frames, a shaft or shield knock), and a missile he turns
  falls at his feet (DG-43). He boasts when he turns a blow, or Bran gives the guidance line after
  a time; the parry prompt shows at each of his telegraphs until a parry lands. At his fold he
  boasts, or Bran says his line.
- **Ketill the red blow only**: every one of his attacks is the red blow: a red glint (the Danger
  tell's reserved palette code) and a scrape on the shield rim, 56 ticks of wind-up, unblockable
  (a guard from the front breaks), 44 ticks of miss recovery after a miss or a dodge (DG-42). He is
  hurt only in his recovery. Bran's and Ketill's guidance lines; the prompt "Dodge the red blow"
  at each first wind-up tick until the lesson is done.
- New frames, palette-indexed, compiled and rendered (see Art check): the red glint, Svart's guard
  turn, the reel, the let-go, the red blow and its miss, and every finisher for both steerer bodies
  and the heavy build.

**The heal prompt (DG-11).** On a hit that leaves the steerer below `healPrompt` (75%) while
carrying a binding or a ration, "Bind the wound" or "Eat" with its key, for `healPromptHold` or until a heal
starts, until three heals are done (world state).

**Enemies speak on first sight (DG-8).** The first who sees the steerer says a warning or a taunt
from their Book 8 pool (Svart's, Ketill's and Conn's own; else the Norse or Gaelic generic pool),
never the line just said by anyone, then the other kind or a short bark as the second line (DG-40),
and the band pauses (`pauseWarning` 150 ticks, `pauseTaunt` 90) before any attack. A steerer who
strikes first ends the pause. Each pool's use is remembered as facts (DG-39).

**The sneak hint (DG-25).** At dusk on day 1, Hild's aim line is followed 2.5 s later by her line
about the dune grass (`sneakCue`, a new Book 10 row, DG-30); the sneak prompt shows within
`sneakHint` tiles of an unaware scavenger, for `sneakHintHold`, at most `sneakHintTimes` times, and
not once the steerer has sneaked within reach.

**Talk at the fold (DG-26).** `src/scenes/foldTalk.ts`: while the scavengers at the fold are
unaware, they talk in ten exchanges (content `combat.json`, `talk`), shuffled and looped, line by
line `lineGap` apart and `exchangeGap` between, read as speech within `overhear` tiles and as a
murmur (blips only, quieter, DG-49) out to `murmur` tiles. It stops for good the tick one notices.

**The sounds (DG-29).** `src/audio/synth/combat3.ts`: `SFX_FINISHER` (three variants by the
weapon's kind: thrust, chop, crushing blow), `SFX_SPARE` (the shout's breath and the weapon
dropped), `SFX_GUARD_TURN` (shaft, shield), `SFX_RED_SCRAPE` (on the tells bus). Each has a drawn
twin in `content/audio.json` and no caption (DF-80). Listened back by `npm run audio:render` (see
Balance for the levels).

**The save (DG-23).** World state version 13: `player.teaching` (fights, heals, uses, retired,
lessons, sneak hint) and `spared` (the records). `src/persist/combat13.ts` migrates a version 12
save: its steerer is treated as past the first fights (three counted, so no prompts in a saved
campaign) and has no spared records. The story part's shelter migration is composed into the same
step; the interface part's slots are its own.

**The scripted players.** The careful player (`src/tools/play/carefulFighter.ts`) lets a beaten foe
go or finishes it, dodges the red blow across and past Ketill and strikes his recovery, parries
Svart; the search bot paths round the fold's walls (DG-48).

## Tests
Run in the shared tree, with the story and interface parts built alongside; failures that are not
this part's are named.

- **New tests of this part**: `tests/unit/pt3combat.test.ts`, 60 tests (spared records and their
  fates, the finishers' frame data by weapon and variant, the teaching foes, first sight, the
  prompts, the heal prompt, the sneak hint, the fold's talk); `tests/browser/pt3combat.spec.ts`,
  4 tests (stepped, DE-81). **All pass.**
- Older tests changed for this part: the older combat tests fight the scavengers as plain outlaws
  (`tests/unit/plainFoes.ts`; DG-48) where they measure other rules; the alarm bark's test reads
  the first-sight line; the archer tests use Conn alone; the finisher test waits the Book 10
  wind-up; `saves.test.ts` counts versions to 13; `art.test.ts` and `strandArt.test.ts` count the
  new frames and the new `fx_red_glint` sheet.
- `npm run lint`: **clean** (ESLint, Prettier, content lint: 1628 strings, 532 IDs; art lint: 149
  sheets, 0 placeholders).
- `npm run build`: **builds** (the usual large-chunk warning only).
- `npm test` (whole suite, last run): **909 tests: 906 passed, 2 failed, 1 skipped.** The two are
  golden save 11's ("loads, matches its hash..." and "is reproduced exactly by its scenario"):
  version 13 and the three parts' changes, for the main session to regenerate. An earlier run also
  failed the fold's FIGHT scenario (the careful player stalled: the new flee slide first applied to
  a fighter backing off too; now fleeing and leaving only, and the scenario passes) and art lint's
  sheet list (the new `fx_red_glint`, now counted).
- `npm run test:browser -- --project=chromium` (one full run, 8.4 min): **93 passed, 2 failed.**
  `sound.spec.ts` counted 45 sound buttons and found 49: the four are this part's new sounds, now
  counted (re-run: passes). `storm.spec.ts`'s frame budget (the cold open, 6.06 ms of script a frame
  against 5.5) under the full run's load; re-run alone it passes, as the interface part's report
  found for the same spec. No threshold was changed. CI's Chromium run is the measure.
- WebKit was not run here: its browser cannot be downloaded in this environment. CI runs Chromium
  and WebKit, and both block publishing. CI results for this part: none yet (not committed by this
  session; the main session commits and publishes).
- The sounds were rendered and measured with `npm run audio:render` (see Balance).
- Found and fixed by the browser tests and the captures: the let-go shout was lost when a
  companion's flight bark came in the same frame (the shout is now offered after the frame's
  events); a let-go foe waited for its next look round before running; a fleeing foe stood at a
  rock in sight for good (DG-32). No probe tests are left.

## Gate checks
The tests the user asked for, all passing:

| Asked for | File | Test |
|---|---|---|
| Spared enemies are recorded (deed, fate, save and load) | `tests/unit/pt3combat.test.ts`; `tests/browser/pt3combat.spec.ts` | "letting go a reeling / downed / begging foe writes SPARED, a record with its fate, drops the weapon, and the foe leaves without rejoining"; "the fates' shares over 2,000 seeded spares match Book 10's odds within 3 points, under each condition"; "the record and what was taught survive save and load; an older save migrates to version 13"; "SPARED is read by each culture's row"; "the scheduler: a Chapter 1 spare waits for the launch..."; browser: "a beaten foe: the choice at the right edge; G lets go, with the shout, the reply and the run" |
| Finishers only in beaten states, with Book 10 frame data | `tests/unit/pt3combat.test.ts`; `tests/browser/pt3combat.spec.ts` | "the choice is offered only to a beaten foe, within offerReach, in the strike arc"; "a stagger at or below beatenBelow becomes the reel"; one test for each weapon and variant (14): "Book 10's wind-up, active, recovery, step and hitstop; the deed"; "a begging foe finished is SURRENDERED_KILLED; a hold let go early does nothing; a hit in the hold ends it"; browser: "the finisher held on V: one blow after the hold, and the deed of a killing" |
| The teaching foes beatable only the intended way | `tests/unit/pt3combat.test.ts`; `tests/browser/pt3combat.spec.ts` | for each of Svart and Ketill, every other way for five minutes leaves him at full vitality, his guard turning it (chip with lights, charge heavies, block and punish, shove, backstab from cover, loose arrows, throw spears: 14 tests); "a player that parries beats Svart, on 10 seeds"; "a player that dodges the red blow and strikes in its recovery beats Ketill, on 10 seeds"; "the red blow breaks a raised guard and beats a parry..."; browser: "Svart turns a blow outside his opening; the parry prompt shows at his telegraph" |
| Every tutorial enemy speaks before attacking | `tests/unit/pt3combat.test.ts`; `tests/browser/pt3combat.spec.ts` | at the dusk (walking or running from the west, down the bank, sneaking through the dune grass, from the east) and the fold's band, Seal Cave's band and one alone, met from the east and the west; "a warning when alone or outnumbered, a taunt in a group; no line follows itself..."; browser: "the scavengers at the stern speak before any attack (first sight)" |
| Prompts in fights 1 to 3 only | `tests/unit/pt3combat.test.ts` | "show in fights 1 to 3, and never after; each retires after its uses"; "the simulation counts the steerer's fights and the uses in fights" |
| The heal prompt stops after 3 heals | `tests/unit/pt3combat.test.ts` | "the heal prompt shows on a hit below the threshold with a binding carried, and stops after 3 heals"; "the simulation counts heals finished..." |
| The sneak hint | `tests/unit/pt3combat.test.ts` | "...the sneak hint shows on the dusk approach, at most its times, gone once sneaked" |
| The fold's talk stops on awareness | `tests/unit/pt3combat.test.ts` | "plays while all are unaware, never the same exchange twice in a row, leaving out the absent"; "stops for good the moment any of them notices the steerer"; "in the game: the fold's band talks while unaware, and stops at the first suspicion" |
| Browser tests, stepped | `tests/browser/pt3combat.spec.ts` | the four above, each in capture mode (the page advances only when stepped) |

## Art check
All new frames are palette-indexed sources in the people generator
(`assets/art/authoring/people48.py`: the reel, the guard turn, the let-go, the red blow and its
miss, and two finishers for each weapon kind, 114 frames a facing; `combat24_ui.py`: the red glint
on the Danger tell's reserved code; `missiles.py`: the spear and axe lying as loot), compiled through
`art:adopt`, `art:sheets` and `art:compile`; art lint is clean (149 sheets, 0 placeholders). The
sweeps under `docs/art/stage-06-rework` that the proposal tool rewrites (and that the in-progress
commits took in) are restored to the books' revision, c7ecdb6, in the working tree, with the
capture's leftover frames removed; `docs/art/mockups` is unchanged.

- **Rendered at 1x and 4x and inspected** (`assets/art/authoring/pt3_combat_review.py`):
  `docs/art/playtest-3/combat/sheets/` holds `steerer_a_pt3`, `steerer_b_pt3`, `heavy_pt3`,
  `bran_pt3`, `wrecker_ketill_pt3`, `wrecker_svart_pt3` and `wrecker_conn_pt3` (each @1x, @4x and a
  GIF of the new states) and `red_glint@1x/@4x`. Inspected: the finishers read as one quick blow
  from a clear wind-up, never lingering; the lying finishers kneel over the foe; the axe and Dane
  axe chops and Ketill's red blow carry their weight; Svart's guard turn shows the shield edge
  meeting the blow; the red glint reads at 1x as a short red flare at the weapon's edge.
- **From the real game at 1x** (`npm run capture -- playtest-3-combat`, extending the capture tool:
  `src/tools/art/capturePt3Combat.ts`), each with a 4x still, in `docs/art/playtest-3/combat/`:

  | GIF (1x: a 480 x 270 crop of the 640 x 360 view, 30 fps) | Size | What it shows |
  |---|---|---|
  | `finisher.gif` + `finisher@4x.png` | 1.09 MB | Svart reeling at the stern, the choice at the right edge, V held, the seax's standing finisher: one blow, his fall |
  | `spare.gif` + `spare@4x.png` | 1.55 MB | Svart downed, G: the steerer's shout, his reply, the spear dropped, his run |
  | `warning.gif` + `warning@4x.png` | 1.85 MB | walking up the strand at dusk to Conn alone at the stern: his warning on first sight, and the pause |
  | `taunt.gif` + `taunt@4x.png` | 0.99 MB | the same approach to Svart and Conn together: the taunt on first sight, and the shorter pause |
  | `parry-only.gif` + `parry-only@4x.png` | 2.78 MB | three blows turned by Svart's guard (the sparks), the parry prompt, his blow parried and the riposte, his line |
  | `dodge-only.gif` + `dodge-only@4x.png` | 1.70 MB | Ketill at the fold: the red glint and the prompt, Bran's guidance, two red blows dodged across him and his recovery struck |

  Each was watched frame by frame (a tile of frames per GIF) and its still looked at at 4x: the
  prompts sit at the right edge clear of the captions and fade over the fighters; the speech is
  under the speaker's name; the new frames play at the game's scale with the old ones.
- Compared with `docs/art/reference/` (`wreck-strand-target`): the clips are the strand and the fold
  as already built to the Book 7 section 14 standard (grass in the wind, the surf, the dusk light,
  the shadows), with the new fight frames in them; the new frames hold the reference's outline,
  shading and palette. No terrain or place is new, so no mockup was needed; the new frames are of
  characters already approved, which are not wired in for the first time (DD-11, as the other
  parts).
- **Flagged**: the heavy generic body has no weapon layer, so its finishers are seen with a weapon
  only on Bran's and Ketill's sheets (DG-37); the unarmed finisher uses the foe's weapon's frames
  (DG-36).

## Balance
Book 10 and `content/balance.json` are the only source: every number of this part is read through
`src/content/pt3Balance.ts` (strict: a missing or changed row fails the parse). One row was added:
**`sneakCue`, 2.5 s** after Hild's dusk aim line before her dune-grass line (Combat prompts; DG-30);
`npm run balance` was run. Read, none changed: Finishing (beatenBelow 30%, reel 90 ticks, reach
1.2 tiles, spareReply 48 ticks, getUp 20), the finishers' frame table (seven weapons, standing and
lying), allySpared -10, First sight (alone 8 tiles, line delay 18, second line 60, pauses 150 and
90 ticks), the teaching foes (red blow 56 wind-up, 7 active, 44 miss recovery; guidance every 360
ticks), the fold's talk (overhear 12 tiles, murmur 20, gaps 1.6 s and 5 s), the spared remembered
(35/25/40 and the modifiers, gone at least 20%, due 10 to 40 days, precursor 3 days), and the combat
prompts (3 fights, hold 2.5 s, fade 0.5 s, again 6 s, retire after 3, heal below 75% for 5 s until
3 heals, sneak within 16 tiles for 6 s at most 3 times).

**The sounds**, rendered by `npm run audio:render` and measured (peak, RMS): finisher thrust 0.394,
0.061; chop 0.812, 0.063; crushing blow 0.559, 0.098; let-go 0.176, 0.019; guard turn on the shaft
0.214, 0.018, on the shield 0.595, 0.086; the red blow's scrape 0.420, 0.046 (on the tells bus).
None clips; the chop was brought down from 1.25 before. Measured and read as waveforms, not heard
(no speakers here).

## Deviations
DG-30 to DG-49 in `docs/decision-log.md` ("Building the combat"). To flag for the user:
- **DG-33**: the spared fate is drawn on the `encounters` stream; Book 2 names a `world` stream
  that does not exist yet, and adding one changes every world's seeds.
- **DG-36, DG-37**: the unarmed finisher borrows the foe's weapon's frames; the finishers with
  weapons the steerer does not carry were drawn on the weapon layer of those frames; the generic
  heavy body has no weapon layer.
- **DG-38**: a let-go foe's weapon lies as loot but cannot be taken up in Chapter 1.
- **DG-41**: the island plays the fate and pays it; the road ambush, the favours and the grateful
  survivor after the launch are hooks for Stage 13 (`sparedDueNow`), not built.
- **DG-31**: an enemy knocked down at or below 30% lies downed instead of dying; every other
  killing is as before.
- **DG-32**: one running away who is blocked slides along what blocks it (found by the browser
  test: a let-go foe stood at a rock in sight for good).
- **DG-46**: the pad's context swap (parry to finish, interact to let go) while the choice is
  offered and nobody else in reach winds up.

## Known issues
- **Golden save 11** (main session): fails to load and to reproduce, as expected with version 13
  and the three parts' changes; the main session regenerates it. Goldens 1 to 10 are untouched and
  load through the migration.
- **The spared remembered after the launch** (medium): the fates are drawn, saved, scheduled and
  played on the island; the road ambush, the favours and the grateful survivor after the launch are
  Stage 13's (`sparedDueNow`), so a Chapter 1 spare's due day comes to nothing yet beyond its
  precursor and due events (DG-41).
- **No `world` stream** (low): the fate is drawn on the `encounters` stream (DG-33).
- **Dropped weapons** (low): they lie as loot and cannot be taken up in Chapter 1 (DG-38).
- **The heavy generic body's finishers** (low): drawn without a weapon layer (DG-37).
- **The prompts at the stern's east end** (low): there the fighters stand under the prompts' box,
  so the prompts fade, as Book 10 promptClear asks; a player fighting at the very east edge sees
  them less. The browser tests stage their fights in the strand's open middle.
- **The careful scripted player** wins most but not all seeded fights at the fold (it is the
  dangerous way, Book 1 section 05); the scenario asks at least 3 of 8.
- **Audio** was measured, not heard (no speakers in this environment).
- **WebKit** not run here (see Tests).

## Next stage ready
NO: this is one part of the third playtest's rework; the user playtests the whole of it at the
Build 1 gate, and Stage 13 waits for the user.
