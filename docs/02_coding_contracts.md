# Oar and Ember, Book 02: Coding Contracts

*Architecture, data, systems, saves, AI, audio, art pipeline and testing: the rules every implementation stage must obey.*

Oar and Ember is a deterministic simulation with a pixel-art presentation on top. Content and numbers are data. Every consequence is a saved fact. Every stage proves itself with tests before the next begins.

**How to use:** Book 2 owns data shapes and runtime behaviour. Interfaces are TypeScript contracts. Every tuning number lives in Book 10 and in `content/balance.json`; this book refers to them rather than repeating them. Record any departure in the decision log.

_Specification only. Nothing here claims that code exists or tests pass. Stage 1 creates the project from nothing._


## 01 / Scope and decided platform
*A new project, built from scratch in TypeScript and WebGL for the desktop browser. There is no earlier codebase to preserve.*

### Starting point
An empty GitHub repository containing only `CLAUDE.md`, `docs/` (these books as markdown) and `content/balance.json`. Stage 1 sets up the toolchain, tests, lint and automatic publishing to GitHub Pages, so the user can playtest every build at a web address without installing anything.

### Decided (Stage 0)
- **Language:** TypeScript in strict mode. **Rendering:** WebGL2 with nearest-neighbour sampling. **Audio:** Web Audio API.
- **Platform:** desktop browsers first (Chromium, Firefox, Safari current versions); keyboard and mouse, with gamepad support.
- **Art:** authored by Claude as palette-indexed pixel sources compiled to atlases (section 19).
- **Combat:** real time with no tactical pause; light, charged heavy, parry, block, dodge, shove, stamina and facing.
- **Death:** the steerer's death is game over; crew permadeath with the *Rán's mercy* option.
- **Violence:** mature: gore and dismemberment; civilians and the surrendered can be killed, with consequences.

### Non-negotiables
- The simulation is deterministic for a given seed and input stream.
- Content and balance numbers live in data files validated at load.
- The UI shows only what the player knows; hidden truth never leaks.
- Locked Book 1 features that cannot be met are reported, never silently dropped.

## 02 / Architecture
*Layers with one-way dependencies. The simulation never imports rendering, audio or UI.*

```
src/
  core/        time, rng, ids, events, math, result types
  content/     loaders, schema validation, registries, string tables, balance
  sim/
    people/ home/ tasks/ build/ seasons/ land/ ship/ sea/ raid/ combat/ ai/
    ledger/ factions/ narrative/ supernatural/ calendar/
  scenes/      mode controllers: home, region, raid, harbour, seamap, seabattle, council, menus
  render/      webgl renderer, atlases, tilemaps, cameras, lighting, gore decals, fx, ui overlay
  audio/       music state machine, stems, sfx, ambience, captions
  input/       action map, rebinding, gamepad, command ring
  ui/          panels, reports, dialogue, build menu, planning screens
  persist/     save, load, migrations, checkpoints
  tools/       autoplay, scenario runner, reachability, content lint, art compiler, art lint
content/       json: places, regions, people, factions, hulls, fittings, tasks, buildings,
               scenarios, puzzles, dialogue, strings, balance.json
assets/        art sources (palette-indexed), compiled atlases, manifests, audio
tests/         unit, property, scenario, reachability, golden-saves
docs/          decision-log.md, stage-reports/
```

### Dependency rules
`core` depends on nothing; `content` on `core`; `sim` on `core` and `content`. `scenes` orchestrate `sim`, `render`, `audio`, `ui` and `input`. `render`, `audio` and `ui` read **views** of sim state and never mutate it. All mutations go through **commands** handled by sim systems, which emit **events**.

### Modes
```
Boot -> Title -> Campaign -> GameOver | Ending
Campaign modes:
  OnFoot     (home, island zones, mainland regions, raid sites, harbours) real time
  SeaMap     route plotting and watch-by-watch travel
  SeaBattle  ship-to-ship arena, boarding uses OnFoot combat rules
  Planning   raid plan, departure, council seating (opened only when safe)
  Dialogue   conversations (barks are not a mode)
  Report     morning report, post-raid summary (opened only when safe)
```
Every transition passes a typed **handoff** and returns a typed **result**. A mode never reaches into another mode's state.

### The "safe" rule
A menu or planning screen may open only when no hostile actor is aware of the player (`threat.awareHostiles == 0`). While open, simulation time stops. The system menu follows the same rule; when hostiles are aware it opens as an overlay without stopping time. There is no tactical pause.

## 03 / Time, determinism and the calendar
*A fixed tick, a real-time day on foot, watches at sea, and seeded randomness.*

- Simulation tick **60 Hz** fixed step with render interpolation.
- **Calendar:** `day` from 1; `year = ceil(day / 120)`; seasons of 30 days; four watches per day (Morning 06-12, Day 12-18, Evening 18-24, Night 00-06).
- **On-foot clock:** one game hour lasts `balance.time.secondsPerHour` real seconds (Book 10). The active day runs 06:00 to 02:00. Sleeping in a bed after 18:00 advances to 06:00 and triggers the morning report. Staying awake past 02:00 causes a collapse with the penalty in Book 10. A day-length option scales the clock.
- **At sea:** travel resolves per watch (six game hours) with a short animation.
- **Tide:** flood and ebb alternate each watch, low water at the end of each ebb watch, phase shifting one watch every three days; spring tides on days 1 and 16 of each season. Tidal ground is passable within the window in Book 10.
- **RNG streams:** `weather, encounters, loot, combat, ai, people, generation, gore` seeded from the campaign seed. No `Math.random()` or wall-clock time in `sim/`.
- **Determinism test:** replaying a recorded input stream from a save reproduces identical state hashes.

## 04 / Content data and IDs
*Content is data; numbers are data. IDs are stable forever.*

| Prefix | Type |
|---|---|
| `ISLE_ TOWN_ FORT_ ABBEY_ GLEN_ CAMP_ SITE_` | Places on the sea map |
| `REG_ ZONE_` | On-foot regions and their zones |
| `SK_` | Places on Skarvholm |
| `HAZ_` | Sea hazards |
| `C_ L_ R_ E_ H_ P_` | Residents, leaders, rival captains, enemies, hostages, player |
| `FAC_` | Factions |
| `HULL_ FIT_ REFIT_` | Hulls, fittings, refits |
| `BLD_ TASK_ RES_ ITEM_ CROP_` | Buildings, tasks, resources, items, crops |
| `SCN_ CMP_ BEAT_ CH_ PUZ_` | Scenarios, complications, beats, chapters, puzzles |
| `BARGAIN_ POWER_ OMEN_` | Supernatural bargains, powers, omens |
| `MUS_ SFX_ AMB_ VO_` | Music cues, sound effects, ambiences, voiced barks |

One schema per content type, validated at load; every cross-reference must resolve. `content/balance.json` is generated from Book 10's tables and is the only place numbers live. All player-facing text uses string keys.

## 05 / World state
*One serialisable world state. Everything that matters to a consequence lives here.*

```ts
interface WorldState {
  version: number; seed: string; rng: Record<RngStream, RngState>;
  calendar: { day: number; minuteOfDay: number; weather: WeatherState; tide: TideState };
  player: PlayerState;                    // vitality, stamina, skills, gear, bodyModel, name
  household: { residents: Id[]; hostages: Id[]; guests: Id[]; shelterPlan?: ShelterPlan };
  people: Record<Id, Person>;             // everyone with a name, alive or dead
  ships: Record<Id, ShipInstance>;
  homes: Record<Id, HomeState>;           // buildings, plots, designations, stores, fields
  regions: Record<Id, RegionState>;       // discovery, resource nodes, puzzles, bodies
  places: Record<Id, PlaceState>;         // settlements' true stores, defences, people
  factions: Record<Id, FactionState>;     // regard, fear, hostility, territory
  ledger: Deed[];                         // append-only
  evidence: Evidence[];                   // bodies, dropped items, tracks awaiting discovery
  knowledge: KnowledgeState;
  bargains: Record<Id, Bargain>; powers: Record<Id, PowerState>;
  chapters: Record<Id, ChapterState>;
  facts: Record<string, FactValue>; oneShots: Record<Id, number>;
}
```
The ledger is append-only; facts are superseded, never deleted; the dead stay in `people` with their memories; one-shots are recorded before their effects apply.

## 06 / People
*Residents are people with values, ties and memories. Their reactions are computed from witnessed deeds and shown in readable steps.*

```ts
type Value = 'GAIN' | 'MERCY' | 'GLORY' | 'KIN' | 'FAITH' | 'WORD';
interface Person {
  id: Id; nameKey: string; origin: Origin; appearance: AppearanceRef;
  status: 'alive'|'downed'|'wounded'|'sick'|'dead'|'missing'|'captive';
  vitality: number; skills: Partial<Record<Skill, 0|1|2|3|4|5>>; skillXp: Partial<Record<Skill, number>>;
  values: Partial<Record<Value, 1|2|3>>; faithTarget?: 'OLD_GODS'|'CHRIST'|'LAND_SPIRITS'|'NONE';
  regard: number;                         // -100..100 towards the player
  ties: Tie[];                            // kin, friend, rival, spouse, debt, grievance, oath, mentor
  memories: Memory[]; wounds: Wound[]; job?: JobAssignment; schedule: ScheduleRef;
  hiddenStance?: Id; valueShifts: number;
}
```
- **Regard bands, reactions and deltas** use the tables in Book 10 section 08. Crossing a band downwards triggers in order, with at least two days between steps: a remark, a complaint scene, refusal of the order class that caused it, a request to leave.
- **Ties** include existing relationships (spouses, siblings) from content; there is no romance system and no tie of type lover can be created in play.
- **Schedules:** each resident follows a daily schedule (wake, eat, work shift, meal, evening, sleep) adjusted by job, season, weather, wounds and events, so they are always visibly doing something.
- **Conversation topics** are generated from memories (recent deeds, deaths, wounds, the weather, their job, their ties) with a priority and a cooldown; residents may approach the player with high-priority topics.
- **Player references:** dialogue never uses gendered pronouns or gendered terms for the steerer. Content lint rejects strings tagged as addressing or describing the steerer that contain them.
- **Harming residents:** the player can strike residents. The first blow triggers a warning reaction; repeated harm or a killing is a deed with household-wide consequences, up to residents fleeing, fighting back or leaving.

## 07 / The homestead: tasks, building and seasons
*The home runs in real time. Residents work by schedule; the player can join any task or designate new buildings.*

### Tasks
```ts
interface TaskDef { id: Id; skill: Skill; station: StationKind | ZoneKind; season?: Season[];
  minutesPerUnit: number; output: Yield[]; inputs: Cost[]; tools: Id[]; playerAction: ActionKind }
interface TaskInstance { def: Id; site: Id; workers: Id[]; progress: number; quality: number }
```
- Tasks include sow, weed, harvest, fish (shore and boat), gather (shellfish, seaweed, eggs, driftwood), cut peat, cut hay, build, carpentry, smith, cook, care, herd, shear, slaughter and preserve, repair ship, train, watch.
- **Player participation:** the player interacts with a task site and performs its `playerAction` (timed press, hold-and-release, or rhythm), adding work at their skill level and a quality bonus for good timing. Missing the timing never ruins the task; it only adds less.
- Output per worker per unit follows Book 10 section 03 and is modified by skill, tools, weather and season.

### Building designation
```ts
interface BuildingDef { id: Id; footprint: { w: number; h: number }; costs: Cost[];
  workerDays: number; maxWorkers: number; rules: PlacementRule[]; adjacency: AdjacencyBonus[];
  capabilities: Capability[]; stages: string[] /* art stages */ }
interface Designation { id: Id; building: Id; origin: Vec2; rotation: 0|90; priority: number;
  delivered: Cost[]; progress: number; status: 'PLANNED'|'BUILDING'|'DONE'|'REMOVING' }
```
- Placement rules: above the tide line, on buildable tiles, not blocking a path tile marked `keepClear`, minimum distance from fire-risk buildings. Invalid placement shows the failing rule in words.
- The steward assigns builders by priority once materials are delivered; residents carry materials from stores; the player can carry and build too.
- Moving or removing a building refunds the share of materials in Book 10.

### Seasons model
- **Crops** have stages (sown, sprouting, growing, ripe, overripe, rotten) by day ranges, with weather modifiers and weeding effects.
- **Food** carries a preservation state (fresh, dried, smoked, salted, grain) with spoilage days; spoilage is computed daily.
- **Fuel** is consumed daily per heated building by season. A heated building without fuel makes its occupants `cold`, which raises sickness risk and lowers healing.
- **Livestock** need grazing in season or hay in winter, and shelter in a byre in winter (cattle); otherwise they lose condition and die.
- **Sickness** risk per resident per day depends on cold, hunger, wounds and crowding; care reduces it.
- Morning report items explain each seasonal pressure in words.

## 08 / Ship
*Derived statistics are a pure function of hull, fittings, refits, wear, load and crew.*

```ts
interface Hull { id: Id; tier: 'T1'|'T2'|'T3A'|'T3B'; lengthTiles: number; beamTiles: number;
  oars: number; berths: number; rowingCrew: number; cargoSlots: number;
  draft: 'SHALLOW'|'MEDIUM'|'DEEP'; seaworthiness: 1|2|3|4|5; integrity: number;
  oarSpeed: number; sailSpeed: number; fittingSlots: SlotKind[]; segmentSet: string }
interface ShipInstance { id: Id; nameKey: string; hull: Id; fittings: Record<SlotKind, Id|null>;
  refits: Id[]; integrity: number; wear: number; marks: IdentityMarks;
  cargo: CargoLot[]; aboard: Id[]; history: ShipLogEntry[]; isFlagship: boolean }
function deriveStats(ship, crew, load): ShipStats   // pure; values from Book 10 section 05
```
Every cargo lot takes one slot; livestock pens two; passengers beyond berths two each. Replacing a hull transfers name, marks, history and up to two fittings. Wear and repair follow Book 10.

## 09 / Sea map
*A graph of charted routes, resolved per watch, with weather, tide, stores and encounters.*

```ts
interface SeaNode { id: Id; kind: 'PLACE'|'WAYPOINT'|'HAZARD'; pos: Vec2; placeId?: Id }
interface SeaEdge { id: Id; a: Id; b: Id; baseWatches: number; exposure: 0|1|2|3;
  tideGate?: { passableAt: 'SLACK'|'FLOOD'|'EBB' }; hazards: Id[]; known: boolean;
  winterClosed: boolean; encounterTable: Id }
```
- Weather: daily wind (eight points, strength 0 to 4), visibility and named storms from the `weather` stream, with a one-day forecast right four times in five. The Cailleach's washing falls once between days 86 and 94.
- Speed per watch, stores per watch and edge times follow Book 10 section 02.
- Encounters per edge per watch, filtered by season, chapter, facts and ledger; a governor keeps two quiet legs per eventful one on average and supernatural events to about one per three or four voyages.
- Interruptions hand off to `SeaBattle` or `OnFoot` and return results. Winter-closed edges open only in calm windows.

## 10 / On-foot regions and exploration
*Home, island and mainland are made of streamed scenes joined by routes on foot. Discovery, resources, puzzles and territory live here.*

```ts
interface RegionDef { id: Id; scenes: SceneRef[]; links: FootLink[]; zones: ZoneDef[] }
interface FootLink { from: Id; to: Id; exit: Rect; entry: Vec2; known: boolean;
  conditions?: Condition[] /* tide, season, key, puzzle */ }
interface ResourceNode { id: Id; kind: Id; pos: Vec2; seasons: Season[]; respawnDays: number;
  yield: Yield; toolRequired?: Id }
interface PuzzleDef { id: Id; states: string[]; transitions: { from: string; to: string;
  when: Condition[]; effects: Effect[] }[]; hints: HintDef[]; solvedFact: string }
```
- **Scenes** are tilemaps from Book 9's layouts (ground, collision, objects, triggers, spawns, navigation layers). Adjacent scenes stream in at link edges without a loading screen.
- **Discovery:** places and links start unknown unless content marks them known. Walking a link, reading a chart, hearing testimony or seeing from a height reveals them on the region map.
- **Resource nodes** respawn by season and days; seasonal nodes exist only in their seasons.
- **Puzzles** are state machines over world conditions (tide, time, season, objects, words spoken). Every puzzle has at least one in-world hint and a solved fact; none uses abstract tile-sliding.
- **Territory:** every on-foot tile belongs to a faction territory or wilderness. A faction's `hostility` decides whether its guards greet, warn, watch or **attack on sight**. Recognition uses faces (leaders, witnesses), sail and shields nearby, and known gear.
- **Reachability test:** every scene must pass an automated flood-fill showing every objective, landing and exit reachable under the stated conditions.

## 11 / Local scenes and raids
*A raid is data: a scene, a true state, intel, complications, extraction and outcome bands.*

```ts
interface ScenarioDef { id: Id; sceneId: Id; placeId: Id; trueState: TrueStateDef;
  intel: IntelItem[]; approaches: ApproachDef[]; complications: ComplicationRule[];
  maxComplications: 1|2; extraction: ExtractionDef; bands: OutcomeBandDef[]; leads: Id[] }
interface IntelItem { id: Id; textKey: string; truth: boolean;
  confidence: 'RUMOUR'|'LIKELY'|'CERTAIN'; revealedBy: RevealCondition[] }
interface RaidPlan { scenarioId: Id; landingId: Id; timeOfDay: Watch; tide: TideState;
  party: Id[]; equipment: Id[]; aim: AimKind[]; advantage: 'SCOUT'|'TRADE_GOODS'|'EXTRA_ARMS' }
interface RaidOutcome { band: Id; haul: CargoLot[]; casualties: Casualty[]; deeds: Deed[];
  people: { rescued: Id[]; hostages: Id[]; joined: Id[] }; witnesses: Id[]; evidence: Id[] }
```
- Complications come from rules reading true state, plan and seed; never more than `maxComplications`.
- Scenarios may declare **escalation timers** (reinforcements, beacons, tide surges) and a **retry rule**. A timer is shown to the player once the household knows of it.
- **Withdrawal** is a command available at any time; leaving with anyone ashore requires confirmation and records them as left behind.
- Carrying occupies both hands, sets speed to carry speed and disables attacks (shove remains).
- **Civilians** in scenes have behaviours (flee, hide, plead, fight with tools, surrender) and can be killed; their deaths are deeds with witnesses and evidence.
- Outcome bands are computed from facts. The post-raid summary reports haul, casualties, deeds and likely consequences in plain sentences.

## 12 / Combat
*Tick-based, real-time melee with readable tells, four-way facing and no pause. All numbers come from Book 10 section 06.*

### States
`idle, move, light1, light2, light3, chargeL0, chargeL1, chargeL2, heavyRelease, recovery, parry, parryRecovery, riposte, block, blockStun, guardBroken, dodge, shove, stagger, carry, downed, surrendered, dead`. Transitions follow input or AI commands and frame data; no state skips its recovery.

### Rules
- **Facing:** four directions. Attacks, parries and shields commit to the current facing; turning is locked during windup and active frames.
- **Light attacks** chain up to the weapon's combo length if the next input lands in the chain window.
- **Charged heavy:** holding attack enters `chargeL0`, reaching L1 and L2 at the Book 10 thresholds with distinct visual and audio tells; release attacks; L2 is a guard-break that cannot be blocked but can be parried or dodged. Movement is slowed while charging; maximum hold auto-releases.
- **Parry:** a timed press with a startup and an active window; success staggers the attacker and opens a riposte; failure leaves a recovery. Shields can parry and block; two-handed weapons parry only.
- **Block** covers the frontal arc, costs stamina on hit and becomes `guardBroken` when stamina empties.
- **Dodge** grants invulnerability frames; **shove** breaks blocks.
- **Vitality and armour** reduce by damage type; wounds result after a fight by severity.
- **Gore:** hits spawn blood particles and decals; bloodied overlays below half vitality; killing blows from heavy cutting weapons roll for dismemberment (`gore` stream). Corpses persist for the scene; at home they persist until buried or burned. A gore setting (off, low, full) changes presentation only, never simulation.
- **The steerer** at zero vitality dies and the game ends, unless *Second wind* is enabled (a short downed window in which an adjacent ally can lift them once per scene). Game over offers reload of the latest autosave or checkpoint.
- **Crew** at zero vitality are downed and bleed out after the Book 10 time unless carried or treated; *Rán's mercy* converts death to a grave wound.
- **Finishing blows:** the player can kill downed and surrendered actors with a held finisher input. This records a deed.

### Crew commands
`FOLLOW, HOLD(point), ATTACK(target), PROTECT(person), CARRY(lot|person), WITHDRAW(extraction)` on quick keys and a command ring that does not stop time. Each is acknowledged with a bark and an icon. Allies never block a `keepClear` tile for more than a second.

## 13 / AI
*Enemies, civilians, allies and wildlife see, hear, remember and communicate through real channels. Ranges are in tiles (Book 10 section 07).*

- **Sight:** a 110 degree cone with range by light (day, dusk, night outside light), halved in fog, increased from height; blocked by solid tiles; dunes, scrub and tall grass hide sneaking actors.
- **Hearing:** noise by action and surface (sneak, walk, run, combat, shout, horn, dog bark) in tiles.
- **Memory:** last known position per target, decaying after the Book 10 time.
- **Alarm** spreads only by sight, shouts, horns, dogs and runners who physically travel.
- **Behaviour selection:** utility scoring over `GUARD, PATROL, INVESTIGATE, RAISE_ALARM, FIGHT, HOLD_LINE, FLANK, PROTECT, FLEE, HIDE, PLEAD, SURRENDER, LOOT, CARRY, WORK, SLEEP`, evaluated at 10 Hz from the `ai` stream.
- **Groups** hold narrow ground, flank when outnumbering by two, support allies and break when cohesion drops below the Book 10 thresholds.
- **No quarter:** when a faction knows at least the Book 10 number of `SURRENDERED_KILLED` deeds by the household, its fighters stop surrendering to the household.
- **Hostility on sight:** guards in a faction's territory attack the household on sight when that faction's hostility is `HOSTILE`, warn and follow when `WARY`.
- **Wildlife:** wolves hunt in packs at night and in winter, boar charge when cornered, seals flee, birds flush and warn of approach.

## 14 / Sea battles
*A small arena where manoeuvre, missiles and boarding decide the fight.*

Open water with wind and optional hazards; two ships, three at most. Helm orders `CLOSE, HOLD_OFF, CROSS_BOW, COME_ALONGSIDE, FLEE` in real time; range bands far, missile, close, alongside; timed volleys with shields-up; grapple contest at alongside; boarding merges decks into one `OnFoot` area. Damage to hull, rig and crew; a holed hull must reach shore or bail.

## 15 / Consequences
*Deeds are recorded, carried by real people or found as evidence, and answered by scheduled responses the player can see coming.*

```ts
interface Deed { id: Id; tag: DeedTag; day: number; placeId: Id; doer: 'HOUSEHOLD'|Id;
  context: Record<string, number|boolean|string>; victims: Id[]; witnesses: Witness[];
  identification: number; marksSeen: (keyof IdentityMarks)[] }
interface Evidence { id: Id; kind: 'BODY'|'ITEM'|'TRACKS'|'BURNED'; placeId: Id; pos: Vec2;
  deedIds: Id[]; points: number /* identification */; discoverDay?: number }
```
- **Witnesses** who escape become carriers. **Evidence** is discovered by the place's people on a schedule (bodies within a day near settlements; longer in wilderness) and contributes identification.
- A deed with no escaping witness and identification below the Book 10 threshold is known only to the household. The crew always knows what it saw.
- Faction updates on knowledge arrival: regard, fear, grievance, resources, **hostility** and territory guards.
- **Answer scheduler** at season start and chapter open, with precursors at least five days before arrival.
- **Anti-dominance:** the autoplay harness reports value per approach family per chapter; gates fail if one dominates every measure.

## 16 / Narrative, chapters and dialogue
*Chapters open windows; beats fire from facts; dialogue reads and writes facts.*

```ts
interface ChapterState { id: Id; status: 'LOCKED'|'OPEN'|'ACTIVE'|'RESOLVED';
  openedDay?: number; resolvedDay?: number; resolvedBy?: string[] }
interface BeatDef { id: Id; chapter: Id; prereqs: Condition[]; trigger: Trigger;
  oneShot: boolean; effects: Effect[]; fallbackDay?: number }
interface DialogueNode { id: Id; speaker: Id; textKey: string; conditions: Condition[];
  choices: { textKey: string; conditions: Condition[]; effects: Effect[]; next?: Id }[] }
```
Dialogue follows Book 8. Barks are short and unblocking. **Ledger-truth dialogue:** the Door of Three Truths offers statements generated from the ledger and from residents' secrets (true) alongside plausible fabrications (false); its response reads the ledger, and spoken truths become memories for everyone present. The Chapter 7 council resolves each ally to `COMMITTED | CONDITIONAL | ABSENT | HOSTILE` with reasons. Endings are a pure function of the final state, with reasons recorded for the epilogue.

## 17 / Supernatural
*Powers have a true state, signs, rules, responses and bargains that cannot be rewritten.*

```ts
interface Bargain { id: Id; power: Id; parties: Id[]; terms: Term[]; benefits: Effect[];
  obligations: Obligation[]; duration: 'ONE_USE'|'SEASON'|'CAMPAIGN'|{ untilDay: number };
  status: 'OFFERED'|'ACCEPTED'|'KEPT'|'BROKEN'|'ENDED'; acceptedDay?: number; hash?: string }
```
Accepted terms are frozen and hashed. Every dangerous mechanic declares `sign, rule, response, consequence`; lint fails if any is missing. Omens never cause a death. Revenants have an `anchor` and a `resolution`; violence only banishes them until a day.

## 18 / Audio
*Music matters. The audio layer is event-driven and never reads hidden truth.*

- **Music state machine** with states and transitions from Book 11; stems mixed by an `intensity` parameter from threat level; changes on bar boundaries with stingers for key events.
- **Ambience** layers by zone, season, weather and time of day. **SFX** by event and surface material.
- **Voiced barks** only, chosen by the bark system; every voiced line has a subtitle.
- **Captions** for every gameplay-relevant sound (a charge tell, a horn, a supernatural sign).
- Formats, loudness and budgets follow Book 11.

## 19 / Art pipeline (authored by Claude)
*Final art is written as palette-indexed pixel sources, compiled and checked, never improvised at runtime.*

- **Source format:** one file per sprite sheet: a palette reference (Book 7), frame size, and frames as rows of palette indices or characters, with pivots, footprints and animation events. A sheet can also be produced by a deterministic generator script committed with its output.
- **Compiler** (`tools/art`) validates sources, packs atlases and writes manifests. Builds fail on unknown palette indices, missing facings or missing states.
- **Visual check:** before a stage marks art done, Claude renders every new sheet at 1x and 4x to an image, inspects it, and records the check in the stage report.
- **Gore layers:** bloodied overlays, dismemberment pieces and decals are separate sheets so the gore setting can change presentation.
- **Placeholders** carry `placeholder: true` and are listed in the stage report; never circles, boxes or emoji.

## 20 / Saves
*Saves are versioned, migratable, and safe to load without repeating one-shot events.*

- JSON world state, compressed; header with schema version, build, seed, day, chapter and state hash.
- Migration chain with golden-save tests; unknown future versions refused.
- **Autosaves:** on waking (before the morning report), before departure, before landing, and labelled **checkpoints** before major danger and the final battle. Three rotating autosaves plus manual slots.
- Manual saves are allowed only under the safe rule. Game over offers the latest autosave or checkpoint.
- One-shots, ledger, evidence and bargain hashes survive every save and load.

## 21 / Input, interface and accessibility
*Accessible without a pause.*

- Actions: move, run, sneak, interact, light attack, heavy (hold), parry, block, dodge, shove, finisher (hold), command ring, quick commands 1 to 6, map, inventory, build menu, report, system menu. All remappable on keyboard and gamepad.
- The command ring opens on hold and leaves time running.
- Options: combat speed 70 to 100%, parry window widening, enemy damage, *Second wind*, *Rán's mercy*, gore level, day length, text size 100 to 200%, subtitles and sound captions, colour-blind presets, reduced shake and flashes, hold-or-toggle inputs.
- Generous interaction radius with highlighted nearest target; every refusal or shortage shows its reason.

## 22 / Performance budgets
| Budget | Target |
|---|---|
| Frame rate | 60 fps at 1080p on integrated graphics (WebGL2) |
| Simulation tick | Under 4 ms with 60 active actors including residents |
| Scene streaming | No visible hitch at link edges; full scene load under 3 s |
| Sea-map watch resolution | Under 2 ms |
| Save | Under 200 ms |
| Memory | Under 700 MB |

## 23 / Testing
*Each stage proves itself. Tests are part of the deliverable.*

- **Unit tests** for pure functions: ship stats, regard deltas, food runway, spoilage, crop stages, fuel, frame data, tide and calendar.
- **Property tests:** ledger append-only, roster cap, no resource below zero, accepted bargains unchanged, one-shots never refire, no gendered steerer strings.
- **Scenario runner:** `scenario run SCN_CARRICK --approach STEAL --seed 42` asserts bands, deeds, evidence and leads.
- **Homestead simulation:** a headless run of 120 days under a delegated policy reports food, fuel, sickness and deaths against Book 10 targets.
- **Reachability:** flood-fill every scene from Book 9 under tide and season conditions.
- **Autoplay harness:** bot policies (greedy, merciful, trader, glory, brutal, mixed) play from any chapter and report Book 10 progression metrics.
- **Content and art lint**, **golden saves**, **determinism replay**.

### Stage report format
```
STAGE <n> REPORT
Implemented:        <list with file paths>
Tests:              <commands run, pass/fail counts>
Gate checks:        <each acceptance check: PASS / FAIL with evidence>
Art check:          <sheets rendered and inspected; placeholders remaining>
Balance:            <Book 10 values used or changed, with reasons>
Deviations:         <decision-log entries added>
Known issues:       <with severity>
Next stage ready:   YES / NO (why)
```

## 24 / Prohibited shortcuts and the decision log
- Do not delete or bypass a locked feature to make a test pass.
- Do not use permanent primitive shapes or emoji in place of sprites.
- Do not read hidden truth into UI, audio or dialogue unless discovered.
- Do not introduce `Math.random()`, wall-clock time or frame-rate-dependent logic in the simulation.
- Do not rewrite accepted bargains or delete ledger or evidence entries.
- Do not hard-code tuning numbers; read them from `balance.json`.
- Do not add children as actors, sexual violence of any kind, or a player torture action.
- Do not refer to the steerer with gendered pronouns or terms.
- Do not add a tactical pause.

**Decision log:** `docs/decision-log.md`, one entry per departure: date, stage, decision, reason, alternatives, books affected, approved by.
