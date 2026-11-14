# REWORK 2.4 REPORT: combat v2 and the arrow fix

In the Book 2 section 23 format: one heading per report field. This builds design addendum 2.4
section 1 (decisions DE-1 to DE-15, folded into the books) beside the Chapter 1 opening work, which
another session builds at the same time (DE-60 onward). Choices the books leave open are DE-35 to
DE-59 in `docs/decision-log.md` ("Building combat v2 and the arrow fix"). Nothing is committed by
this session; the main session commits.

## Implemented
- **The stance** (`src/sim/land/fight.ts` `stepStance`, `steererFace`; `src/sim/combat/fighter.ts`
  `turnTowards`): a melee weapon, shield or bow in hand puts the steerer in the stance, facing the
  cursor (stick; keys: the way last moved) as a continuous angle turning at Book 10's rate; drawn
  in the nearest of the four facings. Forward, strafe and back-off speeds by the angle between the
  facing and the movement; running breaks the stance's facing and turns to the run. The facing is
  a command (`FACE`, 64 directions), so the simulation still takes commands only (DE-44).
- **Lock-on** (Z, middle mouse, pad R3; `steererLockOn`, `lockCandidate`): the nearest enemy in
  front within 8 tiles (the 90-degree cone first), clockwise switching on another press, release on
  a 0.4 s hold, the target's fall or flight past 12 tiles, 2 s out of sight, or leaving the stance
  (DE-58). Locked, the stance faces the target and the camera centres between the two (half-way,
  capped at lookAheadAiming), with PT-0's smoothing kept (`src/scenes/zoneVisuals.ts`, lead kind
  `target`).
- **Attacks commit**: a strike plays out, cancellable only into a dodge in its first ticks
  (dodgeCancelTicks); a miss adds Book 10's miss recovery (the spear's own). **Reach** for every
  weapon and enemy (Book 10's movesets and Archetypes' Reach column), and **lunges** (a step-in
  strike with its tell) per weapon.
- **Nine movesets and the weapon rules** (`content/balance.json` "Weapon movesets", "Weapon
  rules"): unarmed shove, seax, hand axe (the hook pulls a shield aside, DE-36), spear (the edge
  inside half reach is weak, keeping distance is its strength), sword (wider parry), Dane axe
  (guard break and split shields), club or hammer, shield bash, hunting bow and thrown spear; mail
  by damage type (cut, crush, pierce).
- **Poise and stagger** (`poiseHit`): poise damage by weapon and strike; flinch, stagger,
  knockdown and get-up as their thresholds say; poise regenerates after its delay.
- **The bigger parry**: 14 ticks of hitstop on both, a bright star (`fx_combat`), a sharp ring
  (`SFX_PARRY_RING`), the attacker open for 60 ticks (state `parried`), and the riposte a heavy,
  distinct, uninterruptible strike (new frames on every body sheet) with its own damage.
- **Guard stamina and guard break**: a block costs stamina by the blow; empty, the guard breaks
  and the blocker is stunned.
- **Enemy self-preservation** (`think`, `engage`): hold off at the faced reach + 0.4 tiles,
  circle at strafe speed, step in and out, feint, respect a longer weapon, crowd a short one; the
  wounded hold off further, call for help and retreat to a friend; flee, beg and surrender; one or
  two pressers, the rest circle; they avoid deep water and a lit camp fire; leash; scavengers
  leave if clearly outmatched. Attack tokens (S9-29) kept. A cornered runner surrenders and a
  cornered archer draws a sidearm once (DE-41).
- **Hit reactions** (simulation hitstop as a held clock, DE-46): flinch and knockback, stagger,
  knockdown and get-up, a one-frame flash (never with reduced motion), a blood spray and its decal,
  sparks off mail and iron, splinters off a shield; layered hit sounds with the steerer's breath
  (never a voiced cry); screen shake only on heavy, riposte and backstab blows (DE-59); deaths
  varied as before.
- **Health and bars**: every archetype's vitality is Book 10's combat v2 value (about 25% less);
  the first scavengers fall to three clean seax hits or one riposte. Health and stamina are
  separate bars top left that fade once full and out of a fight; the enemy bar is thin, over the
  locked or recently hit enemy (`src/scenes/bars.ts`, `src/scenes/hud.ts`, DE-56).
- **Stamina** regenerates after its delay; at 0 the steerer is exhausted (no run, no dodge,
  slowed) until stamina is back to recoverAt (DE-54).
- **Healing** (H): binding a wound or eating a ration, kneeling, interruptible by a hit or by
  moving, limited by carried bindings (`ITEM_BINDING`) and rations (`ITEM_RATION`, taken from the
  camp's salt fish on reaching camp; DE-45).
- **Arrows always register** (`src/sim/land/missiles.ts`): each tick a missile's path is swept
  against every body's box (moved by the body's own motion that tick) in every state and at any
  speed, and against cover per pixel; it hits whatever it meets first (DE-43). A raised shield in
  front stops it with a thunk and splinters and costs the shield's stamina; aware enemies sometimes
  sidestep after the bow's tell (DE-39); unaware ones cannot and take double.
- **Sneaking and perception**: sneak is a toggle (C, pad 13) at 1.2 tiles a second; footfalls make
  noise by ground (DE-38); tall grass, dune grass and peat banks hide; enemies see in a cone and
  hear; awareness goes unaware, suspicious, alert with barks, and the "?" and "!" marks can be
  turned off (system menu A, `?marks=off`; DE-50, DE-57).
- **Backstab** on an unaware (or suspicious and not facing) target from within 60 degrees either
  side of the back (DE-42): kills outright up to 75 vitality, otherwise x4 (seax x6).
- **Warnings**: scavengers warn at 8, 5 and 3 tiles at least 3 s apart; nearer, a weapon drawn
  (after one more warning) or a blow starts the fight; walking away avoids it (DE-40).
- **Checkpoint autosaves** (`src/persist/checkpoints.ts`): before set-piece fights (an encounter
  with a checkpoint), on reaching camp once a day (`CAMP`, DE-53), and on waking.
- **The scavengers at dusk** (`SCN_SK_DUSK` in `content/combat.json`): Svart (spear, shield on
  his back) and Conn (bow, seax) strip the wreck's stern from 18:30 on day 1 until dark, with a
  checkpoint first. Svart's slow heavy with its large tell teaches parry and riposte; Conn runs when
  Svart falls or when hit; walk away (they go at dark), bargain with 2 rd of salt fish, or sneak
  through the dune grass for a backstab. Exposed for the Chapter 1 work (DE-49): facts `ch1.dusk`
  (`FOOD`, `DARK`, `FOUGHT`) and `ch1.dusk.<person>`, the event `DUSK_RESOLVED`, `duskOpen()`, the
  checkpoint `dusk`. The fold and Seal Cave fights still play to their ends (Stage 9 to 11 tests).
- **Save version 11** (`src/persist/save.ts`): the migration from 10 adds the fighters' v2 fields,
  the actors' awareness, the stance and the battle's warning state; goldens 1 to 10 load.

## Tests
- `npm run lint`: clean. ESLint, Prettier, content lint (1346 strings, 507 registered IDs) and art
  lint (140 sheets, 30,582 frames, 0 placeholders).
- `npm run build`: builds (the usual large-chunk warning only).
- `npm test`: **48 files, 669 tests: 666 pass, 1 skipped, 2 fail** (last full run):
  - `art.test.ts` "in step with their sources" timed out at its 30 s limit under the parallel
    suite (22 s alone, and it passes alone): combat v2's new states make the regeneration longer.
    Its limit is now 60 s (a time limit, not an art threshold; what it checks is unchanged).
  - `saves.test.ts` "golden save 10 is reproduced exactly by its scenario": **not this work's.**
    The golden 9 scenario's bot interacts at the boat's work spot (43.5, 26.6) on day 4 at 16:30
    and gets a talk with Runa, who stands wounded and idle beside it (43.4, 27.2), instead of the
    work ("no work at the boat", `src/tools/play/repairBot.ts`). Runa's wounded state and her
    place are the Chapter 1 opening work's (DE-73); the golden saves themselves were not
    regenerated, and goldens 1 to 10 load and migrate to version 11.
  - An earlier full run also failed `opening2.test.ts` (the mast stores and rations count) while
    the opening work was mid-edit; it passes now.
- New: `tests/unit/combat2.test.ts` (**44 tests**, all pass): the swept box; arrows registering in every
  state (idle, alert, attacking, blocking, dodging, staggered, downed, fleeing) at 16, 64, 400
  and 3000 tiles a second, before, during and after a fight, and in the dead; the shield's thunk; aware sidesteps (about
  25%) and unaware double damage; the stance's turn; lock-on back-off and strafe speeds, running
  breaking the facing, the hold release, clockwise switching; the camera centring half-way to a
  near target, capped for a far one, with PT-0's smoothing; commit and miss recovery; reach for
  every weapon; holding off a longer weapon; the weapon rules (hook, edge, guard break, split,
  mail by type); the spear's edge and keep-away; lunges; parry and riposte, in the zone with
  hitstop, knockback and shake; poise; hitstop holding both; three seax hits or one riposte;
  exhaustion; healing and its interruption; the bars; the wounded backing off and calling for
  help; one or two pressers and the rest circling; the leash; footstep noise by ground; awareness
  states; the backstab; warnings at 8, 5 and 3 tiles, walking away, a weapon drawn; checkpoints
  and the camp autosave; Svart's shield drawn slung on his back at work and fighting while he has
  none in hand (the slung layer has every frame the arm layer has), on his arm once taken up, and
  not slung once broken; the dusk fight: there at 18:30, the fight (in at least two of three seeds,
  Svart's slow heavy parried, the riposte felling him and Conn fleeing), walking away, the bargain, the sneak through the
  dune grass to a backstab, and an exact replay.
- Updated, keeping what they check: `combat.test.ts` (Stage 9, on combat v2's numbers),
  `saves.test.ts` (version 11, the migration from 10, goldens 1 to 10 loading), `art.test.ts` and
  `strandArt.test.ts` (the new sheets and states).
- `npm run test:browser -- --project=chromium`: the full run gave **59 passed, 6 failed** while
  clip captures and another session's runs loaded the machine; the six were then rerun with
  `combat2`, `standard`, `stage08`, `opening2` and `sound` together: **20 passed, 0 failed**:
  - `combat2.spec.ts` (new, 4 tests, stepped): the dusk checkpoint, warnings and walking away,
    and the sneak toggle; lock-on taking Svart and the stance facing him while backing off; a
    seax blow holding both fighters in hitstop; an arrow sticking in a raised shield. Two failed
    in the full run on test staging (the lock took Conn; a misnamed attribute) and were fixed.
  - `sound.spec.ts`: the page's sound count gains combat v2's ten.
  - `standard.spec.ts` (script per frame 9.95 ms under load; **3.20 ms** on the rerun, limit
    5.5), `stage08.spec.ts` (barks: timed out under load; passes) and `opening2.spec.ts` (the
    net's caption: the opening work's; passes on the rerun).
- After the slung shield and the per-voice grunt: art lint clean (140 sheets, 30,582 frames);
  `combat.test.ts`, `combat2.test.ts` and `art.test.ts` 105 passed; the audio unit tests 26
  passed; `combat2.spec.ts` and `sound.spec.ts` in Chromium 9 passed.
- Firefox and WebKit were not run here (the main session runs the CI).

## Art check
**New and changed art** (palette-indexed sources per Book 7, compiled, rendered at 1x and 4x and
inspected; art lint clean, 0 placeholders):
- Five new fight states on every body sheet (`assets/art/authoring/people48.py`): riposte (3
  frames), backstab (3), lunge (2), parried (2) and get-up (2), for both steerer bodies, the heavy
  build, Bran, Oddi, Svart, Conn and Ketill. Review sheets and GIFs per body at 1x and 4x in
  `docs/art/rework-2.4/combat/sheets/` (`assets/art/authoring/combat24_review.py`).
- `ui_combat` (12 x 12): the red health fill and its end, the "?" and "!" marks (two frames each,
  a bob), the thin enemy bar, the lock-on brackets (two frames), the binding and ration icons.
  `fx_combat` (16 x 16): the parry's star (4 frames), sparks (3), splinters (3), the sidestep's
  puff (3) (`assets/art/authoring/combat24_ui.py`).
- **Svart's slung shield** (DE-14, DE-47): `layer_shield_back_svart`, the same round shield on his
  back in every state his sheet has (42) and all four facings, with its layer file
  `wrecker_svart_slung` (so art lint checks its canvas and the composite's ink outline in every
  frame). The game draws it in place of the shield on his arm whenever a fighter has a shield but
  none in hand and none broken (`withSlungShield`, `shieldSlung` in `src/scenes/people.ts`, used by
  `zoneScene.ts`), so what is drawn matches the simulation: no shield in front, nothing blocked.
  Inspected at 1x and 4x: `docs/art/rework-2.4/combat/sheets/wrecker_svart_slung@1x.png` (every
  state), `wrecker_svart_slung_fight@1x.png` and `@4x.png` (the fighting states, slung beside the
  arm, south and east) and `wrecker_svart_slung.gif` (`assets/art/authoring/combat24_slung.py`).
  From the north the shield shows whole on his back; from the south the body hides it; from the
  sides it is behind the cloak, as the at-rest shield on his back already was.
- The proposed sheets in `assets/art/proposed` match what ships (`npm run art:adopt`).

**Clips from the real game** (`npm run capture -- rework-2.4-combat`, `src/tools/art/captureCombat2.ts`):
each a GIF at 1x (320 x 180 round the steerer and Svart, 30 frames a second) and a still at 4x of
its key moment, in `docs/art/rework-2.4/combat/`, all under 3 MB. All but arrow-blocked were captured
again with the slung shield, so Svart fights with his shield on his back, as in the simulation:

| Clip | GIF | Shows |
|---|---|---|
| parry-riposte | 0.18 MB | Svart's slow heavy (its large tell), the parry's star and long hitstop, Svart reeling open, the riposte, the fall and the blood |
| back-off | 0.49 MB | Locked on to Svart: backing off west, strafing south and north, the stance facing him throughout |
| hit-reactions | 0.35 MB | A light seax hit (flinch, knockback, flash, spray) and a charged heavy (stagger, shake) |
| hurt-backs-off | 0.53 MB | Svart badly hurt holding off further, backing away as the steerer presses |
| arrow-blocked | 0.25 MB | An arrow into Svart's raised shield (staged with the shield taken up): the thunk and splinters, the arrow stuck in the board |
| arrow-dodged | 0.22 MB | Aware Svart reading the draw and sidestepping; the arrow passes |
| backstab | 0.26 MB | A backstab on Svart at work, unaware: the heavy strike and the fall |

**Compared with `docs/art/reference/`** (wreck-strand-target): the people read clearly at 1x
against the shingle, and the effects (star, sparks, splinters, blood, puff) are small, palette
colours and short, as the reference's restraint asks. The clips are at 18:35, so the dusk grade
makes the strand greyer and flatter than the reference's daylight, and the sea at the stern reads
grey; that is the time of day of the fight, not a change to the strand's art. The stern prop's
cutaway dither shows when someone stands behind it (Stage 6's behaviour).

## Audio check
Ten new generated sounds (`src/audio/synth/combat2.ts`), each cued in `content/audio.json` with
its caption in `content/strings/en.json` and listed on the sound test page; no recordings. Listened
back with `npm run audio:render` (peak / RMS, linear; the ceiling is -1 dBTP, about 0.89):

| Sound | Event | Peak | RMS |
|---|---|---|---|
| SFX_STEERER_BREATH (hurt: a breath, never a cry) | STEERER_HURT | 0.228 | 0.0220 |
| SFX_GRUNT (enemies, wordless; Svart's 150 Hz) | GRUNT | 0.167 | 0.0166 |
| SFX_GRUNT at Ketill's pitch (98 Hz) | GRUNT | 0.165 | 0.0133 |
| SFX_GRUNT at Conn's pitch (244 Hz) | GRUNT | 0.161 | 0.0194 |
| SFX_PARRY_RING (the sharp ring) | PARRY_RING | 0.265 | 0.0486 |
| SFX_RIPOSTE (a heavy layered hit) | RIPOSTE_HIT | 0.706 | 0.1600 |
| SFX_LUNGE (the lunge's tell) | LUNGE_TELL | 0.198 | 0.0222 |
| SFX_BACKSTAB | BACKSTAB | 0.481 | 0.1116 |
| SFX_SIDESTEP | SIDESTEP | 0.198 | 0.0190 |
| SFX_ALERT (turning alert) | ALERT_STING | 0.123 | 0.0165 |
| SFX_BIND_WOUND | BIND_WOUND | 0.440 | 0.0263 |
| SFX_EAT | EAT_RATION | 0.116 | 0.0084 |
| SFX_ARROW_SHIELD (existing; the thunk) | ARROW_SHIELD | 0.267 | 0.0484 |

All are under the ceiling (the riposte first peaked at 0.908 and was brought down). The riposte and
backstab are the loudest, as the heaviest blows; the grunt, alert and eating sit low under the
ambience. The grunt is pitched from each person's voice data (`voice.ts` speaking pitch, passed
with the event through the audio router to the sound; DE-48), so Ketill, Svart and Conn are told
apart and stay at the same loudness. The barks (warnings, "Who's there?", calls for help, bargaining, running) are Book 8
lines with voice blips, as before.

## Deviations
DE-35 to DE-59 in `docs/decision-log.md`, each with its reason. None departs from Book 1.

## Known issues
- **Bindings in the world** now come from the opening work's content: the camp's salvage on the
  machair (`camp_bindings`, Book 10 bindingsAtCamp) and three in Thorkel's chest, taken into the
  pack up to Book 10's carried limit. With none carried, H eats a ration if one is carried, and
  otherwise refuses with a caption ("No bindings").
- **Perception and avoidance** model darkness, rain (a hook: rain is false until weather is
  built), cover, deep water and a lit camp fire; light pools and cliff edges are not yet modelled.
- **A broken shield has no art.** A shield split or worn out (`shieldBreaks`) is gone in the
  simulation but still drawn on the arm. Only Svart has a slung layer; no one else is ever slung.
- **The club or hammer** has its moveset but no Chapter 1 item.
- **Edge case**: visiting the fold during the dusk window could meet the fold's band before the
  dusk survivors join it; they join at dark.
- **The clips' tile cursor**: in the arrow clips the HUD's target-tile cursor (the broken red edge
  of a tile out of reach) sits over Svart where the mouse aimed; it is the real interface, not a
  stray sprite.

## Flagged for the user's review
- **Reused frames** (DE-47): the knockdown draws the downed frames, the sidestep the dodge frames
  and healing the kneel. New frames were drawn only for the riposte, backstab, lunge, parried and
  get-up. Say if any of the three needs its own.
- **Healing's key** (DE-45): H, and not yet on the pad's command ring.
- **Rations taken at camp** (DE-45): reaching camp packs up to 3 rations from the salt fish
  automatically. A hands-on "take rations" at the stores is the alternative.
- **The backstab arc read as 60 degrees either side** (DE-42).
- **Cornered runners surrender** and a cornered archer draws a sidearm once (DE-41).
- **Marks toggle** on A in the system menu (DE-57), until a settings screen exists.
- **Svart's slung shield** (DE-47): new art for review, in `docs/art/rework-2.4/combat/sheets/`.
