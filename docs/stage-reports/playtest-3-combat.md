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
_Filled at the end of the session._

## Gate checks
_Filled at the end of the session._

## Art check
All new frames are palette-indexed sources in the people generator
(`assets/art/authoring/people48.py`: the reel, the guard turn, the let-go, the red blow and its
miss, and two finishers for each weapon kind, 114 frames a facing; `combat24_ui.py`: the red glint
on the Danger tell's reserved code; `missiles.py`: the spear and axe lying as loot), compiled through
`art:adopt`, `art:sheets` and `art:compile`; art lint is clean (149 sheets, 0 placeholders). The
sweeps under `docs/art/stage-06-rework` that the proposal tool rewrites were restored from git.

- **Rendered at 1x and 4x and inspected** (`assets/art/authoring/pt3_combat_review.py`):
  `docs/art/playtest-3/combat/sheets/` holds `steerer_a_pt3`, `steerer_b_pt3`, `heavy_pt3`,
  `bran_pt3`, `wrecker_ketill_pt3`, `wrecker_svart_pt3` and `wrecker_conn_pt3` (each @1x, @4x and a
  GIF of the new states) and `red_glint@1x/@4x`. Inspected: the finishers read as one quick blow
  from a clear wind-up, never lingering; the lying finishers kneel over the foe; the axe and Dane
  axe chops and Ketill's red blow carry their weight; Svart's guard turn shows the shield edge
  meeting the blow; the red glint reads at 1x as a short red flare at the weapon's edge.
- **From the real game at 1x** (`npm run capture -- playtest-3-combat`, extending the capture tool:
  `src/tools/art/capturePt3Combat.ts`), each with a 4x still, in `docs/art/playtest-3/combat/`:
  GIFS_TABLE
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
KNOWN_ISSUES

## Next stage ready
NO: this is one part of the third playtest's rework; the user playtests the whole of it at the
Build 1 gate, and Stage 13 waits for the user.
