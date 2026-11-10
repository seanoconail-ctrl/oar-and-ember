# Oar and Ember, Book 03: 30-Stage Development Plan

*Build order for LLM-assisted development: decisions, prerequisites, deliverables, acceptance checks and a ready-to-use prompt for every stage.*

Thirty stages in five phases. Stage 12 delivers Build 1 (The Wreck), Stage 20 delivers Build 2 (The First Voyage, with the playable homestead and the whole island), Stage 24 delivers Build 3 (Reasons to Return), and Stages 25 to 30 complete and harden the campaign.

**How to use:** The Stage 0 decisions are now recorded. Give the coding LLM one stage at a time with the context pack in section 02. Do not begin a stage until the previous stage report says its gate passed. The user playtests every build gate personally.

_Planning only. No stage has been implemented or tested._


## 01 / How to use this plan
*One stage per working session. Each stage is small enough to review, test and reverse.*

### Phases
| Phase | Stages | Result |
|---|---|---|
| A Foundations | 1 to 5 | New project with automatic publishing, deterministic runtime, data and saves, WebGL renderer and art pipeline, input and audio engine |
| B Build 1: The Wreck | 6 to 12 | Chapter 1 playable on foot, day and night, combat, repairs, launch |
| C Build 2: The First Voyage | 13 to 20 | Sea travel, the whole island, Carrick with every approach, consequences, the homestead v1 |
| D Build 3: Reasons to Return | 21 to 24 | Saltvik on foot, ship upgrades, sea battle, relationships, first bargain |
| E Campaign | 25 to 30 | Chapters 3 to 8, the first winter, the mainland on foot, endings, hardening |

### Rules for every stage
- Implement only the stage's deliverables. Do not start the next stage.
- Follow Book 2 contracts and read every number from `balance.json` (Book 10). Record deviations in `docs/decision-log.md`.
- Never drop a locked Book 1 feature to make a check pass.
- Art is final art by Claude: author palette-indexed sources, compile them, render and inspect them, and report the check. Never permanent shapes or emoji.
- Write tests for each acceptance check, run them and report honestly, including failures.
- If a prerequisite is missing, a requirement conflicts or a decision is needed, stop and ask.
- Finish with a stage report in the Book 2 format, saved to `docs/stage-reports/`.
- Every stage that adds a new place or new visible content has the acceptance check "meets the Book 7 standard (section 14); capture compared with the reference", tested by art lint, `tests/unit/standard.test.ts`, `tests/browser/standard.spec.ts` and a capture (`npm run capture -- stage-NN`) compared with `docs/art/reference/` in the report. If it does not meet the standard, the stage is not done.
- Every new place starts with a mockup to that standard, and the stage waits for the user's approval of it before the place is built (the "First step" of Stages 7, 10, 14, 16, 21, 27 and 29).

### Gates
Stages 12, 20 and 24 are **build gates**: the user playtests the build personally and writes a short note against the Book 1 fun tests. Wider playtests can be added later.

## 02 / The context pack and master prompt
*Give the LLM exactly what it needs: the relevant books, the state of the repository and the last stage report.*

### Context pack for each session
1. Book 1 in full.
2. The Book 2 sections listed in the stage.
3. This book's Stage 0 decisions and the stage being implemented.
4. The Book 4 to 11 sections listed in the stage, always including the relevant Book 10 tables.
5. The previous stage report and the decision log.
6. A repository summary: tree, build and test commands, failing tests.

### Master prompt
```
You are implementing Stage <N> of "Oar and Ember", a pixel-art Viking settlement RPG in
TypeScript and WebGL for desktop browsers.

Authority: the user's latest instruction > Book 1 (design intent) > Books 4-11 (content, art,
dialogue, layouts, numbers, audio) > Book 2 (contracts) > Book 3 (build order). Book 10 and
content/balance.json are the only source of tuning numbers.

Do:
- Implement only Stage <N>'s deliverables, following Book 2's contracts.
- Author any art the stage needs as final palette-indexed pixel sources (Book 7), compile them,
  render them at 1x and 4x, inspect the images and note the check in the report.
- Write and run tests for every acceptance check; include the commands you ran.
- Record any deviation in docs/decision-log.md with its reason.
- Write docs/stage-reports/stage-<N>.md in the Book 2 report format.

Do not:
- Start Stage <N+1>, drop a locked feature, add a tactical pause, or weaken a test.
- Hard-code tuning numbers, use placeholder shapes or emoji, or leak hidden truth to the player.
- Refer to the steerer with gendered pronouns or terms.

If a prerequisite is missing or requirements conflict, stop and ask before writing code.
```

## 03 / Stage 0: decisions recorded
*Twenty decisions settled on 10 November 2026. Record them in the decision log before Stage 1. Decision 9 remains open.*

| # | Decision | Decided |
|---|---|---|
| 1 | Engine and language | TypeScript (strict) with WebGL2, a new project built from scratch |
| 2 | Platforms and input | Desktop browser first; keyboard, mouse and gamepad |
| 3 | Art production | Final art authored by Claude as palette-indexed sources, compiled and visually checked; the user reviews at gates |
| 4 | Art scale | 640 x 360 viewport, 24 px tiles, 32 x 40 people; all art new |
| 5 | Combat model | Real time with no pause: light attack, charged heavy, parry, block, dodge, stamina and facing |
| 6 | Player character | The player names the steerer and chooses one of two body models; gender is never stated |
| 7 | Can the steerer die? | Yes. Death is game over, with reload; optional *Second wind* |
| 8 | Crew permadeath | Yes, with the *Rán's mercy* option |
| 9 | Campaign length | **Open.** Provisional: 40 to 60 hours over 270 days with days of about 17 minutes; confirm after Build 2 |
| 10 | Sea map model | Charted routes on a node graph |
| 11 | Sea battle scope | One-on-one first; up to three ships late; no fleet command |
| 12 | Rating and violence | Mature: lots of blood and gore; civilians and the surrendered can be killed, with consequences that depend on witnesses and evidence. Hard limits stay: no children as actors, no sexual violence, no player torture |
| 13 | How literal the myths are | Ambiguous: powers appear through signs and proxies; relics' power never settled |
| 14 | Language and names | A mix: native-form names with accents, English dialogue with a curated set of Norse and Irish words (Book 8) |
| 15 | Nessa's stance | Seeded at random per campaign and hidden |
| 16 | Save model | Free saves when safe, rotating autosaves and checkpoints |
| 17 | Romance | No romance system; characters may have existing relationships |
| 18 | Authored versus procedural | Hand-authored scenarios and cast; generated residents and minor variants only |
| 19 | Audio and voice | Voiced barks at most; music is a priority (Book 11) |
| 20 | Gate sign-off and title | The user playtests each build gate initially. Title: **Oar and Ember** (a quick web search found no game of that name; a trademark check is still needed) |

## 04 / Phase A: Foundations
### Stage 1: Project setup
**Goal:** a new, empty-but-working game project that builds, tests and publishes itself.
**Prerequisites:** Stage 0 recorded; a GitHub repository containing `CLAUDE.md`, `docs/` and `content/balance.json`.
**Deliverables:**
- A TypeScript (strict) project using Vite, with npm scripts for `dev`, `build`, `test` and `lint`; Vitest for tests; ESLint and Prettier.
- The Book 2 folder layout with empty modules and a short README in each.
- A WebGL2 canvas at 640 x 360 with integer scaling and letterbox, showing a title screen that reads "Oar and Ember" and the build number.
- A GitHub Actions workflow that runs lint and tests on every push, and publishes `main` to GitHub Pages.
- `docs/decision-log.md` with the Stage 0 decisions, `docs/stage-reports/`, and an ID registry seeded from Books 4 to 11.
**Acceptance checks:**
1. `npm ci && npm run lint && npm test && npm run build` passes locally and in GitHub Actions.
2. The published Pages address shows the title screen in Chromium, Firefox and Safari.
3. The decision log contains all twenty Stage 0 decisions.
```
PROMPT  Stage 1. Read CLAUDE.md, Book 1, Book 2 sections 01-02 and Book 3 sections 01-03. The repo
has only docs and content. Set up TypeScript + Vite + Vitest + ESLint, the Book 2 folder layout,
a WebGL2 title screen, a GitHub Actions workflow for lint, tests and GitHub Pages, the decision
log, stage-reports/ and the ID registry. Tell me the one GitHub setting I must switch on for Pages.
```

### Stage 2: Core runtime and calendar
**Goal:** a deterministic foundation with the real-time day.
**Prerequisites:** Stage 1.
**Deliverables:** fixed 60 Hz tick; calendar with days, minutes, watches, seasons and tide; on-foot clock, sleep and collapse; named RNG streams; command and event bus; lint rule banning `Math.random` and wall-clock time in `sim/`; record-and-replay determinism harness.
**Acceptance checks:**
1. Replay reproduces identical state hashes.
2. Calendar tests: day runs 06:00 to 02:00 at the Book 10 rate; sleep and collapse rules; tide alternation, phase shift and spring tides.
3. The lint rule fails a deliberate violation.
```
PROMPT  Stage 2. Read Book 2 sections 02-03 and Book 10 section 02. Implement the tick, calendar,
on-foot clock with sleep and collapse, tide, RNG streams, command/event bus and replay harness.
Add the lint rule. Test every calendar and tide rule.
```

### Stage 3: Content, world state and saves
**Goal:** validated data, one world state and safe saves.
**Prerequisites:** Stage 2.
**Deliverables:** schemas, loaders and registries; `balance.json` generated from Book 10; `WorldState`; content lint; seed data from Books 4, 5, 7 and 10; versioned saves with header and hash, migrations, autosave hooks, checkpoint API, safe-rule enforcement; golden save 1.
**Acceptance checks:**
1. Lint passes on seed data; a broken reference fails with file, path and reason.
2. Save under 200 ms; reload reproduces the state hash; a v1-to-v2 test migration passes.
3. Property tests: one-shots never refire; ledger and evidence are append-only.
```
PROMPT  Stage 3. Read Book 2 sections 04-05 and 20 and Book 10 section 01. Build schemas, loaders,
registries, balance.json generation, WorldState, content lint and versioned saves with migrations
and checkpoints. Seed data from Books 4, 5, 7 and 10. Create golden save 1.
```

### Stage 4: WebGL renderer and art pipeline
**Goal:** the pixel contract on WebGL and a working route for Claude-authored art.
**Prerequisites:** Stage 3.
**Deliverables:** WebGL2 renderer at 640 x 360 with integer scaling and letterbox; atlas and manifest loader; palette-indexed art source format and compiler; depth sorting and cutaways; day, dusk and night lighting; decal layer for blood; art lint; a render-to-image tool for visual checks; one test sheet (the steerer, body model A, idle) authored as final art.
**Acceptance checks:**
1. Art lint passes; pixel snapping holds at 1x, 2x and 3x.
2. A test sheet compiled from source renders identically to its preview image.
3. A test scene shows depth sorting, a cutaway and a lighting change correctly.
```
PROMPT  Stage 4. Read Book 1 section 17, Book 7 sections 01, 08 and 11-12 and Book 2 section 19.
Build the WebGL2 renderer, atlas loader, art source format and compiler, depth sorting, cutaways,
lighting, decal layer, art lint and the render-to-image check tool. Author one test sheet.
```

### Stage 5: Input, interface shell and audio engine
**Goal:** controls, safe menus and the music system skeleton.
**Prerequisites:** Stage 4.
**Deliverables:** action map with keyboard and gamepad, remapping, hold-or-toggle; command ring and quick commands; the safe rule for menus; text overlay; Web Audio engine with music state machine, stems, stingers, ambience layers, SFX by event and captions.
**Acceptance checks:**
1. Menus refuse to open while a test hostile is aware of the player.
2. Remapping persists; the command ring never stops time.
3. A music test switches states on bar boundaries and every test cue produces a caption.
```
PROMPT  Stage 5. Read Book 2 sections 02, 18 and 21 and Book 11 sections 03 and 09-10. Implement
input, remapping, the command ring, the safe rule, the text overlay and the audio engine with music
states, stems, stingers, ambience and captions. Test the safe rule and music transitions.
```

## 05 / Phase B: Build 1, The Wreck
### Stage 6: Player controller and the opening
**Goal:** control within seconds and the first rescue.
**Prerequisites:** Stage 5.
**Deliverables:** naming and body-model choice (two models, unlabelled); walk, run, sneak, interact, carry; Wreck Strand from Book 9; Hild calling beyond the rocks and carried above the tide line; final sprites for the steerer models and Hild.
**Acceptance checks:**
1. Control within five seconds of the naming screen.
2. Movement, interaction and carrying are taught by the rescue, without a control list.
3. No string addresses or describes the steerer with gendered terms (lint).
```
PROMPT  Stage 6. Read Book 4 section 08 (Chapter 1 beats 1-2), Book 9 sections 02-03, Book 7
section 07 and Book 8 section 03. Build naming and body models, the controller, interaction,
carrying and the Wreck Strand opening. Author and check the sprites. Test latency and carry rules.
```

### Stage 7: Day and night, shelter and first tasks
**Goal:** a small success: warmth, food, a first day and a first night.
**Prerequisites:** Stage 6.
**First step:** produce a mockup of the broch shelter and the camp at stages S0 and S1, by day and by night with the fire lit, to the Book 7 section 14 standard (a still and a loop at 640 x 360, saved to `docs/art/mockups/stage-07/`), then stop and wait for the user's approval before building it.
**Deliverables:** the broch shelter; fire; treating an injury; camp stages S0 to S1; the visible day clock, lighting and sleep; the task system v0 with player actions for gathering driftwood and fishing from the shore; tutorial food guard; morning report v0; home music and ambience for dawn, day, dusk and night.
**Acceptance checks:**
1. No starvation or spoilage before `tutorialComplete`.
2. Sleeping after 18:00 advances to dawn and produces a morning report in sentences.
3. The player's task action adds output at their skill, and missed timing never ruins a task.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-07/` against `docs/art/reference/`).
```
PROMPT  Stage 7. Read Book 1 sections 03 and 10, Book 2 sections 03 and 07, Book 10 sections 02-03
and Book 11 section 05. Build the broch shelter, fire, treatment, day clock, sleep, task system v0
with two player actions, the tutorial guard, report v0 and home audio. Test the guard and sleep.
```

### Stage 8: Crew agents, schedules and conversation
**Goal:** rescued people work, live visibly and talk.
**Prerequisites:** Stage 7.
**Deliverables:** the Person model; schedules; jobs and delegation; reason codes; barks; conversation topics from memories, including events and wounds; regard bands and the warning flow; Oddi's food-theft scene.
**Acceptance checks:**
1. Hild starts useful work immediately after rescue and is always visibly doing something.
2. Talking to a wounded resident offers a topic about the wound.
3. Unit tests cover regard deltas and band transitions with the two-day spacing.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-08/` against `docs/art/reference/`).
```
PROMPT  Stage 8. Read Book 5 sections 01-02, Book 8 sections 05 and 08-09, Book 2 section 06 and
Book 10 section 08. Implement people, schedules, jobs, delegation, reason codes, barks, topics and
the regard flow. Add Oddi's theft scene. Test topics, deltas and bands.
```

### Stage 9: Combat v1
**Goal:** real-time fighting that reads clearly and hurts.
**Prerequisites:** Stage 8.
**Deliverables:** combat states and Book 10 frame data: light combos, charged heavy with two tells, parry and riposte, block and guard break, dodge, shove, stamina and four-way facing; gore particles, decals, bloodied overlays, dismemberment and persistent corpses with the gore setting; downed and bleed-out; the steerer's death and game over with *Second wind*; surrender and finishers; morale; perception basics; three wreck-scavengers; quick commands; combat music and SFX.
**Acceptance checks:**
1. Frame data matches Book 10; every attack's tell precedes its active frames by at least 6 ticks.
2. A parry inside the window staggers the attacker; a full charge breaks a block but not a parry.
3. The steerer's death shows game over and reloads the latest autosave.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-09/` against `docs/art/reference/`).
```
PROMPT  Stage 9. Read Book 1 section 09, Book 2 sections 12-13, Book 7 section 12, Book 10 sections
06-07 and Book 11 section 07. Implement combat, gore, death rules, surrender, finishers, morale,
perception basics, the scavengers and quick commands. Test timing, parry, charge and game over.
```

### Stage 10: The three searches and the southern island
**Goal:** three searches that teach different things across real island ground.
**Prerequisites:** Stage 9.
**First step:** produce a mockup of Skarvholm's southern zones beyond Wreck Strand and the broch (the machair, Kelda, the sheepfold, the Hag's Seat headland) to the Book 7 section 14 standard (a still and a loop at 640 x 360, saved to `docs/art/mockups/stage-10/`), then stop and wait for the user's approval before building it.
**Deliverables:** Skarvholm's southern zones from Book 9 (Wreck Strand, machair, broch, Kelda, sheepfold, Hag's Seat headland); Oddi near the wreck; Bran guarding Thorkel's body at the sheepfold (fight, sneak or bargain); Runa at the Hag's Seat with the first supernatural sign; checkpoints.
**Acceptance checks:**
1. Each search has at least two viable approaches and records its decision as a fact.
2. Reachability tests pass for the southern zones at high and low tide.
3. The Hag's Seat event declares sign, rule, response and consequence.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-10/` against `docs/art/reference/`).
```
PROMPT  Stage 10. Read Book 4 sections 02 and 07-08, Book 5 section 02 and Book 9 sections 02-05.
Build the southern zones, the three searches, Thorkel's body, checkpoints and the Hag's Seat event.
Run reachability and scenario-runner tests for each approach.
```

### Stage 11: Boat repairs and the first fitting
**Goal:** three meaningful repairs, not a gathering grind.
**Prerequisites:** Stage 10.
**Deliverables:** the ship model and `deriveStats`; T1 hull art and states; repairs (hull boards; rigging from the skerry at low tide; steering oar from Seal Cave by fight, theft, trade or carving); crew work continuing while the player explores; one reversible fitting; Thorkel's rites.
**Acceptance checks:**
1. Each repair visibly changes the boat sprite.
2. `deriveStats` tests pass for T1 with each fitting, using Book 10 values.
3. No task requires collecting a large count of one resource.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-11/` against `docs/art/reference/`).
```
PROMPT  Stage 11. Read Book 7 sections 02-05, Book 2 section 08, Book 10 section 05 and Book 4
section 08 (beats 4-6). Implement the ship model, deriveStats, T1 art and states, the three repairs,
the fitting choice and the rites. Test stats, sprites and reversibility.
```

### Stage 12: Launch and the Build 1 gate
**Goal:** a fulfilling end to Chapter 1.
**Prerequisites:** Stage 11.
**Deliverables:** naming the boat and choosing a sail mark; the launch scene and its music; the read-only sea-map reveal; chapter-end save; golden save 2; a playtest script for the user.
**Acceptance checks:**
1. Chapter 1 takes 45 to 60 minutes for a new player, with combat inside 25 minutes (measured by telemetry).
2. User playtest: the chapter is finished and the user wants to launch.
3. Art lint clean for every Build 1 asset; no placeholders remain.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-12/` against `docs/art/reference/`).
```
PROMPT  Stage 12. Read Book 1 sections 15-16, Book 7 section 04 and Book 11 section 04. Build the
naming, sail mark, launch, reveal and chapter end. Prepare the user's playtest script and golden
save. Report timing honestly.
```

## 06 / Phase C: Build 2, The First Voyage
### Stage 13: Sea-map travel and voyage events
**Goal:** sailing that feels like choosing a route, with occasional interruptions.
**Prerequisites:** Stage 12.
**Deliverables:** nodes and edges from Book 4 with Book 10 times; plotting; per-watch resolution; wind, tide, visibility and forecast; stores; discovery; tide gates; winter closure; encounter tables and the governor; handoffs; one sea-map choice and one playable interruption (a wreck with survivors); sea music.
**Acceptance checks:**
1. Travel times are deterministic and match Book 10.
2. The Cauldron is passable only at slack water.
3. The governor keeps two quiet legs per eventful one over 200 simulated voyages.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-13/` against `docs/art/reference/`).
```
PROMPT  Stage 13. Read Book 1 section 08, Book 2 section 09, Book 4 sections 01 and 04, Book 10
section 02 and Book 11 section 03. Implement the sea map, travel, weather, tide gates, stores,
discovery, encounters and handoffs. Test times, gates and governor ratios.
```

### Stage 14: The whole island: exploration, resources and puzzles
**Goal:** Skarvholm worth exploring every day.
**Prerequisites:** Stage 13.
**First step:** produce a mockup of every new Skarvholm zone, the Seal Cave, the Skerry of the Drowned, the Hollow Cairn interior and the hermit's cell to the Book 7 section 14 standard (a still and a loop at 640 x 360, saved to `docs/art/mockups/stage-14/`), then stop and wait for the user's approval before building it.
**Deliverables:** every Skarvholm zone from Book 9; seasonal resource nodes; climbing routes; the Seal Cave tide puzzle and its back passage (reused in the Return); the Grey Men sunrise alignment; the Skerry of the Drowned causeway at spring low tides; the Hollow Cairn interior; the hermit's cell; region map discovery; zone ambiences.
**Acceptance checks:**
1. Reachability passes for every zone under each tide and season condition.
2. Each puzzle has an in-world hint and a solved fact, and the scenario runner can solve it.
3. Resource nodes appear and respawn only in their seasons.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-14/` against `docs/art/reference/`).
```
PROMPT  Stage 14. Read Book 1 section 11, Book 2 section 10, Book 4 section 02, Book 9 sections
02-04 and Book 10 section 03. Build every island zone, resource nodes, climbing, the four puzzles,
the cairn and the cell. Run reachability and puzzle-solver tests.
```

### Stage 15: Raid planning and intel
**Goal:** a plan made with incomplete information.
**Prerequisites:** Stage 14.
**Deliverables:** leads; intel with confidence and reveal conditions; scouting; the plan screen under the safe rule (landing, timing, tide, party, equipment, aim, one advantage); withdrawal shown in the plan.
**Acceptance checks:**
1. Hidden truth never appears before it is revealed.
2. The plan validates berths and party size.
3. Scouting reveals the Carrick items listed in Book 6.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-15/` against `docs/art/reference/`).
```
PROMPT  Stage 15. Read Book 1 section 05, Book 2 section 11 and Book 6 sections 01-02. Build leads,
intel, scouting and the plan screen. Test that hidden truth stays hidden.
```

### Stage 16: Carrick Landing
**Goal:** the first raid site, with every approach working.
**Prerequisites:** Stage 15.
**First step:** produce a mockup of Carrick Landing to the Book 7 section 14 standard (a still and a loop at 640 x 360, saved to `docs/art/mockups/stage-16/`), then stop and wait for the user's approval before building it.
**Deliverables:** the Carrick scene from Book 9; true state; guards with Book 10 sight and hearing; the watch post; runner and horn; dogs after a first raid; civilians (Colla, Eithne, the herdsman) with behaviours; dialogue for bargaining and threats; approaches steal, bargain, threaten, fight and slaughter; raid music.
**Acceptance checks:**
1. The scenario runner completes each approach on several seeds.
2. Sight and dead zones match Book 9's sightline table.
3. Alarm spreads only through sight, shouts, horns, dogs and the runner.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-16/` against `docs/art/reference/`).
```
PROMPT  Stage 16. Read Book 6 section 02, Book 9 sections 06-07, Book 2 sections 11-13 and Book 10
section 07. Build Carrick, its true state, AI, civilians, alarm channels, Colla, Eithne and every
approach. Test approaches and sightlines.
```

### Stage 17: Complications, extraction and evidence
**Goal:** plans change, getting home is part of the fight, and deeds leave traces.
**Prerequisites:** Stage 16.
**Deliverables:** complication rules (the Crows, payment, the patrol); carrying to the boat at both tides; cargo slots and berths; towing the currach; launch and rowing clear; bodies and dropped items as evidence; outcome bands; the post-raid summary.
**Acceptance checks:**
1. At most one complication per Carrick raid; withdrawal reachable from every state.
2. Carry distances at high and low tide match Book 9.
3. Killing every witness leaves evidence that can still be discovered.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-17/` against `docs/art/reference/`).
```
PROMPT  Stage 17. Read Book 6 section 02, Book 9 section 07 and Book 2 sections 11 and 15. Implement
complications, extraction, cargo, towing, launch, evidence and the summary. Test withdrawal, carry
distances and evidence.
```

### Stage 18: Ledger, knowledge and hostility
**Goal:** the coast remembers, and some of it wants you dead on sight.
**Prerequisites:** Stage 17.
**Deliverables:** deeds including `CIVILIAN_KILLED` and `SURRENDERED_KILLED`; identification from marks, faces and evidence; carriers and discovery; place and faction updates; hostility and territory guards; the no-quarter rule; crew judgement on return; seed-grain hooks.
**Acceptance checks:**
1. The ledger is append-only and deed tags match Book 6.
2. A massacre with no escaping witness and no linked evidence stays known only to the household.
3. A faction set hostile posts guards that attack on sight in its territory.
```
PROMPT  Stage 18. Read Book 1 section 06, Book 2 sections 13 and 15, Book 6 sections 01 and 11 and
Book 10 section 08. Implement deeds, identification, evidence discovery, carriers, factions,
hostility, no quarter and crew judgement. Test each rule.
```

### Stage 19: The homestead v1
**Goal:** a home that runs in real time and that the player wants to work in.
**Prerequisites:** Stage 18.
**Deliverables:** every homestead task with its player action; building designation with placement rules, adjacency and removal; the steading plan from Book 9; S2 buildings; the seasons model (crops, spoilage, fuel, livestock, sickness); steward policy; morning report v1; watching residents at work; building art and stages.
**Acceptance checks:**
1. Invalid placements show the failing rule; valid ones are built by residents and the player.
2. A headless 120-day delegated run meets the Book 10 survival targets with no player input.
3. A day with the player working beside residents produces noticeably more than one without.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-19/` against `docs/art/reference/`).
```
PROMPT  Stage 19. Read Book 1 sections 10 and 12, Book 2 section 07, Book 9 section 04 and Book 10
sections 03 and 09. Implement tasks, player actions, designation, seasons, the steward, report v1
and building art. Run the 120-day homestead simulation and report it against Book 10.
```

### Stage 20: Two leads, balance and the Build 2 gate
**Goal:** the player wants another voyage because they have a plan, and a day at home because there is something to do.
**Prerequisites:** Stage 19.
**Deliverables:** lead generation on return; autoplay harness with bot policies; balance pass against Book 10 progression targets to day 30; golden save 3; the user's playtest script.
**Acceptance checks:**
1. Every outcome band offers two leads.
2. No approach dominates every measure; the brutal policy is effective short-term and costly by day 60.
3. User playtest: a plan for the next voyage and a reason to stay home are described unprompted.
```
PROMPT  Stage 20. Read Book 1 section 03, Book 6 section 11 and Book 10 sections 10-12. Build lead
generation, the autoplay harness and policies, and run the balance pass. Report the approach table
and progression against the day-30 targets.
```

## 07 / Phase D: Build 3, Reasons to Return
### Stage 21: Saltvik on foot and trade
**Goal:** a voyage that works without violence, in a town you can walk.
**Prerequisites:** Stage 20.
**First step:** produce a mockup of Saltvik to the Book 7 section 14 standard (a still and a loop at 640 x 360, saved to `docs/art/mockups/stage-21/`), then stop and wait for the user's approval before building it.
**Deliverables:** Saltvik as an on-foot scene; traders and prices from Book 10; recognition of marked goods; hiring bench; Gunnhild's yard; Kolbeinn and Asa's debts; the wind-knot; town guards following hostility rules; harbour music.
**Acceptance checks:**
1. A player who never fights leaves with a fitting, a resident or a contact.
2. Goods from Carrick are recognised by their marks.
3. Guards greet, warn or attack according to Saltvik's hostility.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-21/` against `docs/art/reference/`).
```
PROMPT  Stage 21. Read Book 6 section 04, Book 5 sections 02 and 04, Book 4 section 07, Book 8
section 06 and Book 10 section 04. Build Saltvik on foot, trade, recognition, hiring, the yard, the
debts, the wind-knot and guard behaviour. Test the no-combat route.
```

### Stage 22: Ship upgrades and sea battle v1
**Goal:** a ship worth customising and a sea fight worth having.
**Prerequisites:** Stage 21.
**Deliverables:** fitting slots, refits, wear and maintenance, identity marks with art; the sea-battle arena (approach, missiles, grapple, boarding, break-off); one rival-boat encounter; sea-battle music.
**Acceptance checks:**
1. Every fitting changes stats and sprite as Books 7 and 10 list.
2. Either ship can break off before grappling.
3. Boarding resolves within ten minutes on average.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-22/` against `docs/art/reference/`).
```
PROMPT  Stage 22. Read Book 7 sections 02-05, Book 2 sections 08 and 14 and Book 10 section 05.
Implement fittings, refits, wear, marks and the sea battle. Test stats, sprites and break-off.
```

### Stage 23: Relationships, conversations and recruitment
**Goal:** people who remember, talk and change, and a household that grows.
**Prerequisites:** Stage 22.
**Deliverables:** ties including existing relationships; memories in dialogue; conversation topics about events, deeds and wounds; value shifts; the departure flow; Ulf as a returning character; the Followers' arrival; roster cap and temporary shelter; generated residents; harming residents and its consequences.
**Acceptance checks:**
1. The roster never exceeds sixteen; shelter requires a plan.
2. Residents raise a topic about a deed they witnessed within two days.
3. No resident leaves without the request scene; no romance tie can be created.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-23/` against `docs/art/reference/`).
```
PROMPT  Stage 23. Read Book 5 sections 01-02, 05 and 08, Book 8 sections 05 and 09 and Book 2
section 06. Implement ties, memories, topics, value shifts, departures, Ulf, the Followers, the
cap, shelter and generated residents. Test the cap, topics and departure flow.
```

### Stage 24: The supernatural and the Build 3 gate
**Goal:** the first real bargain, the newcomer and the restless dead.
**Prerequisites:** Stage 23.
**Deliverables:** powers and bargains with frozen terms; fairness lint; omens (the fetch); the Light in the Fog with the Ferryman and Nessa; the lyngbakr; Thorkel's draugr on Wreck Strand if his rites were not given; supernatural motifs from Book 11; golden save 4.
**Acceptance checks:**
1. Accepted terms survive save and load unchanged.
2. Fairness lint fails any dangerous mechanic missing a field.
3. User playtest: the user sets their own next goal rather than following a checklist.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-24/` against `docs/art/reference/`).
```
PROMPT  Stage 24. Read Book 1 section 13, Book 4 section 07, Book 6 sections 03 and 08, Book 5
section 03, Book 8 section 07 and Book 2 section 17. Implement powers, bargains, lint, omens, the
Light in the Fog, the lyngbakr and Thorkel's draugr. Test immutability and the Thrand promise.
```

## 08 / Phase E: The campaign
### Stage 25: Chapters 3 and 4 and the first winter
**Goal:** the open coast, a name on the water, and a winter that tests preparation.
**Prerequisites:** Stage 24.
**Deliverables:** chapter state machine; Glen Arra cattle; the Bell of Brecc and Breccán's drowned; the tribute ship; the karvi and continuity; harvest, slaughter and salting; the Cailleach's washing; winter at home (cold, fuel, sickness, Samhain, Yule); the Year 1 threat schedule from Book 10; Thrand; Nessa's reveal.
**Acceptance checks:**
1. A household at the Book 10 day-90 targets survives winter without deaths from cold or hunger; one at half fails visibly with warnings.
2. Nessa's reveal fires once and never repeats on load.
3. Hull replacement transfers name, marks, history and two fittings.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-25/` against `docs/art/reference/`).
```
PROMPT  Stage 25. Read Book 4 sections 04 and 08 (Chapters 3-4), Book 6 sections 05-07, Book 5
section 03, Book 10 sections 03, 10 and 11 and Book 11 section 05. Implement these chapters, the
scenarios, the karvi, harvest, winter and the Year 1 threats. Test the winter targets.
```

### Stage 26: Chapter 5, The Long Memory
**Goal:** the coast answers, and the island begins to fail.
**Prerequisites:** Stage 25.
**Deliverables:** the answer scheduler with precursors; the defence of Skarvholm using Book 9's landing points, blind spots and the watch cairn; settlement options; island failure; the household council.
**Acceptance checks:**
1. The answer matches the ledger for each autoplay policy.
2. Precursors appear at least five days before every answer.
3. Every answer can be settled before or during the fight.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-26/` against `docs/art/reference/`).
```
PROMPT  Stage 26. Read Book 6 section 09, Book 4 section 08 (Chapter 5), Book 9 sections 02-03 and Book
2 section 15. Implement the scheduler, precursors, the defence, settlement options, island failure
and the council. Test ledger matching and timing.
```

### Stage 27: Chapter 6 and the mainland on foot
**Goal:** a new home on someone else's coast, with a hinterland to explore.
**Prerequisites:** Stage 26.
**First step:** produce a mockup of the three mainland hinterland regions and the mainland home sites to the Book 7 section 14 standard (a still and a loop at 640 x 360, saved to `docs/art/mockups/stage-27/`), then stop and wait for the user's approval before building it.
**Deliverables:** three sites with acquisition paths; multi-voyage migration; the consort on the sea map only; mainland home stages M0 to M2; the three hinterland regions from Book 4 with known and unknown places, wilderness, wildlife, outlaws, territory guards and puzzles; outpost options; mainland music and ambience. This stage may be split into 27a to 27c (one region each) with a decision-log entry.
**Acceptance checks:**
1. Each site can be secured by at least two paths, and migration preserves everything moved.
2. Reachability passes for every hinterland region; unknown places start hidden.
3. Hostile territory guards attack on sight and stop after a settlement.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-27/` against `docs/art/reference/`).
```
PROMPT  Stage 27. Read Book 1 sections 11 and 14, Book 4 sections 03 and 08 (Chapter 6), Book 7
sections 06 and 13 and Book 10 section 07. Implement sites, migration, the consort, mainland
stages and the hinterlands. Run reachability and hostility tests.
```

### Stage 28: Chapter 7, The Gathering
**Goal:** an alliance of people with long memories.
**Prerequisites:** Stage 27.
**Deliverables:** the council (contributions, demands, offers, seating, conflicts); Muirenn's annal generated from the ledger; rival raiders' reaction; the Keepers' three keys and the revelation of Manannán's Cup; Orm's seizure of Skarvholm and the capture of any outpost; Asgrim's defection; Heid's persuasion paths; the effect of known massacres on every ally.
**Acceptance checks:**
1. Each ally's state is computed with readable reasons.
2. Conflicts between allies from Book 5 are enforced.
3. The annal reading matches the ledger exactly, including deeds the coast learned of.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-28/` against `docs/art/reference/`).
```
PROMPT  Stage 28. Read Book 5 sections 06-09, Book 4 sections 06-07, Book 8 section 06 and Book 2
section 16. Implement the council, the annal, rival reactions, the keys, Asgrim and Heid. Test ally
states, conflicts and annal accuracy.
```

### Stage 29: The Return to Skarvholm, the Sea King and the endings
**Goal:** a hostile return to the abandoned island, then a finale built from everything the player did. May be split into 29a (the Return) and 29b (the finale) with a decision-log entry.
**Prerequisites:** Stage 28.
**First step:** produce a mockup of the occupied island and the Hollow Cairn interior as Orm holds them to the Book 7 section 14 standard (a still and a loop at 640 x 360, saved to `docs/art/mockups/stage-29/`), then stop and wait for the user's approval before building it.
**Deliverables:** the occupied island and the Hollow Cairn interior from Book 9 sections 08 and 09; the garrison, horn, beacon, stakes and patrols; approaches A to E including the hólmganga; the Door of Three Truths with ledger-truth statements; Gróa, the drowned diggers and the wardens; the Cup's surge timers and exits; captives; the retry rule; the compact renewal at Inis Rón; preparation and checkpoint; the washer at the ford; the linked battle (sea engagement and home defence); weather tied to the keys; Orm's fates; endings and epilogue with reasons; finale music.
**Acceptance checks:**
1. Each Return approach recovers the Cup on some seed; the Door accepts exactly the ledger-true statements; surge timers match Book 10.
2. The Return is hard: the good-player policy succeeds first time in no more than 60% of seeds, and failure leaves the campaign winnable with one retry.
3. Defeat or the steerer's death restarts at the labelled checkpoint; each ending is reachable by at least one autoplay policy.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-29/` against `docs/art/reference/`).
```
PROMPT  Stage 29. Read Book 1 sections 04 and 14, Book 4 sections 07-08, Book 5 section 06, Book 6
section 10, Book 9 sections 08-09, Book 10 section 13 and Book 11 section 04. Build the Return to
Skarvholm, the compact renewal, the omen, the battle, Orm's fates and the endings. Test the Door,
the surge, the retry rule, the checkpoint and ending reachability.
```

### Stage 30: Release hardening
**Goal:** a complete, accessible, stable game.
**Prerequisites:** Stage 29.
**Deliverables:** accessibility pass; performance budgets; migrations from every golden save; full-campaign autoplay for every policy against Book 10; clean content and art lint; music and audio completion against Book 11; soak test; the user's final playtest.
**Acceptance checks:**
1. All Book 2 performance budgets are met on the reference machine.
2. Every golden save loads and migrates.
3. No placeholders remain in art or audio and both lints are clean.
4. Meets the Book 7 standard (section 14); capture compared with the reference (`docs/art/captures/stage-30/` against `docs/art/reference/`).
```
PROMPT  Stage 30. Read Book 2 sections 21-23, Book 7 section 11 and Book 11 sections 09-11. Run the
accessibility, performance, migration, autoplay, lint and audio passes. Report every remaining
issue with severity; do not mark the stage passed while a gate check fails.
```
