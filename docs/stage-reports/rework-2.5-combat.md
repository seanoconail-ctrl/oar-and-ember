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
RESULTS

## Art check
ART

## Audio check
AUDIO

## Deviations
DF-23 to DF-49 in `docs/decision-log.md`, each with its reason. None departs from Book 1.

## Known issues
KNOWN

## Flagged for the user's review
FLAGGED
