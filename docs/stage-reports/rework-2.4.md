# REWORK 2.4 REPORT: combat v2 and the new opening, before the Build 1 gate

In the Book 2 section 23 format: one heading per report field. This is the combined report for the
design addendum 2.4 rework (decisions DE-1 to DE-80 in `docs/decision-log.md`), a change request
after the Build 1 gate and before Stage 13 (DE-33). It was built in two parts, each with its own
report, and closed by a final pass (golden saves, the full checks, the gate's captures and this
report):

- **Combat v2 and the arrow fix** (addendum section 1; DE-1 to DE-15 folded, DE-35 to DE-59 built):
  [rework-2.4-combat.md](rework-2.4-combat.md).
- **The opening, guidance, world fixes and music fades** (addendum sections 2 to 6; DE-16 to DE-34
  folded, DE-60 to DE-79 built): [rework-2.4-opening.md](rework-2.4-opening.md).
- **The final pass** (DE-80): golden save 10 frozen, golden save 11 made; the Stage 12 capture
  brought to the 2.4 game.

**The Build 1 gate now covers this rework** (see [stage-12.md](stage-12.md)): the user playtests
Chapter 1 as 2.4 plays it, and Stage 13 waits for the user.

## Implemented
**Combat v2** (full list in [rework-2.4-combat.md](rework-2.4-combat.md)): the combat stance facing
the cursor with forward, strafe and back-off speeds; lock-on (Z, middle mouse, pad R3) with the
camera centred between the two; attacks that commit, reach for every weapon, lunges; nine weapon
movesets and their rules (the axe hook, the spear's edge, the sword's parry, the Dane axe's guard
break, mail by damage type); poise, flinch, stagger, knockdown and get-up; the bigger parry (14
ticks of hitstop, a star and a ring, the attacker open 60 ticks) and a heavy riposte; guard stamina
and guard breaks; enemies that want to live (holding off, circling, stepping in and out, backing off
when hurt, calling for help, falling back, one or two pressing while the rest circle, cornered
runners surrendering); hit reactions with hitstop as a held clock in the simulation; health and
stamina as two fading bars and a thin enemy bar; exhaustion; healing with bindings and rations (H);
arrows swept against every body, shield and piece of cover each tick, so none passes through
anyone; shields that stop arrows; aware enemies' sidesteps; sneaking with footfall noise, awareness
and the "?" and "!" marks; backstabs; warnings at 8, 5 and 3 tiles; checkpoint autosaves (before
set-piece fights, on reaching camp, on waking); the scavengers at dusk (Svart and Conn at the stern,
a fight built to teach the parry, or walk away, bargain or sneak); world state version 11.

**The opening** (full list in [rework-2.4-opening.md](rework-2.4-opening.md)): the played cold
open at sea and the waking in the surf; Hild in the net, the seax on the way and the hold-to-cut;
Thorkel's locked chest carried to its outline at the camp; the first fire, Hild walking up at its
smoke, the sail raised between the oars in one visible action; the key from Thorkel's body however
Bran's search ends, the chest opened (the bow, quiver, chart fragment, bindings, comb, whetstone);
the bow's first use on the mast stores; Oddi's dilemma over the ship's silver in its strongbox;
Runa's "Where have you put it?"; every rescued person getting up, walking to the camp, working and
sleeping under the shelter; guidance in speech with no markers (19 aims, the journal on J, stuck
hints); "Nothing that way" at edges; doors (the broch's door, the shelter's flap); the shelter's
inside; the Hag's Stone's hush, cold light, hold, gust and settle; music that fades in and out; the
silver arm-ring, the seal, the gulls and the crab; the first night's fire with Hild.

**The final pass** (this session):
- **Golden saves** (DE-80): golden save 10 is frozen like goldens 1 to 9: its test loads it through
  the migration chain to version 11 and plays on, and no longer makes it again from its scenario
  (that scenario began with the opening 2.4 replaced). **Golden save 11** (schema 11) is the new
  chapter-end save: the world of the chapter run, `playChapter('chapter-1')` at the scripted pace
  (`src/tools/play/chapterRun.ts`), the same run whose telemetry is given under **Timing**. It plays
  the 2.4 Chapter 1 from waking to the sea map closed: the new opening, the scavengers at dusk left
  alone, the first night's fire, Oddi's strongbox first, Runa by a confession at the Hag's Seat and
  her question answered truly, Bran's search by a fight at the fold (combat v2's first fight), the
  key from the body, the chest and the bow, the mast stores, the boards and rigging, the oar found
  once all three scavengers fell, the extended hold, the sea burial, and the launch as Grey Seal
  under a woad raven. `npm run golden` now writes only golden 11, and a test checks that its
  scenario reproduces it exactly (`src/tools/saves/golden.ts`, `tests/unit/saves.test.ts`,
  `tests/golden-saves/README.md`).
- **The Stage 12 capture shows the 2.4 game** (`src/tools/art/capture.ts`): the strand's still now
  starts in play, awake where the steerer gets up, because the naming screen leads into the cold
  open at sea (DE-67; `standard.spec.ts` does the same); and two 2.4 views join the gate's
  capture: the camp with the sail raised (`camp-sail`) and the scavengers at the stern at the first
  dusk (`dusk-stern`).
- **A test for "music never starts or stops at full volume except stingers"** through the game's
  own router and content (see **Tests**).

## GIFs
Captured from the real game (`npm run capture -- rework-2.4-combat` and `-- rework-2.4-opening`),
each under 4 MB.

**A parry and riposte** (`docs/art/rework-2.4/combat/parry-riposte.gif`, 0.18 MB): Svart's slow
heavy with its large tell, the parry's star and long hitstop, Svart reeling open, the riposte, the
fall.

![A parry and riposte](../art/rework-2.4/combat/parry-riposte.gif)

**Backing away while locked on** (`back-off.gif`, 0.49 MB): locked on to Svart, backing off west and
strafing, the stance facing him throughout.

![Backing away while locked on](../art/rework-2.4/combat/back-off.gif)

**Hit reactions to a light and a heavy hit** (`hit-reactions.gif`, 0.35 MB): a light seax hit
(flinch, knockback, flash, spray), then a charged heavy (stagger, shake).

![Hit reactions to a light and a heavy hit](../art/rework-2.4/combat/hit-reactions.gif)

**A hurt enemy backing off** (`hurt-backs-off.gif`, 0.53 MB): Svart badly hurt, holding off further
and backing away as the steerer presses.

![A hurt enemy backing off](../art/rework-2.4/combat/hurt-backs-off.gif)

**An arrow blocked by a shield** (`arrow-blocked.gif`, 0.25 MB): an arrow into Svart's raised
shield, the thunk and splinters, the arrow stuck in the board.

![An arrow blocked by a shield](../art/rework-2.4/combat/arrow-blocked.gif)

**An arrow dodged** (`arrow-dodged.gif`, 0.22 MB): aware Svart reading the draw and sidestepping;
the arrow passes.

![An arrow dodged](../art/rework-2.4/combat/arrow-dodged.gif)

**A backstab** (`backstab.gif`, 0.26 MB): Svart at work, unaware; the heavy strike and the fall.

![A backstab](../art/rework-2.4/combat/backstab.gif)

**The first five minutes** (`docs/art/rework-2.4/opening/first-five-minutes.gif`, 3.72 MB, 28.8 s
at 10 frames a second; and the strip of ten key frames, `first-five-minutes-strip.png`): the cold
open steered with the keys, the strike, the waking, the seax, the net cut, Hild carried up,
Thorkel's chest dragged home, the first fire, Hild walking up, the sail raised, under the sail.

![The first five minutes](../art/rework-2.4/opening/first-five-minutes.gif)

![The first five minutes, ten key frames](../art/rework-2.4/opening/first-five-minutes-strip.png)

## Tests
- `npm run lint`: **clean.** ESLint, Prettier, content lint (1346 strings, 507 registered IDs) and art
  lint (140 sheets, 30,582 frames, 0 placeholders).
- `npm run build`: **builds** (the usual large-chunk warning only).
- `npm test`: **48 files, 674 tests: 673 passed, 1 skipped, 0 failed**; then the frame-budget pass
  timed alone (`OE_BUDGET=1`): 1 passed (its other 7 skipped by design). The skipped test in the
  main run is that budget test, which runs only in the second pass. (Before this pass's new music
  test: 672 passed, 1 skipped.)
- `npm run test:browser -- --project=chromium`: **65 passed, 0 failed** (7.2 min, one full run on
  a quiet machine; no reruns needed). The standard on Wreck Strand: **96.4%** continuous motion with
  the camera still (threshold 80%), **62.5%** with reduced motion and low detail (threshold 50%),
  **3.31 ms** of script a frame (budget 5.5).
- The Stage 7 to 12 specs with `combat2` and `opening2` again, after the capture: **33 passed, 0
  failed** (3.9 min).
- No failure under load in this pass, and no threshold, standard or budget was changed. No probe or
  scratch tests were left in the tree (none were made).
- Firefox and WebKit were not run here. CI results: see the run for this commit.

**The tests the user asked for** (all pass):

| Asked for | File | Test |
|---|---|---|
| Arrows hit at every speed and in every combat state | `tests/unit/combat2.test.ts` | "the arrow fix (decision DE-10; Book 10 sweptHits)": "hits in every combat state at 16 tiles a second (fast ones would tunnel)", and the same at 64, 400 and 3000 tiles a second (idle, alert, attacking, blocking, dodging, staggered, downed and fleeing each time); "sweeps the whole path: a box is found however far the missile went in one tick"; "hits before, during and after a fight, and hits the dead (it sticks in the body)" |
| Rescued people reach camp and sleep under the shelter | `tests/unit/opening2.test.ts` | "everyone rescued gets up and joins the household (DE-22)": "Hild, Oddi, Bran and Runa reach the camp and sleep under the shelter, two nights running" |
| Music never starts or stops at full volume except stingers | `tests/unit/opening2.test.ts` | "music fades (DE-29)": "every start fades in, every stop fades out, and a change cross-fades"; "the mixer’s gain rises from silence and falls to it, never stepping at full volume"; and, new in this pass, "in the game’s router, every music cue starts and stops faded; only stingers are sharp" (every music cue in `content/audio.json`, started, changed and silenced through the game's `AudioRouter` with Book 10's fades as `playView.ts` gives them; every stinger a one-shot over a duck) |
| Closed doors block until opened | `tests/unit/opening2.test.ts`; `tests/browser/opening2.spec.ts` | "doors (DE-26)": "a closed door blocks movement and sight until opened; it opens when walked into and closes after", "the shelter’s flap exists only once the sail is raised"; in the browser: "the broch’s door opens when walked into and swings shut behind" |
| Blocked edges stop movement with a message | `tests/unit/opening2.test.ts`; `tests/browser/opening2.spec.ts` | "\"Nothing that way\" (DE-25)": "stops at deep water with its caption (DEEP), once in the cooldown, with no sliding", "gives STEEP at rock and NOTHING at the zone’s end with no link", "moves along an edge pressed at a shallow angle (a walk beside the shore is not caught)"; in the browser: "walking into the sea stops the steerer with \"The water's too deep\"" |
| Wounded enemies back off | `tests/unit/combat2.test.ts` | "enemies that want to live (decision DE-6)": "a wounded enemy backs off further, calls once for help, and the badly hurt fall back" (and the clip `hurt-backs-off.gif`) |

**Golden saves** (`tests/unit/saves.test.ts`, 30 tests): goldens 1 to 10 load through the
migration chain to version 11 and play on; golden 10's test now does what the frozen ones do
("golden save 10 (schema 10, frozen)": "loads through the migration and holds Chapter 1 ended: the
boat launched, named and marked", "plays on after the migration"); golden 11 "loads, matches its
hash and holds Chapter 1 as 2.4 plays it, ended" and "is reproduced exactly by its scenario".

## Stages 7 to 12 redone
Each stage's tests were run again in this pass (unit and scenario tests by stage, then the
stage's browser spec in Chromium). Every one passes.

| Stage | Unit and scenario tests run again | Browser spec |
|---|---|---|
| 7 | 60 passed (`home` 34, `driftwood` 14, `homeAudio` 8, `workLoops` 4) | `stage07.spec.ts` 6 passed |
| 8 | 60 passed (`people` 40, `synth` 12, `audioCoverage` 8) | `stage08.spec.ts` 4 passed |
| 9 | 116 passed (`combat2` 44, `combat` 35, `missiles` 23, `water` 14) | `stage09.spec.ts` 4, `combat2.spec.ts` 4 passed |
| 10 | 39 passed (`searches` scenario 11, `opening2` 25, `omen` 3) and the reachability tests (`tests/reachability/southern.test.ts`, in the full run) | `stage10.spec.ts` 2, `opening2.spec.ts` 5 passed |
| 11 | 37 passed (`repairs` scenario 13, `ship` 18, `shipArt` 6) | `stage11.spec.ts` 4 passed |
| 12 | 51 passed (`launch` scenario 10, `launch` unit 11, `saves` 30) | `stage12.spec.ts` 4 passed |

### Stage 7: day and night, shelter and first tasks
**What 2.4 changed:** the camp's work opens when the steerer first reaches the camp; Hild walks up
at the first fire's smoke and asks for the shelter; the sail is raised between the oars in one
visible action; the shelter's inside; the broch's door and the shelter's flap; aims in speech, the
journal and stuck hints with no markers; music that fades in from one layer and fades out; a
checkpoint autosave on reaching camp; the household sleeps under the sail (DE-16, DE-20, DE-23 to
DE-27, DE-29, DE-53, DE-61, DE-68).
**Its checks now:** 1 (no starvation or spoilage before `tutorialComplete`) and 2 (sleep after 18:00
to dawn and a report in sentences) hold (`home.test.ts`; `stage07.spec.ts` "sleeps after 18:00 to
dawn, and the morning report is written"); golden 11 sets `tutorialComplete` only at the launch. 3
and 4 (output at skill, only fishing timed; work loops for everyone, Book 10 time and stamina)
hold, and the sail raise is one more such action (`opening2.test.ts` "shows its outline when
carried near its home and settles there; Hild walks up at the fire"). 5 (the stamina bar and its
reasons) holds, with combat v2's health bar above it. 6 (the standard): the camp by day 85.8%,
under the sail at night 90.3%, the broch's door 82.3% (`docs/art/rework-2.4/opening/views/`) and
the camp with the sail raised 82.8% in the gate capture. 7 (audio): the hearth theme renders with
its fades (0.511 peak), and the door, flap, sail and flint have their sounds and captions.

### Stage 8: crew agents, schedules and conversation
**What 2.4 changed:** Hild works on the strand until the fire's smoke, then limps up, stays by the
fire until the sail is up, and then her day takes her (DE-62, DE-63); everyone rescued sits 4 s,
gets up, walks to the camp (at the limp if hurt), works, eats and sleeps under the shelter (DE-22,
DE-68); Runa asks "Where have you put it?" and a lie is found out (DE-21); her first job is no longer
raising the S0 shelter (DE-20).
**Its checks now:** 1 (Hild useful at once and always visibly doing something) holds in its 2.4
form: she is never idle, working on the strand before the smoke and at the camp after
(`stage08.spec.ts` "Hild goes to her work from the camp at once, and is always doing something";
`opening2.test.ts`). 2 (a wounded resident's wound as a topic) holds (`stage08.spec.ts` "talking
to wounded Hild offers her wound, and tends it"). 3 (the deltas, thresholds and bands) holds
(`people.test.ts`, 40). 4 (the standard) is covered by the camp views above. 5 (voices): every
speaker has a voice blip, and the scavengers' new grunts are pitched from their voices (DE-48).

### Stage 9: combat
**What 2.4 changed:** combat v1 is replaced by combat v2 (DE-1 to DE-15, DE-35 to DE-59); the
first fight moves to the first dusk at the stern (Svart and Conn).
**Its checks now:** 1 (frame data matches Book 10, every tell at least 6 ticks before its active
frames) holds against the v2 movesets (`combat.test.ts`, retuned under DE-55; `combat2.test.ts`
"every weapon meets a body at its reach and not beyond"). 2 (a parry in the window staggers the
attacker; a full charge breaks a block but not a parry) holds, the parry now opening the attacker
for 60 ticks (`combat2.test.ts` "a parry opens the attacker for Book 10’s time; the riposte is
heavy, distinct and big"). 3 (missiles) holds and is stronger: every missile is swept against every
body, shield and cover each tick (`combat2.test.ts`, `missiles.test.ts`; `stage09.spec.ts` "nobody
moves while drawing"). 4 (the steerer's death is game over and reloads; a downed ally never dies on
a timer) holds (`stage09.spec.ts`). 5 (the standard): the dusk at the stern 88.7% in the gate
capture; the seven combat clips. 6 (audio): ten new combat sounds, all rendered under the ceiling.

### Stage 10: the three searches and the southern island
**What 2.4 changed:** the searches' people are placed at 19:00 on the first day and named at the
first night's fire; Oddi's dilemma is over the ship's silver in a strongbox; the fold holds whoever
of the band is free after the dusk; the key comes from Thorkel's body however Bran's search ends and
opens his chest (the bow); the bow's first use is the mast stores; Runa's question; everyone rescued
joins the household; the Hag's Stone's hush, light and hold (DE-14, DE-16 to DE-19, DE-21, DE-22,
DE-28, DE-64, DE-65, DE-71).
**Its checks now:** 1 (two viable approaches a search, recorded as a fact) holds for all six
approaches (`searches.test.ts`, 11) and the key on each of Bran's outcomes (`opening2.test.ts` "his
key reaches the steerer however Bran’s search ends"). 2 (reachability at high and low tide) holds
(`tests/reachability/southern.test.ts`). 3 (the Hag's Seat declares sign, rule, response and
consequence) holds (`omen.test.ts`), and the stone's effect lasts 6 to 10 s in its phases
(`opening2.test.ts` "the Hag’s Stone"). 4 (the standard): no new southern view was captured in
this pass; the Stage 10 captures stand, and the stone's mist and figure are drawn from palette
sheets (`fx_hag`, `fx_hag_mist`). 5 (audio): the stone's drone, whisper and gust are rendered.

### Stage 11: boat repairs and the first fitting
**What 2.4 changed:** the oar's trade uses the ship's silver (or salt fish); Seal Cave holds whoever
of the band is left, and the oar is found if all three are dead; Hild's line by the old boat comes
on the first day (DE-14, DE-17). The repair bot works round wounded Runa at the boat's work spot.
**Its checks now:** 1 (each repair visibly changes the boat) holds (`shipArt.test.ts`;
`stage11.spec.ts` "the drawn boat changes with each repair"). 2 (`deriveStats` for T1 with each
fitting) holds (`ship.test.ts`). 3 (no task asks for a large count) holds (`repairs.test.ts`). The
oar found at the empty skiff is played in golden 11 (`repair.oar` FOUND). 4 (the standard): the
launch views below. 5 (audio): unchanged and rendered.

### Stage 12: the launch and the Build 1 gate
**What 2.4 changed:** the telemetry gains the cold open's end, Hild cut free, the chest at the camp,
the shelter raised, the dusk and the chest opened, and the bow's mark is the chest; check 1 also
measures Book 10's first minutes; the golden saves follow the new opening (DE-12, DE-30, DE-80).
**Its checks now:** see **Gate checks** below.

## Gate checks
1. **Chapter 1 takes 45 to 60 minutes for a new player, with combat inside 25 minutes (by
   telemetry): MEASURED, NOT PROVEN.** The scripted full route takes 59.8 minutes at the bot's pace
   and 62.3 at a human pace; the first fight is at 16.6 to 17.3 minutes (the fold), and the dusk
   fight is on offer from about 10 minutes. See **Timing**.
2. **User playtest: READY.** `docs/playtest/build-1.md` is brought up to the 2.4 game (the storm,
   the net, the camp and the sail, the dusk, the key and the chest; lock-on, healing, the journal
   and the pad's new sneak button).
3. **Art lint clean for every Build 1 asset, no placeholders: PASS.** 140 sheets, 30,582 frames,
   0 placeholders.
4. **The Book 7 section 14 standard: PASS** for every in-world view of the gate capture (see **Art
   check**: 82.8% to 93.9% against 80%) and the rework's own views (82.3% to 96.4%).
5. **Firefox and WebKit block publishing: PASS by configuration.** `.github/workflows/ci.yml`'s
   `deploy` still `needs: [check, browsers-firefox, browsers-webkit]`. CI results: see the run for
   this commit.
6. **Audio: PASS.** Every new sound and the music's fades render under the ceiling (see
   **Balance**); every music cue fades in and out through the game's router and only stingers are
   sharp (the new test). I cannot hear the renders: the user should listen in the sound test.

## Timing
Measured by the telemetry, the scripted player playing the whole chapter through the simulation's
commands (`node src/tools/play/chapterRun.ts chapter-1 [human]`, seed chapter-1; the bot route is
golden save 11). The clock starts at the waking: the 38 s cold open comes before it.

| Mark | Bot pace | Human pace | Book 10 target |
|---|---|---|---|
| seax | 0:05 | 0:05 | seaxBy 1:30 |
| Hild cut free and safe | 0:37 | 0:37 | hildFreedBy 2:30 |
| the chest at the camp | 1:07 | 1:13 | chestAtCampBy 4:00 |
| the first fire | 2:10 | 2:22 | firstFireBy 5:00 |
| the sail raised | 2:59 | 3:11 | shelterBy 6:00 |
| Hild's leg tended | 3:59 | 4:19 | |
| the dusk over (the scavengers left alone) | 10:42 | 10:42 | firstFight "the first dusk, about 12 minutes" |
| the first night | 11:24 | 11:24 | |
| Oddi / Runa / Bran | 12:57 / 14:36 / 16:39 | 13:12 / 15:10 / 17:23 | |
| the first fight (the fold) | 16:33 | 17:16 | Book 1: inside 25 minutes |
| the bow (the chest opened) | 18:05 | 18:50 | bowBy 20 to 30 |
| the mast stores | 19:28 | 20:16 | |
| the hull, rigging and oar | 50:09 to 50:50 | 51:12 to 51:52 | |
| the fitting | 51:36 | 52:57 | |
| the rites | 59:22 | 60:16 | |
| the launch | 59:31 | 61:41 | |
| **the chapter's end** | **59:49** | **62:19** (2:50 of it held by menus) | **45 to 60 minutes** |

Stated honestly against Book 10:
- **The chapter's length** is at the top of the range at the bot's pace and **2 minutes over it at
  the human pace**. The bots walk straight to every goal and never search; a new player will add
  finding time (the Stage 12 report reckoned 10 to 20 minutes). Against that, about 30 minutes of
  the run is waiting from the mast stores (day 2) to the repairs (day 5): the boards' patch, low
  water for the rigging and the oar, with the bot awake through the nights. A player who works the
  boat by hand and sleeps through the nights cuts much of it. My estimate for a new player stays
  about 50 to 65 minutes; the playtest will tell.
- **The first minutes** are all well inside their targets for a bot that walks straight there; the
  in-page capture's bot (`first-five-minutes.gif`) cut the net at 75.8 s and raised the sail at
  214 s from the cold open's first frame, also inside. A new player will be slower; these targets
  are for a scripted new player, and they hold.
- **The bow at 18 to 19 minutes is a little before bowBy's 20 to 30** (flagged in the opening
  report): Book 10's limit (bowFoundBy 30 minutes) holds; the typical window is missed early, not
  late.
- **Combat inside 25 minutes**: the dusk fight is on offer at about 10 minutes (Book 10 says about
  12), and the bot's first fight at the fold comes at 16.6 to 17.3 minutes. A player can still
  avoid every fight (walk away at dusk, bargain or sneak at the fold, trade for the oar): Book 1's
  "combat inside 25" holds only if the player takes a fight (as flagged at Stage 12).

## Art check
Captures in `docs/art/captures/stage-12/` (`npm run capture -- stage-12`; its README lists every
file). For the Build 1 gate the capture now shows the 2.4 game: the strand's still starts in play
where the steerer gets up (the naming screen now leads into the cold open, DE-67), and two 2.4 views
were added, the camp with the sail raised and the scavengers at the stern at the first dusk.

**Motion with the camera still** (Book 7 section 14, 80% of cells), every in-world view:

| View | Moving cells |
|---|---|
| Wreck Strand where the steerer gets up (`still`) | 93.9% |
| The boat ready on its skids (`launch-ready`) | 88.9% |
| The heave and the run down the skids (`launch-heave`) | 91.7% |
| Afloat under the mark, rowing (`launch-sail`) | 93.1% |
| **New:** the camp with the sail raised, the fire lit (`camp-sail`) | 82.8% |
| **New:** the first dusk at the stern, Svart and Conn (`dusk-stern`) | 88.7% |
| The rework's views: Hild in the net / the camp by day / under the sail at night / the broch's door | 93.4% / 85.8% / 90.3% / 82.3% |
| The strand in `standard.spec.ts` (and with reduced motion and low detail) | 96.4% (62.5%, threshold 50%) |
| The sea map (a screen, not an in-world view; for the record) | 72.9% |
| Book 7 threshold | 80% |

Every in-world view meets the threshold. The lowest are the camp (82.8%) and the broch's door
(82.3%), where the broch's dry-stone walls fill much of the view and hold still, as stone does.

**GIF sizes**: `launch-clip.gif` 1.19 MB; the combat clips 0.18 to 0.53 MB; the first five minutes
3.72 MB. Every GIF is under 4 MB. (`launch-clip.mp4` is 4.4 MB, an MP4 at 2x, as at Stage 12.)

**Compared with `docs/art/reference/`** (`wreck-strand-target.png`, `kelda-summer-target.png`,
`target-walk.mp4`):
- **The strand** (`still`, `compare.png`): the shingle, sand ripples, wrack, dune grass, the foam
  line and the moving sea match the reference's ground as at Stage 6; the steerer reads at 1x.
- **The camp** (`camp-sail`): the broch's walls, the machair's flowering sward and the grazing sheep
  carry the reference's density; the raised sail reads as cloth between the oars with gear and
  drying clothes under it, and the fire's smoke rises. It is a midday view, so the fire's warm pool
  (strong at night, `shelter-night`) is faint.
- **The dusk** (`dusk-stern`): the dusk grade makes the strand flatter and greyer than the
  reference's daylight, as the time of day asks; the scavengers read clearly against the sand with
  their "!" marks (they have seen the steerer at the dune grass's edge), and the stern's timbers
  stand at the water.
- **The launch** (`launch-*`): unchanged from Stage 12 but for the 2.4 world about it (the woad
  raven reads at 1x; the crew row in time).
- **Shortfalls** (as before): the heave has no pushing pose; the boat runs broadside down the
  beach; no rain yet, so no rain on the sail.

**New art in 2.4** (each palette-indexed, compiled, rendered at 1x and 4x and inspected; art lint
clean, 0 placeholders): combat v2's five new fight states on every body sheet, `ui_combat`,
`fx_combat` and Svart's slung shield (`docs/art/rework-2.4/combat/sheets/`); the opening's 17
sheets (`docs/art/rework-2.4/opening/`). No person was drawn new or redrawn except Svart's slung
shield layer, which is for the user's review.

## Balance
- Every number is read from `content/balance.json` (Book 10 revision 2.5). Combat v1's tables are
  gone, as DE-13 and DE-35 asked; the opening's numbers are Book 10 section 25's. Where Book 10
  gives a range the build takes one value: the cold open 38 s (DE-77), the layers joining at 25 s
  (DE-76), the Hag's hold 4 s.
- **Audio levels** (`npm run audio:render`, the full render in this pass; peak / RMS, linear; the
  ceiling is -1 dBTP, about 0.89). No item clips; the loudest in the game is still the guard break
  (0.806 peak).

  | Combat v2 | Peak | RMS | The opening | Peak | RMS |
  |---|---|---|---|---|---|
  | The steerer's hurt breath (never a cry) | 0.228 | 0.0220 | The strike (cold open) | 0.522 | 0.0383 |
  | A grunt (Svart, 150 Hz) | 0.167 | 0.0166 | Coughing | 0.153 | 0.0165 |
  | A grunt (Ketill, 98 Hz) | 0.165 | 0.0133 | The net parts | 0.120 | 0.0120 |
  | A grunt (Conn, 244 Hz) | 0.161 | 0.0194 | The chest dragged | 0.150 | 0.0136 |
  | The parry's ring | 0.265 | 0.0486 | The chest set down | 0.316 | 0.0418 |
  | The riposte | 0.706 | 0.1600 | Flint | 0.205 | 0.0124 |
  | The lunge's tell | 0.198 | 0.0222 | The sail raised | 0.189 | 0.0395 |
  | The backstab | 0.481 | 0.1116 | Key and lid | 0.101 | 0.0196 |
  | The sidestep | 0.198 | 0.0190 | The lashing parts | 0.093 | 0.0122 |
  | Turning alert | 0.123 | 0.0165 | The bundle's splash | 0.296 | 0.0209 |
  | Binding a wound | 0.440 | 0.0263 | The ring's clink | 0.100 | 0.0231 |
  | Eating | 0.116 | 0.0084 | A door's creak / knock | 0.145 / 0.205 | 0.0252 / 0.0279 |
  | An arrow into a shield | 0.267 | 0.0484 | A flap / a bar dropped | 0.098 / 0.257 | 0.0053 / 0.0295 |
  | | | | The Hag's drone / gust | 0.098 / 0.102 | 0.0200 / 0.0095 |
  | | | | The hearth theme with its fades | 0.511 | 0.0776 |

  The same figures as each part's own report: nothing in the sound changed in this pass. The hearth
  theme's render shows the fade's envelope (RMS 0.002 in its first second rising to 0.067 by the
  eighth, the layers filling by 25 s, then falling to 0.0007 over the 6 s fade-out).

## Deviations
DE-1 to DE-80 in `docs/decision-log.md` ("Design addendum 2.4" and its three building sections),
each with its reason. None departs from Book 1's intent.

## Known issues
- **The chapter runs a little long at a human pace** (62.3 min against 45 to 60) and **the bow
  comes a little early** (18 to 19 min against 20 to 30). See **Timing**.
- **A fight can still be avoided** in all of Chapter 1 (as at Stage 12).
- **The Stage 12 mockups were rewritten by the capture.** `npm run capture -- stage-12` also writes
  `docs/art/mockups/stage-12/launch-sail.png`, `launch-sail-loop.gif` and `screen-mark.png` (it
  did so at Stage 12, S12-19). They now show the same views over the 2.4 world, and are committed
  so in 2389228. Restoring the copies shown for approval was refused by this session's
  permissions, so it is left for the user: `git checkout 3f8a929 -- docs/art/mockups/stage-12`
  restores them.
- **No rain yet**: no rain on the sail or beading on the cloth; `AMB_RAIN_CLOTH` and
  `AMB_COLD_STORM` are registered but unused.
- **The mast stores at high tide** (DE-64): fetched at low water only.
- **Runa at the boat** while wounded stands idle at its work spot on day 4; a player pressing
  beside her talks to her first.
- **Old saves and the camp's bindings** (DE-79): saves from before version 11 get the chest's
  bindings but not the camp's two.
- **A broken shield has no art**; only Svart has a slung layer; the club or hammer has no Chapter 1
  item; perception models no light pools or cliff edges yet; visiting the fold during the dusk can
  meet the fold's band before the dusk's survivors join it.
- **The heave has no pushing pose**, the sea map has no ambience, and the Ship theme does not sing
  the boat's name (as at Stage 12).
- Firefox and WebKit were not run locally. CI results: see the run for this commit.

## Flagged for the user's review
Every choice from DE-1 to DE-80 that wants the user's look, short and grouped. The earlier list
for Stages 7 to 12 stands as written in [stage-12.md](stage-12.md) ("Flagged for the user's
review"), where it applies to what 2.4 did not replace.

**The opening and Chapter 1's story**
- The scavengers at dusk are Svart and Conn, with Ketill at the fold, not at Seal Cave (DE-14);
  Svart's first fight is built to teach the parry (60% heavies, a slower heavy; DE-15).
- Oddi's dilemma over the ship's silver in a new strongbox (DE-17, DE-71).
- The opening's order and its choices: Hild sets off at the first smoke, the searches' people placed
  at 19:00 on day 1 (DE-16); Hild works on the strand until the smoke, and the limp is used only on
  the walk home (DE-62, DE-63).
- The shelter's target is 6 minutes, a minute past "the first five" (DE-30).
- The mast stores fall on the flats and are fetched at low water; or move the mast so they fall on
  shingle (DE-64).
- The bow at 18 to 19 minutes, before Book 10's typical 20 to 30.
- The cold open plays only for a new game from the naming screen (and `opening=full`; DE-67); it
  lasts 38 s (DE-77); the waking uses the downed frames (DE-78).
- The Hag's Stone's effect at every answer, not only the first visit (DE-65).
- The silver arm-ring as a VALUABLE that goes to the camp's silver (DE-70); two bindings at camp and
  three in the chest (DE-8, DE-79).

**Combat v2**
- Reused frames: the knockdown draws the downed frames, the sidestep the dodge frames, healing the
  kneel (DE-47).
- Svart's slung shield, new art for review (`docs/art/rework-2.4/combat/sheets/`; DE-47).
- The backstab arc read as 60 degrees either side of the back (DE-42).
- Cornered runners surrender; a cornered archer draws a sidearm once (DE-41).
- Riposte and backstab windups at 40% of the heavy's (DE-37); the axe hook's 30 ticks (DE-36).
- Rations packed from the camp's salt fish automatically on reaching camp (DE-45).
- No fight is forced in Chapter 1 (Stage 12's flag 1 still stands).

**Controls and interface**
- The pad: sneak from R3 to the d-pad's down, R3 for lock-on, quick command 1 off the pad (DE-3).
- Healing on H, not yet in the pad's command ring (DE-45).
- The "?" and "!" marks on by default, toggled on A in the system menu (DE-57).

**Guidance, words and music**
- Hild gives the hints for aims whose speaker has not yet joined (DE-69); stuck help keeps its count
  through progress (DE-66).
- The `REFERS:` tag for third-person pronouns in lines to the steerer (DE-31, DE-74).
- Music waits for the first fire in the new opening (DE-76).

**Saves and bookkeeping**
- Golden save 10 frozen early, and golden save 11 as the chapter run's world with seed chapter-1
  (DE-80).
- CLAUDE.md's list of folded addenda now names 2.4 (DE-34); a change to the user's instructions
  file, for review.
- The Stage 12 mockups rewritten by the capture (see **Known issues**): keep or restore.
- The Build 1 playtest script (`docs/playtest/build-1.md`) was rewritten for the 2.4 game in this
  pass.

## Next stage ready
No. This rework comes before the Build 1 gate, which now covers it: the user playtests Chapter 1
as 2.4 plays it (`docs/playtest/build-1.md`), and Stage 13 (sea-map travel) waits for the user's
word.
