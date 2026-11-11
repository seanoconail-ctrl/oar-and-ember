# STAGE 9 REPORT: combat v1

In the Book 2 section 23 format: one heading per report field. Decisions are S9-1 to S9-29 in
`docs/decision-log.md`. Built under DD-11 without waiting on the new art's approval; everything for
the user's review is listed under **Flagged for the user's review**.

## Implemented
- **The fighter** (`src/sim/combat/fighter.ts`): Book 2 section 12's state machine with Book 10's
  frame data for every melee weapon (seax, axe, spear, sword, Dane axe): light combos with a chain
  window, a charged heavy from the press with two tells (the raised weapon, then level 2's flash),
  parry with its window, refund, attacker's stagger and riposte; block from the front with its arc
  and cost, guard break at an empty bar, a level-2 charge breaking a block but not a parry; dodge
  with its invulnerable ticks and committed move; shove; four-way facing locked from windup to
  recovery end; stamina by kind; hit stop; poise and the heavy build's slower, heavier blows;
  armour; the berserk trait (S9-2 to S9-6).
- **Fights on foot** (`src/sim/land/fight.ts`): every fighter's choice at 10 Hz on the `ai`
  stream (Book 10's new "Fighters' habits", S9-7): seeing a tell and defending, closing, flanking
  when two or more are on one (S9-27), one attack on a target at a time while the rest circle and
  threaten (attack tokens, S9-29), heavies against a raised shield, archers who keep their range,
  stop, draw and loose (no one moves while drawing or holding a spear), searching where a target was
  last seen; perception basics (`src/sim/ai/perception.ts`: a sight cone by the light, hearing by
  gait and surface, memory); morale by group (killed, downed, leader killed, a member bloodied,
  outnumbered), surrender and flight, no quarter after known killings of the surrendered.
- **Downed, not dead**: allies go down and never die on a timer; they can be lifted and carried at
  carry speed to a safe place (the camp at the broch, S9-13), where they live with a serious wound;
  left behind where enemies hold the ground they are killed, or with Rán's mercy wounded gravely.
  Enemies leave the downed be, except a berserker or a named cruel enemy after a visible warning.
  The finisher (held) kills a downed or surrendered enemy; killing the surrendered is a deed.
- **The steerer's death is game over**: the world freezes, the panel says so, and E reloads the
  latest autosave or checkpoint (N begins again). Second wind (an option, off by default): the
  steerer goes down for Book 10's time and an ally beside can lift them once a scene. Saves now run
  in play: an autosave as play begins and on every waking, a checkpoint before an encounter (S9-20).
- **Missiles in a fight**: arrows and thrown spears hurt bodies by Book 10's damage and cost a
  shield's block; they stick in the living, the dead and shields and are pulled free (from the dead
  any time, the rest after the fight); on leaving the zone only those in the ground stay (S9-14).
  A dodge's invulnerable ticks let a missile pass (S9-29).
  NPC archers (`archer.ts`) and a crew member's thrown spear use the same rules.
- **Crew quick commands** through the Stage 6 command ring: follow, hold, attack my target,
  protect, carry the downed, withdraw to the camp, each acknowledged aloud (Hild's lines), refused
  aloud when they cannot (a serious wound), lapsing after a quiet minute.
- **Three wreck-scavengers** on Wreck Strand by the wreck once Hild has led to the broch (S9-11,
  S9-12): Ketill (the big one, heavy build, axe and shield, their leader), Svart (spear and shield)
  and Conn (young, bow and seax, cowardly), at work gathering wreck-wood, unaware, with barks in
  Book 8's voice.
- **Cursor-aimed combat** (`src/scenes/session.ts`): the seax press charges toward the cursor (or
  the right stick), snapped to the nearest facing, and strikes on release; a blade is never refused
  for reach (S9-22); parry, block, dodge and shove on their own keys; the finisher held. The bow and
  thrown spear keep their free aim line, and the camera's look-ahead while aiming is unchanged
  (now on the coordinator's PT-0 camera).
- **Gore** by the setting (S9-17; `?gore=`, G in the system menu): blood sprays by the blow's
  direction, drops and pools that stay, bloodied overlays below half vitality (S9-18), pieces taken
  by a heavy cutting blow that kills (full only), the dead where they fell; low fades the dead and
  stains after a minute; off shows a flash.
- **Sound** (S9-21, S9-24): `content/music/combat.json`, D Aeolian, whose rhythm, melody, voice and
  horn layers come in on bar lines as the fight hardens (`MUS_COMBAT_1`, with `_2` and `_3` as its
  stronger mixes); fourteen new fight sounds (swings, hits by material, dodge, shove, the wet impact,
  bone and dismemberment scaled by the gore setting, downed, a body falling, a weapon dropped, a spear
  thrown) and the game over stinger, each captioned; the earlier charge, parry, block and guard break
  sounds now play in the game. The sound test lists Stage 9 apart (`oeSound.fightItems`).
- **World state version 7** (S9-10): fights, the battle, the campaign's options and game over, with a
  migration from 6 and golden save 7.
- **Book updates**: Book 10 sections 06 and 07 (Fight rules, Fighters' habits with attackTokens
  and tokenRest, memberBloodied, duskSpan; S9-2 to S9-8, S9-23, S9-29), Book 2 section 05
  (version 7).

## Tests
- `npm run lint`: clean: ESLint, Prettier, content lint (857 strings, 441 registered IDs) and art
  lint (83 sheets, 20492 frames, 0 placeholders), with the hands-on change of PT-1 to PT-7 in the
  same tree.
- `npm test`: **38 files, 516 passed, 0 failed**. New: `tests/unit/combat.test.ts`
  (34, all passing after S9-29: among them the attack tokens: an undefended steerer facing all three
  lives at least 8 s, more than one of them strikes, and never more than the tokens attack at once;
  and a scripted careful player beats all three in at least 3 of 10 seeded fights). Updated: `saves.test.ts` (schema 7, golden 6 frozen, golden 7), `synth.test.ts` (the combat
  piece), `audio.test.ts` (no cue is a stand-in any more), `art.test.ts` (the new sheets; the
  steerer's atlas now packs square-ish), `strandArt.test.ts` (fighting states, the seax and blood
  layers), `water.test.ts` (five layers), `controls.test.ts` (reach is refused for a tool; a blade
  swings at any distance).
- `npm run build`: passes.
- `npm run test:browser -- --project=chromium`: **45 passed, 0 failed** (the whole suite), including
  the new `tests/browser/stage09.spec.ts` (4 tests, stepped with `oeStep`), rerun alone after the
  attack tokens (S9-29): 4 passed. No existing browser spec was edited.
- `npm run audio:render`: 115 items rendered, nothing clips (loudest peak 0.81, the guard break).
- CI results: see the run for this commit.

## Gate checks
1. **Frame data matches Book 10; every tell at least 6 ticks before its active frames: PASS.**
   `combat.test.ts` reads every weapon's row and checks windup, active, recovery, combo, chain
   window, reach and stamina, and the charge levels' tells.
2. **A parry inside its window staggers; a full charge breaks a block but not a parry: PASS.**
   `combat.test.ts` (parry, riposte, refund; block arc, guard break; level 2 against block and parry).
3. **No one moves while drawing or holding a spear; projectiles as Book 10 section 21; a replay is
   identical from its seed; no arrows, no draw: PASS.** `combat.test.ts` (the enemy archer stops,
   draws for the draw time and looses; a crew member ordered to throw stands; an arrow in a body and
   in a shield; replay with missiles identical); `stage09.spec.ts` (the steerer stands to draw);
   the Stage 6 missile tests for no arrows.
4. **The steerer's death is game over and reloads the latest autosave; a downed ally never dies on a
   timer: PASS.** `combat.test.ts` (death freezes the world, the latest autosave loads; Second wind;
   carried home; left behind); `stage09.spec.ts` (game over in the browser, E reloads the checkpoint
   before the fight and the steerer walks again).
5. **Book 7 section 14 standard; capture compared with the reference: PASS.** Motion with the camera
   still (threshold 80%): Wreck Strand 93.9%, the wreckers at work 91.7%, the fight at gore full
   91.5%, at gore low 91.5%. See Art check.
6. **Audio standard with captions; the combat set and music in the game, scaled by gore: PASS.**
   `audioCoverage.test.ts` and `synth.test.ts` (every cue has its sound and caption; the combat
   piece fits its metre, keeps D Aeolian and never needs more than 8 voices). Listened back
   (peak / RMS): combat music at its three strengths 0.31 / 0.067, 0.44 / 0.085 and 0.44 / 0.085
   (-23.5 and -21.4 dBFS RMS, inside Book 11's -21 to -24); hit on flesh 0.54 / 0.051, mail
   0.42 / 0.035, shield 0.51 / 0.043; light swing 0.20 / 0.013, heavy 0.27 / 0.026; dodge 0.25,
   shove 0.24, weapon drop 0.24, spear throw 0.23; downed 0.26 / 0.040; body fall 0.24; the wet
   impact 0.14 / 0.07 / silent at full / low / off, bone crack 0.36 / 0.18 / silent, dismemberment
   0.48 at full only; game over stinger 0.24 / 0.028. The quiet swings and falls were brought up
   2 to 4 times after the first render, and the combat music down 1 dB.

## Art check
- **Capture** `docs/art/captures/stage-09/` (`npm run capture -- stage-09`): the strand still, its
  motion map and the reference beside it; `wreckers-at-work`, `fight` and `fight-low` (1x, 2x and
  motion maps, the camera held); `fight.mp4`/`.gif` (10 s: the steerer runs in from the east with
  the seax and fights as a careful player would, parrying and striking into recoveries, the overlay
  shown; no hook: the steerer lasts the clip on their own).
- **Against `docs/art/reference/`**: the strand is unchanged (93.9%, as at Stage 8). The wreckers
  stand in the reference's palette and light, on its ground, with contact shadows; in the fight
  Ketill comes round behind the steerer while Svart and Conn hold the west.
- **Sheets for review**: `docs/art/stage-09/people/` (each fighter's states at 1x and 4x, a fight
  GIF each, the wreckers' idle, walk and run) and `docs/art/stage-09/sheets/`.
- **Placeholders:** none. The fight captures use no hook (the earlier `vitality=2000` is gone).

## Balance
- Added to Book 10 and regenerated: section 06 "Fight rules" (12 keys), section 07 "Fighters'
  habits" (20 keys, with `attackTokens` 1 and `tokenRest` 2 s), `memberBloodied`, `duskSpan` (S9-2
  to S9-8, S9-23, S9-29).
- **Tuned (S9-29):** a steerer who does not defend now falls 10 s after the first blow against all
  three (about 2 s before); `tokenRest` was tried at 1.5 s (8 s) and set at 2 s. No existing Book 10
  value was changed.
- Used as written: section 06's weapons, charge, parry, block, dodge, shove, hit stop, vitality,
  stamina, armour, wounds, second wind, finisher, safe places; section 07's archetypes, perception,
  cohesion and surrender; section 08's berserk, cowardly and brave; section 21's missiles.
- Kept out of Book 10: the gore setting's fade times (presentation, `content/combat.json`), the
  combat music's mix by intensity, the capture's views.

## Deviations
S9-1 to S9-29 (`docs/decision-log.md`, "Stage 9 (combat v1)").

## Known issues
- **Minor (tuning, for playtest):** with the attack tokens (S9-29) an undefended steerer lasts about
  10 s against all three; a scripted careful player wins 4 to 6 fights in 10. A person should do
  better (retreating, using the ground, picking fights one at a time), but it wants a playtest.
- **Minor:** Conn's arrows rarely land while Svart stands between him and the steerer, so in the
  measured fights the blows came from Svart and Ketill.
- **Minor:** Conn, while he has arrows, takes no flank side and may stand in the same place as
  another; the wreckers still bunch at times.
- **Minor:** there is no vitality bar: the steerer's hurt shows only as the bloodied overlay below
  half (and the game over).
- **Minor:** there is no load menu yet, so a new campaign starts with its own saves; old campaigns'
  saves stay in the browser's storage (S9-20).
- **Minor:** shield walls, volleys, horns and runners (Book 2 section 13) wait for their stages;
  flanking is the simple four sides of S9-27.
- **Cosmetic:** the heavy build's fighting poses are drawn narrow to keep within Book 7's width;
  enemies are drawn right-handed in every facing; the spear reads poorly facing north and south;
  the lying figures are short.

## Flagged for the user's review
- **The new people art** (S9-1): the fighting states of both steerer bodies, the heavy build, the
  three wreckers and their bloodied overlays.
- **The new Book 10 numbers** (S9-2 to S9-8, S9-23): the fight rules and the fighters' habits are
  starting values for tuning.
- **Attack tokens** (S9-29): one of a side attacks a target at a time, a 2 s rest between; a dodge
  now lets arrows pass. How hard the first fight is: 10 s for a steerer who does not defend.
- **Where the wreckers are** (S9-11): Wreck Strand by the wreck after Hild leads to the broch, until
  Stage 10 moves the beat to Bran's search; who they are (S9-12).
- **The options** (S9-9): Second wind off by default, changed with K in the system menu.
- **Saves in play** (S9-20): the first autosave as play begins, a checkpoint before the encounter.
- **A blade is never refused for reach** (S9-22); the target box is hidden while a blade is in hand.
- **Gore timings** (S9-17) and the combat music's layering by intensity (S9-21).
- **Flanking** (S9-27): all three come at once from different sides.

## Next stage ready
YES. Stage 10 can bring Oddi, Bran and Runa in
on fighters, perception, morale, crew orders and the downed-and-carried rules, and move the
wreckers' beat to Bran's search at the sheepfold.
