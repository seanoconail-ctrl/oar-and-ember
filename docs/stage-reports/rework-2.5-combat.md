# REWORK 2.5 REPORT: committed combat (design addendum 2.5 section 1)

In the Book 2 section 23 format: one heading per report field. This builds design addendum 2.5
section 1 (decisions DF-1 to DF-10, DF-19, DF-21's combat items, and the user's rulings DF-80 and
DF-81) beside the rescue fix and the on-screen text and storm work, which other sessions build at
the same time. Choices the books leave open are DF-23 to DF-49 in `docs/decision-log.md`
("Building committed combat"). Nothing is committed by this session; the main session commits.

## Implemented
- **Book 10 moved to 2.5 (DF-19).** Every row marked "Superseded by 2.5, removed when built" is
  gone (Charge (heavy); releaseRecovery; parryStartup, parryWindow, parryRecoveryOnMiss and dodge
  in Defence; heavySwing and shoveTiming; sprintEmpty; attackTurn, dodgeCancel and missRecovery;
  the Windup, Active, Recovery and Chain window columns of Weapon movesets; spearMiss;
  lungeRecovery; parryWindow in Parry and riposte; exhausted; decideEvery, attackGap and
  fallBackFrom), and every parser reads the new keys: `commitment`, `frameData`, `enemyAttacks`
  (checked by a test against the floors), `telegraphs`, `movementAndAcceleration`, `exhausted`,
  `parry`, `block`, `dodge`, `aiStates`, `aiDecisions`, `distancesByArchetype` and `archers`
  (`src/content/combatBalance.ts`; the bow's and the thrown spear's draw from `frameData` in
  `src/content/balance.ts`; the carry and wade threshold from heavyCarryEmpty in
  `src/content/homeBalance.ts`). One row was added: awarenessEvery (DF-45). `npm run balance`
  regenerated `content/balance.json`.
- **Three strict phases, no cancels (DF-1)** (`src/sim/combat/fighter.ts`): every attack (lights,
  heavy, charged heavy, lunge, riposte, backstab, shove and bash), the parry, the block's raise and
  lower, the dodge, a feint's lowering, the sidestep and healing play wind-up, active and recovery
  ticks from Book 10's tables; from the first wind-up tick to the last recovery tick the fighter
  cannot move, turn, dodge, block, parry or start another action, player and AI alike (`locked`).
  A light pressed in its chain window is queued for after the recovery. The facing is fixed at the
  press. A whiff adds the move's miss recovery; a hit on a fighter in a miss recovery, a mistimed
  parry's recovery, a dodge's recovery or a broken guard is a **punish** (7 ticks of hitstop and
  x1.5 poise), carried on the BLOW event (`punish`).
- **Locked-on attacks go at the enemy (DF-81, DF-49).** At the press a light, heavy, lunge,
  riposte, shove or parry faces the locked target, whatever the cursor; a bow or thrown spear aims
  at the target's feet.
- **Grounded movement (DF-2, DF-31)** (`easeVelocity`, `accelTicks` in `src/sim/land/onFoot.ts`,
  fighters' `walk` in `src/sim/land/fight.ts`): walk, run (from a walk faster), sneak, back off,
  strafe, carry, blocking and exhausted each ease up and down over Book 10's ticks, x1.25 in mail
  or for the heavy build, x1.5 for both; a reversal slows through a stop. Any action stops the
  fighter at once; an attack's only ground is its fixed step over its active ticks (a lunge's
  strides over its wind-up), never a slide.
- **Exhausted at 0 stamina (DF-3, DF-30):** any cost that empties the bar (running included):
  no attack, parry, shove, dodge, block or run, half speed, a raised shield drops; regeneration
  waits 60 ticks from 0 and runs at 20 a second until 30% of the current maximum (the steerer's in
  `traversalTick`, everyone else's in `regen`). Refused silently; shown by the exhausted idle and
  walk and heard as hard breathing.
- **The predictive parry (DF-4):** a 6-tick wind-up (`parryWindup`), 8 live ticks (12 with the
  option, a sword +4), 18 of recovery after a miss. A blow is parried only when its first active
  tick that meets the parrier falls in the live ticks; it stuns the attacker for 60 ticks after the
  14-tick hitstop, and the parrier's remaining ticks become a 6-tick settle before the riposte.
- **The block (DF-5, DF-23):** a 6-tick raise before the guard is live and a 6-tick lower; half
  speed while raised; each blow drains Guard's blockCost; a blow that empties the bar breaks the
  guard with a 60-tick stagger and 4 px of knockback (`guard_break`), then exhausted.
- **The dodge (DF-6, DF-32):** 4 ticks of start, a 12-tick dash of 1.25 tiles eased out,
  invulnerable on dodge ticks 8 to 13 only, then 18 planted ticks (`dodgeRecovery`); 30 stamina.
- **The AI state machine (DF-7, DF-26 to DF-29)** (`engage`, `chooseState`, `openingLeft`): idle,
  approach, circle, wait for opening, attack, retreat, recover stamina, flee or surrender, each held
  its least time; decisions on each fighter's own 15-tick grid (offset on the `ai` stream),
  carried out every tick between; circle radius from the archetype's margin; circling turns round
  at most once in 90 ticks; the one with the attack token waits (shield up if it has one) for an
  opening it can take before it ends, or until its patience runs out (x1.5 wounded), closes one
  step at walking speed, strikes, retreats and cools down 45 ticks; below its recover-at share it
  backs off to recover. Self-preservation (the wounded backing off and calling for help, falling
  back to a friend), warnings, flanking and the attack tokens are kept. Enemies play by Book 10's
  telegraph floors (an enemy seax light winds up 28 ticks; heavies hold to meet the floor).
- **Archers (DF-8, DF-34, DF-35):** they shoot only from 4 to 7 tiles with a clear line, settling
  6 ticks, drawing 36 and recovering 20, all standing completely still (`archer.ts`); within 3
  tiles they hop back once (2 tiles over 18 ticks, 25 stamina), reset 12 ticks and re-evaluate;
  cornered, too close again within 6 s, or out of arrows, they draw the seax (20 ticks) and fight
  as outlaws.
- **Telegraphs (DF-9, DF-37):** each enemy attack sends `TELEGRAPH` at its flash, always 28 ticks
  before the blow, with its weight and weapon; the scene draws the one-frame `tell` glint on the
  weapon (a brightened edge with reduced motion) and the wind-up's draw-back (3, 5 or 7 px by
  weight, the top held); the sound is by weight: a sharp breath, steel scraping, or a grunt and a
  creak of wood. The steerer's own attacks draw back too and breathe; they have no flash.
- **Read by sight and sound only (DF-9, DF-80):** no combat refusal words ("Too spent" and the
  stamina refusals are gone); the awareness marks are off by default (`displaySettings.ts`, DF-44);
  the seven new combat sounds have no caption at all (their cues carry their drawn twin instead,
  `drawn`, and content lint accepts that in place of a caption).
- **DF-21's combat items:** the stance walk (`backoff`, `strafe`), the flinch, varied death falls
  (DF-39), own frames for the knockdown, sidestep, binding and eating; a broken shield is taken off
  the arm and its halves lie where it broke (DF-40); heal on the command ring's centre (DF-41); a
  sneaking steerer in a lit fire's light pool is seen at the day's range (cliff edges stay
  unmodelled: DF-42); the fold met during the dusk is met without the dusk's two, who join it at
  dark (DF-43).
- **The careful scripted player, rebuilt (DF-47)** (`src/tools/play/carefulFighter.ts`), shared by
  the scenario tests, the combat tests and the captures.
- **Save version 12 (DF-46)** (`src/persist/save.ts`): the migration from 11; goldens 1 to 10 load.

## Tests
Run on 2026-11-13 at the end of the work, with the other two sessions' work in the tree.
- `npm run lint`: clean (ESLint, Prettier, content lint with 518 registered IDs, art lint 146
  sheets and 43018 frames with 0 placeholders).
- `npm run build`: built (the usual chunk-size warning only).
- `npm test`: **790 passed, 2 failed, 1 skipped (793)**. Neither failure is this work's:
  - `missiles.test.ts` "the bow cannot be had before the chest is opened with the key": Interact
    now goes to Hild first while she is in the net (the rescue session's DE-86), so the test's
    Interact beside the chest no longer lifts it. The rescue session owns the test.
  - `saves.test.ts` "golden save 11 ... is reproduced exactly by its scenario": the 2.5 simulation
    plays the scenario differently, as expected; golden 11 is regenerated by the main session at
    the end of the whole job. Goldens 1 to 10 load, and golden 11 migrates to version 12.
- New and changed tests: `tests/unit/combat25.test.ts` (43 tests: commitment for every action,
  steerer and AI; the block's raise and lower; miss recovery and the punish; exhausted; the parry's
  timing and settle; the guard break; the shield's speed; the dodge's invulnerable ticks 8 to 13;
  acceleration in the zone; the AI's 15-tick grid without jitter; waiting for an opening; a whiff
  punished; archers; telegraph floors against the Enemy attacks table and the 28-tick flash lead;
  locked-on aim; the fold and dusk join; heal on the ring), with `combat.test.ts`,
  `combat2.test.ts`, `saves.test.ts`, `home.test.ts`, `opening.test.ts`, `strandArt.test.ts`,
  `art.test.ts`, `audio.test.ts` and `audioCoverage.test.ts` moved to 2.5. Combat suites: 122
  passed.
- **Win rates of the careful scripted player** (`carefulFighter.ts`: it locks on, parries off the
  tell 10 ticks before the blow, ripostes, punishes whiffs, dodges arrows and backs off below 35%):
  the dusk on the strand **9 of 10** seeds (it parried in all 10); the fold **8 of 8**; Seal Cave
  **4 of 4**; the Stage 9 strand **9 of 10** (14 parries). An undefended steerer falls at the dusk
  in 16.5 s, 14.7 s and 14.7 s (three seeds), so the fight is lost by standing still and won by
  reading it.
- Browser, Chromium (`npm run test:browser -- --project=chromium`): **77 passed, 0 failed**
  after one fix: the sound test page lists the seven new sounds, so `sound.spec.ts` counts 40
  (it failed at 33 in the first run, then passed, 5 of 5).
  `tests/browser/combat25.spec.ts` (stepped, 4 tests: a locked-on attack goes at the enemy with the
  cursor elsewhere and commits; exhausted, no dodge and half speed; the predictive parry pressed
  in Svart's wind-up stuns him; an archer stands, hops back once and draws its seax) passes.
  WebKit is not run by this session; CI runs both before publishing.

## Art check
- **Frames drawn** (`assets/art/authoring/people48.py`, palette-indexed, compiled through
  `art:adopt`, `art:sheets` and `art:compile`): wind-ups by weight with the draw-back (3, 5 and
  7 px, the top held), the parry's wind-up, the shield's raise (played backwards for the lower),
  the guard break, a deeper exhausted idle and an exhausted walk, the dodge's recovery, the stance
  walk (`backoff`, `strafe`), the flinch, the knockdown, the sidestep, the hop back, binding,
  eating, and four death falls (forward, back, left, right; DF-39). The fx sheet gains the
  one-frame `tell` glint and the broken shield's halves (`combat24_ui.py`).
- **Review sheets** at 1x and 4x with a GIF for each of six characters (22 states, 70 frames a
  facing): `docs/art/rework-2.5/combat/sheets/` (the two steerer builds, the heavy build, Svart,
  Conn and Ketill). Inspected at 4x: silhouettes read at 1x, the draw-back and the held top are visible,
  the falls land on the shadow, no frame clips its cell.
- **Clips from the real game** at 1x, each with a 4x still (`npm run capture --
  rework-2.5-combat`, `src/tools/art/captureCombat25.ts`), all under 3 MB:

  | Clip | Size | What it shows |
  |---|---|---|
  | `punish-miss.gif` | 0.61 MB | Conn's seax whiffs at a dodge; the steerer punishes in his miss recovery (hitstop 7) |
  | `parry-predictive.gif` | 0.48 MB | the parry pressed off Svart's tell in his wind-up; he is stunned and riposted |
  | `guard-break.gif` | 0.27 MB | a light on Svart's raised shield empties his bar: guard break, stagger, knockback |
  | `circle-wait.gif` | 0.58 MB | Svart circles and waits for an opening, then steps in when the steerer's bar runs out |
  | `archer-backs-off.gif` | 0.69 MB | Conn stands to shoot, hops back once when crowded, then draws the seax |

  The guard-break clip holds Svart on his spot until the guard breaks (his AI otherwise backs off
  with the shield up, at block speed, out of the steerer's reach); everything after the break
  plays freely. The other clips are staged positions only, then the AI chooses.
- **Against `docs/art/reference/`** (`wreck-strand-target`, `kelda-summer-target`): the same
  strand ground, grass, wind and shadow as the Stage 6 rework; the fighters' new frames keep the
  reference's outline weight, three-step shading and 48 px body. The tells read as a one-frame
  bright edge rather than a shape, as the reference's lighting does. No placeholder art.

## Audio check
Seven new generated sounds (`src/audio/synth/combat2.ts`), rendered and listened back with
`npm run audio:render` against the Book 11 standard. None has a caption (DF-80); each cue carries
its drawn twin (`drawn` in `content/audio.json`).

| Sound | Peak | RMS | Drawn twin |
|---|---|---|---|
| `SFX_TELL_LIGHT` (sharp breath) | 0.133 | 0.0173 | the tell glint |
| `SFX_TELL_SCRAPE` (blade heavy or charged) | 0.199 | 0.0358 | the tell glint and the long draw-back |
| `SFX_TELL_CREAK` (axe, club or Dane axe heavy) | 0.196 | 0.0184 | the tell glint and the long draw-back |
| `SFX_TELL_STEERER` (the steerer's breath) | 0.051 | 0.0068 | the steerer's draw-back |
| `SFX_EXHAUSTED_BREATH` | 0.102 | 0.0143 | the exhausted idle and walk |
| `SFX_SIDEARM` (a seax drawn) | 0.172 | 0.0212 | the sidearm draw frames |
| `SFX_SHIELD_SPLIT` | 0.164 | 0.0148 | the shield's halves on the ground |

All sit under the combat bus's ceiling and above the ambience bed; the heavier tells are louder
than the light one, so weight is heard before it is seen.

## Deviations
DF-23 to DF-49 in `docs/decision-log.md`, each with its reason. None departs from Book 1.

## Known issues
- **The enemy's second light** is not built (DF-36): enemies chain no second light yet.
- **Book 11's commitment sounds** for the parry's wind-up rasp, the block's creak, the dodge's
  landing and the whiff's scuff are not built; the existing parry, block and dodge sounds play.
- **Frames not drawn**: a separate block walk (the guarded idle walks at half speed), the miss
  overbalance frames (the recovery frames play longer), and walk start and stop frames (the
  ramp plays the walk cycle slower).
- **Cliff edges** are not modelled (DF-42): banks are walls in the zones; treating them as edges
  made a refuge the careful player stalled at (1 win in 10).
- **A seax's whiff** is too short to punish in practice (DF-29).
- **Golden save 11** must be regenerated by the main session.
- **Other sessions' tests**: `missiles.test.ts` "the bow cannot be had before the chest is opened
  with the key" fails from DE-86 (rescue session). Earlier runs also saw the golden 4
  `camp_bindings` test (DF-51) and the opening map test (DF-82) fail while those sessions worked;
  both pass in the last run.
- **`docs/art/stage-06-rework`**: the art tools rewrote its sheets and the in-progress commit
  8a43138 took the rewritten versions; this session restored them from 3d48539. The eight
  `composite_wrecker_*` sheets that commit added are left as they are (they did not exist at
  3d48539); the main session decides whether to keep them. `docs/art/mockups` is unchanged.

## Flagged for the user's review
- **DF-25**: healing is locked like any action; only a hit ends it.
- **DF-29**: how long an opening lasts as a fighter sees it (a seax's whiff is too short to be
  taken in practice).
- **DF-38**: the wind-up's frames (three draw-back states of two frames, the held top).
- **DF-41**: heal on the command ring's centre (release at the centre heals).
- **DF-42**: light pools built, cliff edges not modelled.
- **The new art**: the review sheets in `docs/art/rework-2.5/combat/sheets/` and the five clips,
  for approval before they are kept (Book 3).
