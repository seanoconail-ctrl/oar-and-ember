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

### Where the larger systems live
| System | Folder |
|---|---|
| Happiness, friendship and fear; disputes; requests; stamina and condition (sections 06, 24) | `sim/people/` |
| The away simulation and visiting traders at the homestead (sections 07, 25) | `sim/home/` |
| The mainland's areas, travel, quick travel, water depth, camping, companions, travellers and bandit camps on and off screen (sections 10, 25) | `sim/land/` |
| News carried by people (sections 15, 25) | `sim/ledger/` |
| Quests and the event deck (sections 06, 16, 25) | `sim/narrative/` |
| Assaults, muster and formations (sections 11 to 13) | `sim/raid/`, `sim/combat/`, `sim/ai/` |

### Modes
```
Boot -> Title -> Campaign -> GameOver | Ending
Campaign modes:
  OnFoot     (home, island zones, mainland areas, dungeons, raid sites, harbours) real time
  SeaMap     route plotting and watch-by-watch travel
  SeaBattle  ship-to-ship arena, boarding uses OnFoot combat rules
  Planning   raid plan, departure, council seating (opened only when safe)
  Dialogue   conversations (barks are not a mode)
  Report     morning report, homecoming report, post-raid summary (opened only when safe)
```
Every transition passes a typed **handoff** and returns a typed **result**. A mode never reaches into another mode's state.

### The "safe" rule
A menu or planning screen may open only when no hostile actor is aware of the player (`threat.awareHostiles == 0`). While open, simulation time stops. The system menu follows the same rule; when hostiles are aware it opens as an overlay without stopping time. There is no tactical pause.

## 03 / Time, determinism and the calendar
*A fixed tick, a real-time day on foot, watches at sea, and seeded randomness.*

- Simulation tick **60 Hz** fixed step with render interpolation.
- **Calendar:** `day` from 1; `year = ceil(day / 120)`; seasons of 30 days; four watches per day (Morning 06-12, Day 12-18, Evening 18-24, Night 00-06).
- **On-foot clock:** one game hour lasts `balance.time.secondsPerHour` real seconds (Book 10). The active day runs 06:00 to 02:00. Sleeping in a bed after 18:00, or at a camp (section 10), advances to 06:00 and triggers the morning report. Staying awake past 02:00 causes a collapse with the penalty in Book 10. A day-length option scales the clock.
- **Actions that cost game time:** a homestead task done by the steerer (section 07), quick travel (section 10) and camping advance the clock by their Book 10 time. The world is never skipped: the interval is run through the low-detail steps (the home step of section 07, the world step of section 25), so crops grow, stores are eaten and travellers move exactly as if the time had passed in play. A time advance happens only under the safe rule and stops at once if a hostile becomes aware.
- **At sea:** travel resolves per watch (six game hours) with a short animation.
- **Tide:** flood and ebb alternate each watch, low water at the end of each ebb watch, phase shifting one watch every three days; spring tides on days 1 and 16 of each season. Tidal ground is passable within the window in Book 10.
- **RNG streams:** `weather, encounters, loot, combat, ai, people, generation, gore, world` seeded from the campaign seed. `world` drives the living world (travellers, visiting traders, bandit camps, the event deck, off-screen places) and the away simulation, so what happens out of sight never disturbs the draws of a raid or a voyage. No `Math.random()` or wall-clock time in `sim/`.
- **Determinism test:** replaying a recorded input stream from a save reproduces identical state hashes.

## 04 / Content data and IDs
*Content is data; numbers are data. IDs are stable forever.*

| Prefix | Type |
|---|---|
| `ISLE_ TOWN_ FORT_ ABBEY_ GLEN_ CAMP_ SITE_` | Places on the sea map |
| `REG_ ZONE_` | On-foot regions and their zones |
| `MAIN_` | Areas of the mainland, the one shared region of twenty areas (Book 4, Book 9) |
| `SK_` | Places on Skarvholm |
| `HAZ_` | Sea hazards |
| `C_ L_ R_ E_ H_ P_` | Residents, leaders, rival captains, enemies, hostages, player |
| `FAC_` | Factions |
| `HULL_ FIT_ REFIT_` | Hulls, fittings, refits |
| `BLD_ TASK_ RES_ ITEM_ CROP_` | Buildings, tasks, resources, items, crops |
| `SCN_ CMP_ BEAT_ CH_ PUZ_` | Scenarios, complications, beats, chapters, puzzles |
| `BARGAIN_ POWER_ OMEN_` | Supernatural bargains, powers, omens |
| `MUS_ SFX_ AMB_ VO_` | Music cues, sound effects, ambiences, voice blips |

One schema per content type, validated at load; every cross-reference must resolve. `content/balance.json` is generated from Book 10's tables and is the only place numbers live. All player-facing text uses string keys.

## 05 / World state
*One serialisable world state. Everything that matters to a consequence lives here.*

```ts
interface WorldState {
  version: number; seed: string; rng: Record<RngStream, RngState>;
  calendar: { day: number; minuteOfDay: number; weather: WeatherState; tide: TideState };
  player: PlayerState;                    // section 24: vitality, stamina, skills, equipment, bodyModel, name
  party: { companions: Id[] };            // residents on foot with the steerer (section 10)
  household: { residents: Id[]; hostages: Id[]; guests: Id[]; shelterPlan?: ShelterPlan };
  people: Record<Id, Person>;             // everyone with a name, alive or dead
  disputes: Dispute[]; requests: Record<Id, RequestState>; quests: Record<Id, QuestState>;
  ships: Record<Id, ShipInstance>;
  homes: Record<Id, HomeState>;           // buildings, plots, designations, stores, fields
  away: AwayState | null;                 // the home while the steerer is away (section 07)
  regions: Record<Id, RegionState>;       // discovery, areas, blocks, resource nodes, puzzles, bodies
  camp: CampState | null;                 // the steerer's camp tonight (section 10)
  places: Record<Id, PlaceState>;         // settlements' true stores, defences, people, leader
  world: LivingWorldState;                // section 25: travellers, bandit camps, news, traders, event deck
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
*Residents and leaders are people with values, ties and memories. Three measures (happiness, friendship and fear) are computed from how they live and from witnessed deeds, and shown in readable steps.*

```ts
type Value = 'GAIN' | 'MERCY' | 'GLORY' | 'KIN' | 'FAITH' | 'WORD';
interface Person {
  id: Id; nameKey: string; origin: Origin; appearance: AppearanceRef; equipment: Equipment; // section 19
  status: 'alive'|'downed'|'wounded'|'sick'|'dead'|'missing'|'captive';
  vitality: number; skills: Partial<Record<Skill, 0|1|2|3|4|5>>; skillXp: Partial<Record<Skill, number>>;
  values: Partial<Record<Value, 1|2|3>>; faithTarget?: 'OLD_GODS'|'CHRIST'|'LAND_SPIRITS'|'NONE';
  happiness: number;                      // 0..100: mood now
  friendship: number;                     // -100..100: how they feel about the steerer over time
  fear: number;                           // 0..100: how much they fear the steerer
  moodToday: MoodFactor[];                // the reasons for today's happiness, each with its share
  ties: Tie[];                            // kin, friend, rival, spouse, debt, grievance, oath, mentor
  memories: Memory[]; wounds: Wound[]; job?: JobAssignment; schedule: ScheduleRef;
  requests: Id[]; hiddenStance?: Id; valueShifts: number;
}
interface MoodFactor { cause: 'FOOD'|'WARMTH'|'REST'|'SAFETY'|'SUCCESS'|'GRIEF'|'FESTIVAL'|'TREATMENT';
  amount: number; detail?: string /* string key: "slept cold", "praised at the feast" */ }
```
Leaders are people too: friendship and fear apply to every named leader of a settlement or camp, alongside their faction's state (section 15).

### Three measures
- **Happiness** is mood now. It is recomputed each morning from food, warmth, rest, safety, recent success, grief, festivals and how the person was treated, and moves during the day as those change. `moodToday` holds the reasons so the interface can say why.
- **Friendship** is how the person feels about the steerer over time. It moves with kept and broken promises, care, gifts, time spent together, and shared deeds that fit the person's values.
- **Fear** is how much the person fears the steerer. It moves with brutality, punishments, displays of strength and threats.
- **Deeds feed friendship and fear.** Each deed a person witnesses or hears of (section 15) applies the friendship deltas by deed, weighted by the person's values and the witness factor, and the fear deltas by deed (Book 10 section 08). The steerer's acts at home (a gift, a punishment, a judgement, a promise) are deeds of the same kind.
- **Effects** follow the Book 10 section 08 table "Happiness, friendship and fear": work output scales with happiness, and low happiness makes disputes likelier; high friendship volunteers for danger, defends the steerer and stays in hard times; low friendship without fear leaves; high fear without friendship obeys any order at lower quality and may desert or betray while the steerer is away or wounded; high fear with high friendship is fierce devotion.
- **The warning flow** stays: crossing a friendship band downwards (Book 10 section 08, "Friendship bands"), or falling into one of the effects above that ends in leaving, triggers in order, with at least two days between steps: a remark, a complaint scene, refusal of the order class that caused it, a request to leave.
- **Ties** include existing relationships (spouses, siblings) from content; there is no romance system and no tie of type lover can be created in play.
- **Schedules:** each resident follows a daily schedule (wake, eat, work shift, meal, evening, sleep) adjusted by job, season, weather, wounds and events, so they are always visibly doing something.
- **Conversation topics** are generated from memories (recent deeds, deaths, wounds, the weather, their job, their ties) with a priority and a cooldown; residents may approach the player with high-priority topics.
- **Player references:** dialogue never uses gendered pronouns or gendered terms for the steerer. Content lint rejects strings tagged as addressing or describing the steerer that contain them.
- **Harming residents:** the player can strike residents. The first blow triggers a warning reaction; repeated harm or a killing is a deed with household-wide consequences, up to residents fleeing, fighting back or leaving.

### Disputes
```ts
type DisputeKind = 'THEFT'|'INSULT'|'FIGHT'|'SHIRKING'|'PLUNDER_SHARE'|'BELIEF'|'GRUDGE'|'DEBT'|'BROKEN_PROMISE';
type Judgement = 'TAKE_SIDE'|'COMPROMISE'|'PUNISH'|'COMPENSATE'|'HOUSEHOLD_THING'|'IGNORE';
interface Dispute { id: Id; kind: DisputeKind; day: number; parties: Id[]; cause: Id | string /* deed, memory or fact */;
  watchers: Id[]; status: 'OPEN'|'JUDGED'|'IGNORED'|'BOILED_OVER';
  judgement?: { kind: Judgement; favoured?: Id; punished?: Id[]; paid?: Cost[]; day: number } }
```
- Disputes arise on the `people` stream at the Book 10 section 08 rate once the household reaches the size that table gives, more often when happiness is low. Each grows from something real: a tie, a memory, a share of plunder, a debt, a shrine, a broken promise. No dispute is about a stranger.
- The steerer judges in a dialogue: take a side, find a compromise, punish, pay compensation, call a household thing to decide, or ignore it. Each judgement moves happiness, friendship and fear for the parties and for everyone watching, by their values (Book 10 section 08, "Disputes"). A punishment is a fine, hard work, a lost share or exile from the household; there is no torture (section 26).
- An open or ignored dispute can **boil over** after the Book 10 time, into a fight, a theft or a resident leaving, most often while the steerer is away (section 07).

### Requests and quests
```ts
interface RequestDef { id: Id; giver: Id; size: 'SMALL'|'PERSONAL'|'DANGEROUS'; textKey: string;
  offeredWhen: Condition[]; goal: Condition[]; rewards: Effect[]; onRefuse: Effect[];
  quest?: Id; expiresAfterDays?: number }
interface QuestDef { id: Id; request: Id; steps: { goal: Condition[]; hints: HintDef[]; places: Id[] }[];
  reveals: Id[] /* beats that change what the right choice looks like */; outs: QuestOut[] }
interface QuestOut { kind: 'KILLING'|'BLOOD_PRICE'|'DUEL'|'EXILE'|'TRUTH'|'OTHER'; when: Condition[]; effects: Effect[] }
interface RequestState { status: 'OFFERED'|'ACCEPTED'|'DONE'|'FAILED'|'REFUSED'|'LAPSED'; offeredDay: number; acceptedDay?: number }
interface QuestState { status: 'ACTIVE'|'DONE'|'FAILED'|'ABANDONED'; step: number; resolvedBy?: QuestOut['kind'] }
```
- Residents and leaders make **requests**, small (build me a loom, find my mother's brooch), personal (lay my brother's ghost, take me to my sister) or dangerous (avenge my father), raised as high-priority conversation topics. Accepting is a promise: keeping or breaking it is a `PROMISE_KEPT` or `PROMISE_BROKEN` deed.
- Some requests become **quests** across the map, including revenge killings in other towns. A quest grants no exemption: a killing in a town is a deed with witnesses, guards, a feud and a blood-price, like any other (section 15).
- **Lint:** every quest that can end in a killing declares at least one other out (a blood-price paid, a duel, exile or the truth); every major quest declares at least one reveal (Book 1 section 20). Personal quest seeds are content in Book 5.

## 07 / The homestead: tasks, building and seasons
*The home runs in real time, and on without the steerer. Residents work by schedule; the player can do any task they do or designate new buildings.*

### Tasks
```ts
interface TaskDef { id: Id; skill: Skill; station: StationKind | ZoneKind; season?: Season[];
  minutesPerUnit: number; output: Yield[]; inputs: Cost[]; tools: Id[]; playerAction: ActionKind;
  playerGameMinutes: number; playerStamina: number;   // Book 10 section 09, "Homestead tasks: time and stamina"
  workLoop: string /* the work animation, Book 7 section 07 */; particles?: string }
interface TaskInstance { def: Id; site: Id; workers: Id[]; progress: number; quality: number }
```
- Tasks include sow, weed, harvest, fish (shore and boat), gather (shellfish, seaweed, eggs, driftwood), cut peat, cut hay, build, carpentry, smith, cook, care, herd, shear, slaughter and preserve, repair ship, train, watch; and, from the steerer's list in Book 1 section 10, felling and splitting timber, watering the kale garden in dry spells, threshing, net-mending and milking. Build covers hammering, raising beams and thatching; care is tending wounds.
- **Every task by hand:** the steerer can do every task residents do, with the same work loop. The player interacts with a task site, or uses the selected hotbar tool on its tile (section 21), and performs its `playerAction` (timed press, hold-and-release, or rhythm), adding work at their skill level and a quality bonus for good timing. Missing the timing never ruins the task; it only adds less.
- **Time, not toil:** each completed player action advances the clock by the task's `playerGameMinutes` while the work loop plays (section 03: run through the home step, safe rule only; when hostiles are aware the work still counts but no time is advanced) and costs the task's small `playerStamina`. Task stamina never empties the bar on its own; the hours worked count towards the hard day's work that lowers the maximum (section 24).
- Output per worker per unit follows Book 10 section 03 and is modified by skill, tools, weather, season and the worker's happiness (section 06).

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

### The home while the steerer is away
```ts
interface AwayState { home: Id; since: { day: number; minuteOfDay: number }; queue: AwayEvent[] }
interface AwayEvent { day: number; kind: 'WORK'|'THREAT'|'DISPUTE'|'SICKNESS'|'DEATH'|'TRADER'|'NEWS'|'REPAIR'|'OTHER';
  people: Id[]; textKey: string; deeds: Id[]; facts: string[] }
```
- The away simulation (`sim/home/`) runs whenever the steerer is not in the home's scenes: at sea, on a raid, on the mainland, in a dungeon. It applies the same daily rules as at home (crops, spoilage, fuel, livestock, sickness, schedules) at low detail, one step per game hour on foot and per watch at sea, on the `world` stream. The same step runs through a task's game time at home (section 03), at full efficiency.
- Work continues at the away efficiency of Book 10 section 19 (75%, or 90% with a steward of skill 3 or more). The steward's plan, rations and reserve keep running; the home never starves while food is in its stores, but it does less, slips behind on repairs, and disputes can boil over (section 06).
- Threats on the Book 10 section 11 schedule are met by the watch: the encounter is resolved from the watch's strength, the defences and the warning time against the threat (Book 10 section 19), giving casualties, losses, deeds and evidence like a fight in play.
- Everything that happens is queued with its reasons and told on return in the **homecoming report** (Report mode, safe rule). Its deeds and facts are real and already applied.
- Going and coming back are seamless: on return, residents are placed where their schedules put them, and nothing the step decided is undone.

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
*Home, island and mainland are made of streamed scenes joined by routes on foot. Discovery, resources, puzzles, territory, water, hazards and camping live here.*

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

### The mainland: one shared region of twenty areas
```ts
interface AreaDef { id: Id /* MAIN_ */; region: Id; kind: AreaKind; scenes: SceneRef[]; coastal: boolean;
  knownAtStart: 'NO'|'YES'|'BY_SEA'; homeSite?: Id; leader?: Id; territory: Id | 'WILDERNESS';
  waymarks: Id[]; seasonal: { season: Season; changes: Effect[] }[]; dungeon?: Id }
interface AreaLink { id: Id; a: Id; b: Id; road: boolean; walkTime: number /* Book 10 section 14 */;
  conditions?: Condition[] /* season, spate, snow, cold snap, hostility, block cleared */ }
interface Block { id: Id; link: Id; kind: 'LANDSLIDE'|'SPATE'|'LEAVE'|'SEASON';
  clearedBy: Condition[][] /* any one way */; clearedFact: string; reasonKey: string }
interface AreaState { known: boolean; visited: boolean; waymarksFound: Id[]; secretsFound: Id[] }
interface RegionState { discoveredZones: Id[]; areas: Record<Id, AreaState>; blocksCleared: Id[];
  resourceNodes: Record<Id, ResourceNodeState>; puzzles: Record<Id, string>; bodies: Id[] }
```
- **One map for everyone.** The mainland is one region of twenty areas with `MAIN_` IDs (Book 4; plans in Book 9), the same in every campaign. It holds both home sites. Glen Arra, Inis Rón and Crowwick stay separate places across the sea, each with its own small region.
- **How it opens.** From Chapter 3 the coastal areas have landings on the sea map; inland areas open on foot as they are discovered and as blocks are cleared. A block is a fact with one or more ways to clear it: a work party at the site (a designation with worker-days, built like a homestead building), an alliance, an item, the right words, a season window or a cold snap. A blocked link shows its reason in words. Hostile ground stays open but dangerous (territory, above).
- **Seasons** change each area through its `seasonal` effects and the links' conditions, driven by the calendar and the weather.
- **Quick travel** runs along known roads between found waymarks, only under the safe rule and never into hostile territory. It costs game time equal to the walk at the Book 10 section 14 rate, run through the world step (section 25); a traveller, ambush or hazard on the way stops it and hands off to `OnFoot` at that spot.

### Water depth bands
- Every water tile has a bed height; its **depth band** (`WET, ANKLE, KNEE, WAIST, DEEP`) is the water level (tide, spate, flood, freeze) over the bed, computed from the calendar and weather (Book 10 section 02, "Water depth bands"). It is never stored per frame, and what is drawn always agrees with it.
- **Who reads it:** movement (each band's speed), stamina (waist-deep wading and swimming drain, section 24), combat (waist deep, carrying and fighting are harder by the Book 10 band modifiers), AI and pathing (band costs; deep water is collision unless the scene allows swimming and the actor can swim), hearing (wading and splashing are louder), evidence (tracks do not hold in water), render (the band's mask, the waterline, ripples, splashes and wet sprites, Book 7 sections 07 and 14) and audio (water footsteps).
- **Deep water** allows swimming only where the scene marks it; the kelpie bridle's water-horse crosses where its rules allow.
- **Masking** is presentation: the actor view carries the band and the waterline, and the renderer hides the sprite below it by the band's mask height (Book 10 section 02).

### Movement verbs and hazards
- On foot the steerer can walk, run, sneak, carry, climb marked routes, wade, swim where allowed, jump short gaps, crawl through gaps, push and pull heavy objects, and ride the water-horse where the kelpie bridle allows. Each verb is a movement state with its Book 10 section 02 speed and its own collision rules; climbing, swimming, waist-deep wading, running and heavy carrying drain stamina (section 24).
- **Hazards** are state machines over world conditions and declare `sign, rule, response, consequence` like any dangerous mechanic (section 17): bog holes (slow, then sink unless pulled out), spate rivers (swept downstream), cliffs and scree (falls), cold at night (the cold reason of section 24), fog (sight and getting turned round), wolves, boar, outlaw ambushes and roadblocks, landslides after rain, lightning on high ground and the hill-folk's rules. Numbers are in Book 10 section 15. Every hazard shows its sign before it can hurt.

### Camping and companions
```ts
interface CampState { area: Id; pos: Vec2; day: number; fire: boolean; sheltered: boolean; watch?: Id }
```
- **Camping:** the `CAMP` command needs a bedroll and a fire's makings, an area that is not hostile, and the safe rule. A camp ends the day (to 06:00, section 03), heals by the Book 10 section 15 amount, and **saves if safe** (section 20). Its risk (wolves, outlaws, cold) comes from the area and season on the `encounters` stream and falls with a good fire, a companion on watch and a sheltered spot. An attack wakes the steerer into `OnFoot` at the camp, with no save.
- **Companions on foot:** up to two residents (Book 10 section 15) travel with the steerer on the mainland, in `party.companions`. They follow, comment from their topics, help (pulling the steerer out of a bog hole, carrying, tasks) and fight under the crew commands of section 12. While away they are out of the home's work and in their own condition (hunger, cold, wounds).

## 11 / Local scenes and raids
*A raid is data: a scene, a true state, intel, complications, extraction and outcome bands. Every raid is a stealth raid or an all-out assault.*

```ts
interface ScenarioDef { id: Id; sceneId: Id; placeId: Id; trueState: TrueStateDef;
  modes: ('STEALTH'|'ASSAULT')[]; assault?: AssaultDef;
  intel: IntelItem[]; approaches: ApproachDef[]; complications: ComplicationRule[];
  maxComplications: 1|2; extraction: ExtractionDef; bands: OutcomeBandDef[]; leads: Id[] }
interface AssaultDef { landing: Id; muster: MusterWave[]; objectives: AssaultObjective[] }
interface MusterWave { group: Id; size: number /* Book 10 section 18 */; archers: boolean;
  from: Id /* where they really are: a house, a neighbour, a hall */; trigger: 'START'|'HORN'|'RUNNER'|'BEACON'|Condition }
type AssaultObjective = 'BREAK_GATE'|'FIRE_THATCH'|'SEIZE_STORE'|'TAKE_LEADER'|'KILL_LEADER'|'HOLD_LANDING';
interface IntelItem { id: Id; textKey: string; truth: boolean;
  confidence: 'RUMOUR'|'LIKELY'|'CERTAIN'; revealedBy: RevealCondition[] }
interface RaidPlan { scenarioId: Id; mode: 'STEALTH'|'ASSAULT'; landingId: Id; timeOfDay: Watch; tide: TideState;
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

### Assaults
- A scenario lists the modes it allows; fortified places, Crowwick and Orm's outposts allow only `ASSAULT`. Carrick allows both: a stealth raid by night or an assault by day.
- In an assault the full crew lands by day. Defenders **muster over time**: each wave starts where its people really are and comes when its trigger fires (a horn heard, a runner arriving, a beacon seen), so alarm still spreads only by the channels of section 13. Archers take positions; battles run 10 to 30 a side (Book 10 section 18).
- **Objectives** (break the gate, fire the thatch, seize the store, take or kill the leader, hold the landing) are facts that the outcome bands read.
- **Consequences** are heavier and more public: assault deeds carry `context.assault`, every defender who sees the fight is a witness, and the answer scheduler uses the assault timings of Book 10 section 18 (precursors still come first, section 15). The Glory-minded value it by the ordinary deed deltas.

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

- **In water:** waist deep, attacks, dodges and carrying are harder by the Book 10 section 02 band modifiers.
- **Aim:** melee attacks commit to the four-way facing nearest the aim vector (section 21); bows and thrown spears fire along the aim vector itself, which is part of the command, so replays stay deterministic.

### Crew commands and formations
`FOLLOW, HOLD(point), ATTACK(target), PROTECT(person), CARRY(lot|person), WITHDRAW(extraction), SHIELD_WALL(line), CHARGE(target), VOLLEY(area), FALL_BACK(ships)` on quick keys and a command ring that does not stop time. Each is acknowledged with a bark and an icon. Allies never block a `keepClear` tile for more than a second.
- **Shield wall:** members lock into the slots of a line; the line has a wide front arc, moves slowly and is strong against missiles (Book 10 section 18). A fallen member's slot is filled from behind; a line with a gap it cannot fill, or whose cohesion breaks (section 13), falls apart.
- **Charge:** the group runs at its target and, on contact, delivers a cohesion shock to the group it hits.
- **Volley:** the group's archers loose together at an area on one command; shields up reduces it.
- **Fall back:** the group withdraws towards the ships in order, the wall facing the enemy, and boards as in an extraction.
- Enemy groups use the same formations and commands, chosen by their AI.

## 13 / AI
*Enemies, civilians, allies and wildlife see, hear, remember and communicate through real channels. Ranges are in tiles (Book 10 section 07).*

- **Sight:** a 110 degree cone with range by light (day, dusk, night outside light), halved in fog, increased from height; blocked by solid tiles; dunes, scrub and tall grass hide sneaking actors.
- **Hearing:** noise by action and surface (sneak, walk, run, combat, shout, horn, dog bark) in tiles.
- **Memory:** last known position per target, decaying after the Book 10 time.
- **Alarm** spreads only by sight, shouts, horns, dogs and runners who physically travel.
- **Behaviour selection:** utility scoring over `GUARD, PATROL, INVESTIGATE, RAISE_ALARM, FIGHT, HOLD_LINE, FLANK, PROTECT, FLEE, HIDE, PLEAD, SURRENDER, LOOT, CARRY, WORK, SLEEP`, evaluated at 10 Hz from the `ai` stream.
- **Groups** hold narrow ground, flank when outnumbering by two, support allies, form shield walls, charge and volley (section 12), and break when cohesion drops below the Book 10 thresholds. In a formation the group leader decides at 10 Hz and members steer to their slots, choosing their own behaviour only when in contact, so a battle of 30 a side stays within budget (section 22).
- **Muster:** defenders who hear a horn or meet a runner arm and gather at their muster point before moving, as the assault's waves say (section 11).
- **Travellers** use the same behaviours with their own needs (keep to the road, trade, rest, flee, hide, plead, fight back); bandits ambush from cover on roads (section 25).
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
- **News travels with people:** knowledge of a deed, and any notable happening, moves only with carriers (witnesses, travellers, traders, runners) at the speed they really travel, as news items (section 25). A place learns when a carrier arrives.
- A deed with no escaping witness and identification below the Book 10 threshold is known only to the household. The crew always knows what it saw.
- Faction updates on knowledge arrival: regard, fear, grievance, resources, **hostility** and territory guards. Every person who witnesses or hears of a deed, residents and leaders alike, updates friendship and fear (section 06).
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
Event deck cards (section 25) and quest steps (section 06) are beats. Dialogue follows Book 8. Barks are short and unblocking. **Ledger-truth dialogue:** the Door of Three Truths offers statements generated from the ledger and from residents' secrets (true) alongside plausible fabrications (false); its response reads the ledger, and spoken truths become memories for everyone present. The Chapter 7 council resolves each ally to `COMMITTED | CONDITIONAL | ABSENT | HOSTILE` with reasons. Endings are a pure function of the final state, with reasons recorded for the epilogue.

## 17 / Supernatural
*Powers have a true state, signs, rules, responses and bargains that cannot be rewritten.*

```ts
interface Bargain { id: Id; power: Id; parties: Id[]; terms: Term[]; benefits: Effect[];
  obligations: Obligation[]; duration: 'ONE_USE'|'SEASON'|'CAMPAIGN'|{ untilDay: number };
  status: 'OFFERED'|'ACCEPTED'|'KEPT'|'BROKEN'|'ENDED'; acceptedDay?: number; hash?: string }
```
Accepted terms are frozen and hashed. Every dangerous mechanic declares `sign, rule, response, consequence`; lint fails if any is missing. Omens never cause a death. Revenants have an `anchor` and a `resolution`; violence only banishes them until a day.

## 18 / Audio
*Music matters. The game generates all of its own audio; the audio layer is event-driven, presentation only, and never reads hidden truth.*

- **Generated, not recorded** (Book 11 section 12): music is note data in `content/music/` played by the in-game sequencer and synthesiser (`src/audio/synth/`); effects, tells, ambience and voice blips are generated in code. No recordings, licensed or sampled audio.
- **Music state machine** with states and transitions from Book 11; layers mixed by an `intensity` parameter from threat level; every change lands on a bar line; loops are seamless; stingers for key events. SNES-like limits: 8 music voices, small instruments, one shared echo.
- **Ambience** layers by zone, season, weather and time of day, driven by the game's state (the wind from the game's own wind field, the tide). **SFX** by event and surface material.
- **Voice blips**, not voiced barks: each speaker's lines appear as text with a short blip voice of their own; the steerer has none. Every line has a subtitle.
- **Captions** for every gameplay-relevant sound (a charge tell, a horn, a supernatural sign).
- **Presentation only:** audio reacts to simulation events and never affects gameplay, saves or determinism. Its random streams are its own (seeded), never the simulation's.
- Sliders for master, music, ambience, effects, voice blips and supernatural tells, and a mono option. Loudness and budgets follow Book 11.

## 19 / Art pipeline (authored by Claude)
*Final art is written as palette-indexed pixel sources, compiled and checked, never improvised at runtime.*

- **Source format:** one file per sprite sheet: a palette reference (Book 7), frame size (people 32 x 48, Book 7 section 01), and frames as rows of palette indices or characters, with pivots, footprints, a ground shadow and animation events. A sheet can also be produced by a deterministic generator script committed with its output.
- **Compiler** (`tools/art`) validates sources, packs atlases and writes manifests. Builds fail on unknown palette indices, missing facings or missing states.

### Equipment layers (paper doll)
```ts
type LayerSlot = 'BODY'|'CLOTHING'|'CLOAK'|'HELMET'|'ARMOUR'|'SHIELD'|'WEAPON';
type Equipment = Partial<Record<LayerSlot, Id /* ITEM_ */>>;
interface LayerSheet { sheet: string; slot: LayerSlot; body: string /* the body sheet it fits */;
  order: Record<Facing, number> /* draw order against the body per facing */; lag?: 1 }
```
- A person is drawn as a body sheet with one layered sheet per worn piece; worn equipment is always visible. A layer sheet has exactly the body's states, facings, frame counts, pivots and events; the compiler fails a layer that differs from its body. A weapon or shield layer may use a larger canvas round the same foot anchor, for spears, Dane axes and bows (Book 7 section 07).
- Each layer has a draw order per facing (a shield in front facing south, behind facing north; a weapon on the side it is carried). Layers are composited at draw time, or baked into an outfit atlas when equipment changes, never per frame in the simulation.
- **Secondary motion** (hair, cloaks, sashes, bags lagging a frame behind the body, Book 7 section 07) is authored in the frames, or for a whole layer by `lag: 1`, which draws it with the body's previous frame.
- Every layer the steerer can wear exists for both body models. Equipment is simulation state (it changes armour, recognition and noise); its drawing is presentation.
- **Visual check:** before a stage marks art done, Claude renders every new sheet at 1x and 4x to an image, inspects it, and records the check in the stage report.
- **Gore layers:** bloodied overlays, dismemberment pieces and decals are separate sheets so the gore setting can change presentation.
- **Placeholders** carry `placeholder: true` and are listed in the stage report; never circles, boxes or emoji.

## 20 / Saves
*Saves are versioned, migratable, and safe to load without repeating one-shot events.*

- JSON world state, compressed; header with schema version, build, seed, day, chapter and state hash.
- Migration chain with golden-save tests; unknown future versions refused.
- **Autosaves:** on waking (before the morning report), on waking at a camp when it is safe (not attacked in the night, no hostile aware, the area not hostile), before departure, before landing, and labelled **checkpoints** before major danger and the final battle. Three rotating autosaves plus manual slots.
- Manual saves are allowed only under the safe rule. Game over offers the latest autosave or checkpoint.
- One-shots, ledger, evidence and bargain hashes survive every save and load.

## 21 / Input, interface and accessibility
*Mouse, keyboard or gamepad, accessible without a pause. Devices make commands; the simulation never sees a raw pointer.*

- Actions: move, run, sneak, use selected item (attack with a weapon; hold to charge a heavy), interact, aim, hotbar slots 1 to 12, next and previous slot, parry, block, dodge, shove, finisher (hold), jump, camp, command ring, quick commands 1 to 6 (on their own keys: the number keys select hotbar slots), map (and quick travel from it), inventory, build menu, report, system menu. All remappable on keyboard, mouse and gamepad.
- The command ring opens on hold and leaves time running.

### Hotbar and target tile
```ts
interface Hotbar { slots: (Id | null)[] /* tools, seeds, items, weapons; Book 10 section 21, hotbarSlots */; selected: number }
type PlayerCommand =
  | { kind: 'USE_AT'; slot: number; tile: TilePos }       // chop, dig, sow, water, harvest, hammer, fish, attack
  | { kind: 'INTERACT_AT'; tile: TilePos }                // talk, pick up, open, harvest ripe crops, eat
  | { kind: 'AIM'; vector: AimVector }                    // quantised; bows and thrown spears while drawing
  | { kind: 'SELECT_SLOT'; slot: number };               // and move, run, parry, block, dodge and the rest
```
- The **hotbar** lives in `PlayerState` (section 24) and is chosen with the number keys, the mouse wheel or the gamepad's shoulder buttons.
- **The target tile** is chosen per device. **Mouse:** the tile under the cursor, if it is within reach of the steerer for the selected use (`toolReach`, `interactReach` or `castReach`, Book 10 section 21 "Controls and camera"). **Gamepad:** the right stick moves a target-tile cursor around the steerer within the same reach; with the stick released (inside the stick dead zone) it is the tile in front of the steerer's facing. **Keyboard only:** the tile in front of the facing, so every task and interaction can be done without a pointer.
- **Left-click** (or the use button) uses the selected item at the target tile; **right-click** (or the interact button) interacts there. A target out of reach does nothing but show it: a dimmed, red-edged cursor tile and a short refusal word (Book 7 section 10), never a sound alone.
- **Aim:** melee attacks go towards the cursor (or the right stick), snapping to the nearest of the four facings (section 12); bows and thrown spears aim freely along the aim vector, with an aim line while drawing. Parry, block and dodge keep their own keys.
- **Determinism:** the input layer turns device state into `PlayerCommand`s (use at a tile, interact at a tile, an aim vector quantised to a fixed set of directions) stamped with their tick. The simulation receives only commands, never screen or pointer coordinates, and replays record commands, so a mouse game replays exactly. Nothing in `sim/` reads a pointer, the screen or the camera.

### Camera
- The camera follows the steerer with a **look-ahead towards the cursor**: `lookAheadScale` x the cursor's distance from the steerer, ignored inside `lookAheadDeadZone`, capped at `lookAheadMax`, or `lookAheadAiming` while drawing a bow or aiming a spear (Book 10 section 21 "Controls and camera"). With a gamepad it leads towards the right stick, and in keyboard-only play towards the direction of travel.
- Smoothing runs in sub-pixel space with the `camera smoothing` half-life; only the final offset is snapped to whole logical pixels, with its hysteresis, so a still or slowly moving cursor never makes the view step one pixel back and forth. The camera is presentation: it never changes what the simulation can see (sight ranges are those of Book 10 section 07).
- Options: combat speed 70 to 100%, parry window widening, enemy damage, *Second wind*, *Rán's mercy*, gore level, day length, text size 100 to 200%, subtitles and sound captions, colour-blind presets, reduced shake and flashes, hold-or-toggle inputs.
- Generous interaction radius with the target tile highlighted; every refusal or shortage shows its reason in words.
- **Stamina bar:** its length shows the current maximum, and each reason it is smaller is shown with its icon and a plain word ("Cold", "Hungry"), from the stamina view of section 24 (art in Book 7 section 10).

## 22 / Performance budgets
| Budget | Target |
|---|---|
| Frame rate | 60 fps at 1080p on integrated graphics (WebGL2) |
| Simulation tick | Under 4 ms with 60 active actors including residents |
| Assault battle | Simulation tick under 4 ms with 30 a side plus the scene's civilians; 60 fps held |
| World step (off screen) | Under 2 ms per game-hour step for all twenty mainland areas, their travellers and bandit camps, and the away simulation |
| Scene streaming | No visible hitch at link edges; full scene load under 3 s |
| Sea-map watch resolution | Under 2 ms |
| Save | Under 200 ms |
| Memory | Under 700 MB |

**Rules for big scenes.** Simulation detail never depends on the camera. AI decisions are spread across ticks (each actor still at 10 Hz); sight and hearing query a spatial grid, not every pair of actors; formation members follow their leader's plan (section 13); groups moving to one objective share a path field; corpses, decals and particles are capped by presentation settings, never by deleting simulation state.

## 23 / Testing
*Each stage proves itself. Tests are part of the deliverable.*

- **Unit tests** for pure functions: ship stats, friendship and fear deltas by deed, happiness from its factors and the work multiplier, food runway, spoilage, crop stages, fuel, frame data, tide and calendar, depth band from bed and water level, the stamina maximum from each reason, traversal drains, the away efficiency, the target tile for each device and reach, the melee facing snap and aim quantisation, and camera look-ahead and snapping.
- **Property tests:** ledger append-only, roster cap, no resource below zero, accepted bargains unchanged, one-shots never refire, no gendered steerer strings; stamina `current <= max`, the maximum never below its floor, and every point of lost maximum listed with a reason; companions never more than the cap; an event card never fires twice, never during a tutorial and never two at once; news never reaches a place sooner than a carrier could walk or sail there; every quest that can end in a killing has another out; every layer sheet matches its body's frames.
- **Stamina and traversal:** emptying the bar mid-climb slides the steerer down; mid-swim starts the sink; walking, ordinary carrying and water up to the knee never drain; a homestead task advances the clock by its game time and costs only its small stamina; restorers lift the reasons Book 10 gives them.
- **Scenario runner:** `scenario run SCN_CARRICK --approach STEAL --seed 42` asserts bands, deeds, evidence and leads; `--mode ASSAULT` runs the assault (muster waves arrive by their triggers, objectives become facts, formations hold and break by the rules).
- **Homestead simulation:** a headless run of 120 days under a delegated policy reports food, fuel, sickness and deaths against Book 10 targets. An **away run** with the steerer gone reports output against the Book 10 section 19 efficiency (with and without a skilled steward), shows the home never starves while food is stored, and checks every queued event appears in the homecoming report.
- **Living world:** a headless world run of a year reports traveller and event density on roads, in settlements and in the wilderness, trader visit intervals, bandit camps forming and breaking, and event deck pacing against Book 10 sections 17 and 20.
- **Reachability:** flood-fill every scene from Book 9 under tide and season conditions; walk the mainland's area graph under every season and every combination of cleared blocks, proving every area reachable once its blocks are cleared and both home sites reachable from Chapter 3.
- **Camping:** a camp ends the day, heals, and saves only when safe; its risk falls with a fire, a watch and shelter.
- **Input and camera:** replaying a recorded mouse-and-keyboard session reproduces identical state hashes; `sim/` imports nothing from `input/`, `render/` or the DOM; keyboard-only and gamepad-only bots can do every task and interaction; a still cursor gives a still camera (no one-pixel oscillation over a long run); every new action is remappable.
- **Performance:** an assault of 30 a side and the off-screen world step stay within section 22.
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

## 24 / Stamina and condition
*Stamina is the body's budget in combat and out of it. Its current value gates effort; its maximum tells the player how the steerer is, and why.*

```ts
interface PlayerState {
  name: string; bodyModel: 'A' | 'B' | null; vitality: number; awake: boolean;
  stamina: Stamina; skills: Partial<Record<Skill, 0|1|2|3|4|5>>;
  equipment: Equipment;                   // worn layers (section 19)
  gear: Id[]; hotbar: Hotbar;             // carried items; the hotbar of section 21
  movement: 'WALK'|'RUN'|'SNEAK'|'CARRY'|'HEAVY_CARRY'|'CLIMB'|'WADE'|'SWIM'|'JUMP'|'CRAWL'|'PUSH'|'RIDE';
  awakeSince: number; workedMinutesToday: number;
}
type StaminaReason = 'COLD'|'HUNGRY'|'WOUNDED'|'SICK'|'TIRED'|'HARD_WORK';
type StaminaRestorer = 'HOT_MEAL'|'WARM_FIRE'|'FULL_REST'|'FEAST';
type StaminaDrain = 'CLIMB'|'SWIM'|'WADE_WAIST'|'SPRINT'|'HEAVY_CARRY';
interface Stamina {
  current: number;                        // 0..max
  max: number;                            // base minus every reduction, never below the floor
  base: number;                           // Book 10 section 06
  reductions: { reason: StaminaReason; amount: number; since: number; cause?: Id | string }[];
  empty?: 'SLIDING' | 'SINKING';          // ran out mid-climb or mid-swim
}
interface StaminaView { current: number; max: number; base: number;
  reasons: { reason: StaminaReason; amount: number; labelKey: string }[] }
```
- **Capacity.** `max = base - sum(reductions)`, never below the floor in Book 10 section 06 ("Stamina capacity"), and `current` is clamped to `max`. Each reduction comes from real state and names its cause: cold (an unheated shelter, wet clothes in cold weather, a night outdoors without a fire), hunger (missed meals, short rations), wounds (each wound by severity), sickness, lack of sleep (hours awake; the collapse of section 03 is a `TIRED` reduction) and a hard day's work (game hours worked today beyond the Book 10 allowance). Reductions are recomputed when their cause changes, not every tick.
- **Restoring.** A hot meal, a warm fire, full rest and a feast lift reductions by the amounts and for the reasons Book 10 section 06 gives each one. Wounds and sickness lift only as they heal.
- **Spending.** Combat costs (block, parry, dodge, shove, Book 10 section 06) and the traversal drains of Book 10 section 06 ("Stamina in traversal") spend `current`: climbing, swimming, waist-deep wading, sprinting (running) and heavy carrying drain it every tick they last. Walking, ordinary carrying and water up to the knee never drain it. Regeneration follows Book 10 and pauses while any drain applies.
- **Running out.** Empty mid-climb, the steerer **slides** down the route to the ledge below or its foot (Book 10 section 06, the slide rule) and cannot climb again until stamina returns. Empty mid-swim, the steerer **starts to sink**: slower, lower in the water, and with the consequence Book 10 sets, until they reach water they can stand in. Both are shown before they happen by the bar and by the steerer's laboured animation (Book 7 section 07).
- **Work stays a bonus.** Homestead tasks cost only their small stamina and take their game time (section 07); the hours count towards the hard day's work.
- **Everyone else.** Residents, companions and enemies use the same costs, drains, slide and sink in a scene; their stamina is scene state, set on entry from their condition (hunger, cold, wounds, sickness).
- **The view** gives the interface `StaminaView`: the bar's length is `max` against `base`, and each reason has its icon and a plain word (section 21; Book 7 section 10). The view lists only reasons the steerer can feel; a hidden cause shows as its plain effect ("Cold").

## 25 / The living world
*The coast goes on without the player: travellers on schedules, traders who visit, bandits who gather and scatter, news carried by people, and a deck of rare events.*

```ts
type TravellerKind = 'PILGRIM'|'MONK'|'HERDER'|'RIDER'|'POET'|'TRADER'|'PEDLAR'|'TINKER'|'SMITH'|'FUGITIVE'|'REFUGEE'|'OUTLAW';
interface TravellerDef { id: Id; kind: TravellerKind; person?: Id /* a named wanderer */; partyKey: string;
  schedule: { from: Id; to: Id; reasonKey: string; seasons: Season[]; conditions?: Condition[] }[];
  goods: Id[]; dialogue: Id; recruitable: boolean }
interface TravellerState { def: Id; members: Id[]; area: Id; detail: 'FULL'|'LOW';
  leg?: { link: Id; departed: number; arrives: number /* minutes of campaign time */ };
  goods: CargoLot[]; news: Id[]; status: 'TRAVELLING'|'STAYING'|'CAMPED'|'GONE'|'DEAD'|'CAPTIVE' }
interface NewsItem { id: Id; about: { deed?: Id; fact?: string }; origin: Id; day: number;
  truth: boolean /* rumours can be wrong */; carriers: Id[]; reached: { place: Id; day: number }[] }
interface TraderVisit { kind: 'SALTVIK_KNARR'|'GAELIC_PEDLAR'|'WANDERING_SMITH'|'SEA_WIFE'|'FENCE';
  traveller: Id; nextDay: number; conditions: Condition[]; stock: CargoLot[]; leads: Id[] }
interface BanditCamp { id: Id; area: Id; leader?: Id; members: Id[]; formedDay: number;
  status: 'FORMING'|'ACTIVE'|'BROKEN'; targets: Id[] }
interface EventCard extends BeatDef { deck: true; oneShot: true }
interface LivingWorldState { travellers: Record<Id, TravellerState>; banditCamps: Record<Id, BanditCamp>;
  news: Record<Id, NewsItem>; traders: TraderVisit[]; deck: { lastFiredDay?: number; active?: Id } }
```
- **Full and low detail.** Whatever is in the active or a streamed scene runs at full detail as actors. Everything else runs at low detail in the **world step**, once per game hour on foot and per watch at sea, on the `world` stream: travellers move link by link at the walk times of Book 10 section 14, trade, rest and camp; places spend and refill their stores and move their people's moods; bandit camps grow, strike and scatter. The low-detail step applies the same rules in summary, so nothing is gained or lost by being watched. Moving between detail levels is lossless: a traveller entering a scene appears where its leg puts it; one leaving keeps its state.
- **Travellers** follow schedules with an origin, a destination and a reason (pilgrims to Kilbrecc, monks, herders driving cattle, Fiachra's riders, a travelling poet, traders' carts, tinkers, fugitives, refugees from Orm's raids). They can be talked to, traded with, helped, recruited or robbed, and each of those is a deed with witnesses (section 15). Named wanderers (the poet, the pedlar, the hermit, the disgraced warrior) are people with memories and recur across the campaign.
- **News** is carried, never broadcast. A deed's knowledge and any notable happening (a fire at Saltvik, a raid by Orm, a death at Ardcarn) become news items on the people who know them; a place learns when a carrier arrives, and passes it on with its own travellers. The steerer hears news by talking to a carrier, from a visiting trader, or in the morning report when a carrier reaches the home. Rumours can be wrong.
- **Visiting traders** come to the homestead on the Book 10 section 17 schedule (a Saltvik knarr in the sailing season, a Gaelic pedlar once the household is on the mainland, a wandering smith once a season, the sea-wife now and then, Ulf's men as fences for stolen goods). They arrive as travellers, whether or not the steerer is home, and bring goods, prices, news and leads.
- **Bandits:** outlaw camps form in wilderness areas when Book 10 section 17's conditions hold, take in fugitives, ambush roads, raid farms when unchecked (deeds against those places, carried as news) and break up when beaten, when their leader dies, or when they starve.
- **Leaders:** every settlement and camp has a named leader (`PlaceState.leader`), a person with friendship and fear (section 06).
- **The event deck** holds about forty cards (Book 4), each a beat with conditions that fit the moment. A governor draws at most one at day start on the `world` stream, keeping the Book 10 section 17 interval between cards, never during a tutorial and never while another is active; every card fires at most once per campaign (a one-shot, recorded before its effects). Content lint rejects any card that puts a child on stage.
- **Density** is a content and world-step target, measured by the living-world run (section 23): on a road or in a settlement a traveller or living event about every minute, in the wilderness a creature, sign or event every 30 to 60 seconds, and something worth stopping for every 20 to 30 seconds of walking (Book 10 sections 17 and 20).

## 26 / Prohibited shortcuts and the decision log
- Do not delete or bypass a locked feature to make a test pass.
- Do not use permanent primitive shapes or emoji in place of sprites.
- Do not read hidden truth into UI, audio or dialogue unless discovered.
- Do not introduce `Math.random()`, wall-clock time or frame-rate-dependent logic in the simulation.
- Do not rewrite accepted bargains or delete ledger or evidence entries.
- Do not hard-code tuning numbers; read them from `balance.json`.
- Do not add children as actors, sexual violence of any kind, or a player torture action.
- Do not refer to the steerer with gendered pronouns or terms.
- Do not add a tactical pause.
- Do not let the simulation read the pointer, the screen or the camera; devices make commands (section 21).

**Decision log:** `docs/decision-log.md`, one entry per departure: date, stage, decision, reason, alternatives, books affected, approved by.
