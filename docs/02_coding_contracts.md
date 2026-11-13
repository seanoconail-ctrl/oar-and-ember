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
- **Platform:** desktop, in Chromium (current Chrome and Edge, and the Chromium-based desktop wrapper planned for a Steam release) and WebKit (current Safari); Firefox is not a target (decision BR-9). Keyboard and mouse, with gamepad support.
- **Art:** authored by Claude as palette-indexed pixel sources compiled to atlases (section 19).
- **Combat:** real time with no tactical pause; light, charged heavy, parry, block, dodge, shove, stamina and facing.
- **Death:** the steerer's death is game over. Downed crew and allies are not dead: they survive if carried to safety before the scene ends, and are captured or killed if left behind (section 12). Crew permadeath comes from being left behind, from berserkers and cruel enemies, and from scripted deaths; the *Rán's mercy* option prevents every unscripted death.
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
| Happiness, friendship and fear; traits, likes, relationships, tendencies and stances; disputes; requests; stamina and condition (sections 06, 24) | `sim/people/` |
| The away simulation and visiting traders at the homestead (sections 07, 25) | `sim/home/` |
| The mainland's sites and routes, journeys (road legs, journey events, the travel map, shortest journeys), route state and waystations, water depth, camping, companions, travellers and bandit camps on and off screen (sections 10, 25) | `sim/land/` |
| News carried by people; deed reactions by culture (sections 15, 25) | `sim/ledger/` |
| Quests, the event deck, story gates and conversation (sections 06, 16, 25) | `sim/narrative/` |
| Raids, land and sea-borne attacks, defences, muster and formations; downed and carried (sections 11 to 13) | `sim/raid/`, `sim/combat/`, `sim/ai/` |

### Modes
```
Boot -> Title -> Campaign -> GameOver | Ending
Campaign modes:
  OnFoot     (home, island zones, mainland sites and routes, dungeons, raid sites, harbours,
              journey events) real time
  SeaMap     route plotting and watch-by-watch travel
  SeaBattle  ship-to-ship arena, boarding uses OnFoot combat rules
  Planning   raid plan, departure, the travel map, a gate's readiness screen, council seating
              (opened only when safe)
  Dialogue   conversations (barks are not a mode)
  Report     morning report, homecoming report, post-raid summary (opened only when safe)
```
Every transition passes a typed **handoff** and returns a typed **result**. A mode never reaches into another mode's state.

### The "safe" rule
A menu or planning screen may open only when no hostile actor is aware of the player (`threat.awareHostiles == 0`). While open, simulation time stops. The system menu follows the same rule; when hostiles are aware it opens as an overlay without stopping time. There is no tactical pause.

**The pause menu** (the user's third playtest; decision DG-15) is the system menu, opened with Escape (also P, and the pad's Start). When it opens under the safe rule it **pauses**: no simulation tick runs until it closes, and the frame that was showing stays drawn behind it, dimmed. With a hostile aware it opens as the overlay above and the world runs on; if a hostile becomes aware while it holds time, time starts again and it stays open as an overlay (`MenuController.update`). Its items, in order: **Resume**; **Save** (refused with its reason unless the safe rule holds, section 20); **Load**; **Settings**; **Fullscreen** (a toggle); **Reset to the start of this day** (section 20); **Controls**; **Quit to title**. Load, reset and quit leave the moment the player is in, so they are offered in the overlay too, each after one confirmation. Opening and closing it is presentation and input: the simulation never sees it, and the time it held is added to the telemetry's menu time as before (section 05).

## 03 / Time, determinism and the calendar
*A fixed tick, a real-time day on foot, watches at sea, and seeded randomness.*

- Simulation tick **60 Hz** fixed step with render interpolation.
- **Calendar:** `day` from 1; `year = ceil(day / 120)`; seasons of 30 days; four watches per day (Morning 06-12, Day 12-18, Evening 18-24, Night 00-06).
- **On-foot clock:** one game hour lasts `balance.time.secondsPerHour` real seconds (Book 10). The active day runs 06:00 to 02:00. Sleeping in a bed after 18:00, or at a camp (section 10), advances to 06:00 and triggers the morning report. Staying awake past 02:00 causes a collapse with the penalty in Book 10. A day-length option scales the clock.
- **Actions that cost game time:** a homestead task done by the steerer (section 07), a journey's road legs (section 10) and camping advance the clock by their Book 10 time. The world is never skipped: the interval is run through the low-detail steps (the home step of section 07, the world step of section 25), so crops grow, stores are eaten and travellers move exactly as if the time had passed in play. A time advance happens only under the safe rule and stops at once if a hostile becomes aware.
- **At sea:** travel resolves per watch (six game hours) with a short animation.
- **The calendar never waits for the story.** Seasons turn, crops grow and winter comes whatever the player does, but no chapter deadline passes without the player: chapters have typical dates (Book 4), and dated story events wait at their gate until the player chooses to start it (section 16).
- **Tide:** flood and ebb alternate each watch, low water at the end of each ebb watch, phase shifting one watch every three days; spring tides on days 1 and 16 of each season. Tidal ground is passable within the window in Book 10.
- **RNG streams:** `weather, encounters, loot, combat, ai, people, generation, gore, world` seeded from the campaign seed. `world` drives the living world (travellers, visiting traders, bandit camps, the event deck, off-screen places) and the away simulation, so what happens out of sight never disturbs the draws of a raid or a voyage. A missile's spread is drawn on `combat`; whether a missile that hits stays whole (recoverable) or breaks is drawn on `loot` (section 12, Missiles). No `Math.random()` or wall-clock time in `sim/`.
- **Determinism test:** replaying a recorded input stream from a save reproduces identical state hashes.

## 04 / Content data and IDs
*Content is data; numbers are data. IDs are stable forever.*

| Prefix | Type |
|---|---|
| `ISLE_ TOWN_ FORT_ ABBEY_ GLEN_ CAMP_ SITE_` | Places on the sea map |
| `REG_ ZONE_` | On-foot regions and their zones |
| `MAIN_` | Places of the mainland, the one shared region: sites explored on foot and the wilderness routes between them (Book 4, Book 9) |
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

Some kinds of content use an existing prefix rather than their own: a journey event is a scenario (`SCN_`, section 10), a story gate is a beat (`BEAT_`, section 16), and a waystation is a building (`BLD_`, section 10). Traits, stances and caption kinds are fixed enumerations in code, not IDs.

## 05 / World state
*One serialisable world state. Everything that matters to a consequence lives here.*

```ts
interface WorldState {
  version: number; seed: string; rng: Record<RngStream, RngState>;
  calendar: { day: number; minuteOfDay: number; weather: WeatherState; tide: TideState };
  player: PlayerState;                    // section 24: vitality, stamina, skills, equipment, hotbar, bodyModel, name
  onFoot: OnFootState | null;             // the on-foot scene: the steerer (with a drawn bow's aim), the people nearby, who is carried, missiles (section 12)
  party: { companions: Id[] };            // residents on foot with the steerer (section 10)
  household: { residents: Id[]; hostages: Id[]; guests: Id[]; shelterPlan?: ShelterPlan };
  people: Record<Id, Person>;             // everyone with a name, alive or dead
  disputes: Dispute[]; requests: Record<Id, RequestState>; quests: Record<Id, QuestState>;
  ships: Record<Id, ShipInstance>;
  homes: Record<Id, HomeState>;           // buildings, plots, designations, stores, fields
  away: AwayState | null;                 // the home while the steerer is away (section 07)
  regions: Record<Id, RegionState>;       // discovery, sites, routes and their state, blocks, resource nodes, puzzles, bodies
  journey: JourneyState | null;           // the journey under way, if any (section 10)
  camp: CampState | null;                 // the steerer's camp tonight (section 10)
  places: Record<Id, PlaceState>;         // settlements' true stores, defences, people, leader
  world: LivingWorldState;                // section 25: travellers, bandit camps, news, traders, event deck
  factions: Record<Id, FactionState>;     // regard, fear, hostility, territory
  ledger: Deed[];                         // append-only
  evidence: Evidence[];                   // bodies, dropped items, tracks awaiting discovery
  knowledge: KnowledgeState;
  bargains: Record<Id, Bargain>; powers: Record<Id, PowerState>;
  chapters: Record<Id, ChapterState>; gates: Record<Id, GateState>;   // section 16
  facts: Record<string, FactValue>; oneShots: Record<Id, number>;
}
```
The ledger is append-only; facts are superseded, never deleted; the dead stay in `people` with their memories; one-shots are recorded before their effects apply.

**Versions.** The state carries its schema version, and every change to its shape adds a migration (section 20). Version 2 (Stage 6) added `onFoot`; version 3 (the Stage 6 rework, decision S6R-7) added `player.hotbar` and `onFoot.player.aim`; version 6 (Stage 8, decision S8-23) gave people section 06's shape (happiness, friendship and fear in place of `regard`, traits, likes, tendencies, their day's bookkeeping in `Person.life`) and added `disputes`, the conversation under way (`talk`) and the barks heard (`barks`); version 7 (Stage 9, decision S9-10) added each person's part in a fight on foot (`fight`: the section 12 state machine, vitality, stamina, side and mind; `onFoot.player.fight`), the fight under way in the zone in view (`onFoot.battle`), the campaign's options (`options`: Second wind, Rán's mercy, the parry window) and the game over (`gameOver`); version 10 (Stage 12, decision S12-13) added the story gates' state (`gates`, section 16), the chapter's telemetry (`telemetry`: when play began, the time menus held the game, and when each milestone was first reached) and the boat's own name (`ShipInstance.name`, free text beside `nameKey`, decision S12-10). The fields above that are not yet built (among them `journey` and the people data of section 06) arrive with their stages, each with its own version step. **Design addendum 2.4** adds, with one version step when it is built (decisions DE-1 to DE-30): the combat v2 state of each fighter (`fight.poise`, `fight.awareness` and the hitstop under way, section 12), the steerer's lock-on target and sneak toggle (`onFoot.player.lockOn`, `onFoot.player.sneaking`), the doors of the zone in view (`onFoot.doors`, section 10), the current aim and its stuck clock (`aims`, section 16), carried things set down at their home (`homes[...].placed`), and the healing items carried (`player.counts`, section 24). Its migration gives an older save the Chapter 1 state it would have had: a chest at the camp if the bow is already owned, no lock-on, every door closed. **The user's third playtest** adds, with one version step (13) when it is built (decision DG-23): what the campaign has taught (`player.teaching`: `fights`, the fights counted towards Book 10's `promptFights`; `heals`, the heals finished towards `healPromptUntil`; `sneakShown`, the sneak hint's showings; `retired`, the combat prompts retired; and `lessons`, the teaching foes' lessons done, `PARRY` and `RED`), the spared (`spared: SparedRecord[]`, section 15), and the shelter's stage as a fact (`ch1.shelter`: `FOLDED`, `FRAME`, `SAIL`, `FINISHED`, replacing `ch1.shelter_raised`). Its migration counts an old save's fights as three (no prompts come back mid-campaign), marks a shelter already raised as `SAIL` (or `FINISHED` at camp stage S1), and starts `spared` empty, with no fate for spares already written.

## 06 / People
*Residents and leaders are people with values, traits, likes, ties and memories, judging by the code of their own culture. Three measures (happiness, friendship and fear) are computed from how they live and from witnessed deeds, and shown in readable steps with the reason for each.*

```ts
type Value = 'GAIN' | 'MERCY' | 'GLORY' | 'KIN' | 'FAITH' | 'WORD';
type Code = 'NORSE' | 'GAELIC' | 'CHURCH' | 'KEEPERS' | 'SALTVIK';   // the ethics a person judges by (Book 5)
type CodeStance = 'CONVENTIONAL' | 'SCEPTICAL' | 'CYNICAL' | 'TRANSGRESSIVE';
type Trait = 'BERSERK'|'COWARDLY'|'SUPERSTITIOUS'|'BRAVE'|'GREEDY'|'PIOUS'|'HOT_TEMPERED'|'GENTLE'|'DRINKER'
  |'LIGHT_FINGERED'|'KEEN_EYED'|'SEA_SICK'|'STORYTELLER'|'GRUDGE_HOLDER'|'DILIGENT'|'LAZY';
interface Person {
  id: Id; nameKey: string; origin: Origin; appearance: AppearanceRef; equipment: Equipment; // section 19: build A, B or HEAVY
  status: 'alive'|'downed'|'wounded'|'sick'|'dead'|'missing'|'captive';
  vitality: number; skills: Partial<Record<Skill, 0|1|2|3|4|5>>; skillXp: Partial<Record<Skill, number>>;
  values: Partial<Record<Value, 1|2|3>>; faithTarget?: 'OLD_GODS'|'CHRIST'|'LAND_SPIRITS'|'NONE';
  codes: Code[];                          // one, or two for people of mixed birth (Bran, Senán, Áine, much of Saltvik)
  codeStance: CodeStance;                 // towards their own code; can shift after strong events, as values do
  traits: { trait: Trait; known: boolean; faith?: Person['faithTarget'] }[];   // two to four; PIOUS names its faith
  likes: Liking[]; dislikes: Liking[]; tendencies: Id[];   // small daily behaviours, by schedule (below)
  happiness: number;                      // 0..100: mood now
  friendship: number;                     // -100..100: how they feel about the steerer over time
  fear: number;                           // 0..100: how much they fear the steerer
  moodToday: MoodFactor[];                // the reasons for today's happiness, each with its share
  ties: Tie[];                            // kin, spouse, friend, rival, grudge, mentor, drinking companion, debt, grievance, oath
  memories: Memory[]; wounds: Wound[]; job?: JobAssignment; schedule: ScheduleRef;
  requests: Id[]; secret?: Id /* a hidden allegiance, such as Nessa's secret (Watcher, Bound or Runaway); never shown until discovered */; valueShifts: number;
}
interface Liking { kind: 'FOOD'|'ACTIVITY'|'PLACE'|'WEATHER'|'PERSON'|'GIFT'; ref: Id | string; known: boolean }
interface Tie { to: Id; kind: TieKind; since: number; cause?: Id | string /* the shared event it formed from */ }
interface MoodFactor { cause: 'FOOD'|'WARMTH'|'REST'|'SAFETY'|'SUCCESS'|'GRIEF'|'FESTIVAL'|'TREATMENT'|'LIKE'|'DISLIKE'|'TIE';
  amount: number; detail?: string /* string key: "slept cold", "praised at the feast" */ }
```
Leaders are people too: friendship and fear apply to every named leader of a settlement or camp, alongside their faction's state (section 15).

**Rescued people join the household, every time** (design addendum 2.4 section 2 and 2.5 section 4; decisions DE-22 and DF-18). A person rescued (Hild, Oddi, Bran, Runa in Chapter 1, and anyone rescued later) gets up after Book 10's `rescueGetUp`, walks to the camp under their own power (at the limp speed if hurt), takes up work at the next work period, eats at the next meal, sleeps under the shelter at night and answers talk, whatever the time of day, the route home and what the steerer does next, including leaving at once. A rescued person never waits on the steerer to be fetched, and is never left sitting, standing or lying where they were found. Their state is simulation (`status`, `job`, `schedule` and position), so a save made at any moment of the walk home loads and carries on. Every rescued person is checked by the rescue scenario test (section 23).

### Three measures
- **Happiness** is mood now. It is recomputed each morning from food, warmth, rest, safety, recent success, grief, festivals and how the person was treated, and moves during the day as those change. `moodToday` holds the reasons so the interface can say why.
- **Friendship** is how the person feels about the steerer over time. It moves with kept and broken promises, care, gifts, time spent together, and shared deeds that fit the person's values.
- **Fear** is how much the person fears the steerer. It moves with brutality, punishments, displays of strength and threats.
- **Deeds feed friendship and fear, judged by the witness's own code.** Each deed a person witnesses or hears of (section 15) is weighed first by the witness's culture (Book 10 section 08, "Deed reactions by culture": the same deed reads differently to the Norse, the Gaels, the Church, the Keepers and Saltvik), then by their values, their traits ("Traits") and their stance ("Stances"), with the witness factor, giving the friendship and fear deltas. A person with two codes judges, and is judged, by either, taking the stronger of the two cultures' factors (Book 10 section 08). The steerer's acts at home (a gift, a punishment, a judgement, a promise) are deeds of the same kind, and the household reacts by its own code even when the player acts against it.
- **Effects** follow the Book 10 section 08 table "Happiness, friendship and fear": work output scales with happiness, and low happiness makes disputes likelier; high friendship volunteers for danger, defends the steerer and stays in hard times; low friendship without fear leaves; high fear without friendship obeys any order at lower quality and may desert or betray while the steerer is away or wounded; high fear with high friendship is fierce devotion.
- **The warning flow** stays: crossing a friendship band downwards (Book 10 section 08, "Friendship bands"), or falling into one of the effects above that ends in leaving, triggers in order, with at least two days between steps: a remark, a complaint scene, refusal of the order class that caused it, a request to leave.
- **Ties** include existing relationships (spouses, siblings) from content; there is no romance system and no tie of type lover can be created in play.
- **Schedules:** each resident follows a daily schedule (wake, eat, work shift, meal, evening, sleep) adjusted by job, season, weather, wounds and events, so they are always visibly doing something.
- **Own hours, not the steerer's** (the user's fourth playtest, decisions DH-44 to DH-47; Book 10 section 08, "Own hours"). A resident sleeps from their own bedtime to their own rising, whatever the steerer does: the household's (content/household.json's SLEEP and MEAL blocks), from a later bedtime for those whose traits or likes keep them at the fire (Storyteller, Drinker, a like for the fireside), to an earlier rising for the Diligent and the Pious, who are at work, or at a dawn habit, before the steerer wakes. While two or more are at home one keeps the night watch by turns (`WATCH`, awake by the fire, feeding it from the woodpile) and sleeps on in the morning. The steerer's sleep still passes the night at once (section 03); everyone's own day runs through it minute by minute, and when the night (or a collapse) has passed each resident is placed where their own day has them then, in its pose. Which hours a person keeps is content (content/company.json `hours`, by trait and like), so every later resident keeps theirs.
- **Being bound** (DH-40): while the steerer's hands-on binding (tending wounds, section 07) is on a resident, their activity is `TENDED`: they sit still where they are, facing the steerer, until it ends. **A binding refused** (DH-41 to DH-43): a resident whose trait content/company.json names (`care.refusers`: Runa, Superstitious) refuses the steerer's hand on a wound the first time it is offered for that wound, and again that day; the talk then offers their own node of answers, and one of them (`TEND_PERSUADED`: holding the end while they bind it) is taken up at once; asked on a later day (Book 10 careLater) they let it be bound. The refusal keeps the wound's topic on offer. The state is `world.company.care`.
- **Talk among the household** (DH-48 to DH-52): exchanges of two or three speech lines between residents within Book 10's exchangeNear of each other and in the steerer's hearing, from content/company.json `exchanges`, each with the terms it needs (a tie between its speakers, a trait, a memory, a story fact as the aims' conditions, the activity they are at). The least lately heard that fit are chosen first, then the most particular (Book 10 exchangeChoice), one drawn on the `people` stream. Never in a fight, a scene, a conversation, a story beat, the launch or the sea burial, nor while the steerer sleeps; never within exchangeQuiet of another speech line; exchangeEvery between one's end and the next's start; barks wait while one is spoken. State: `world.company` (the exchange under way, each one's last hearing, the next start).
- **Boat work** (DH-59 to DH-64): a job's workers each have a spot of their own, never shared: in order of their names, the seriously wounded at the job's seated places (`hurtSpots`), the rest at its `spots`, each the next along; a spot may say how the job is worked there (`pose`: standing at the task's loop, or kneeling). The shipwright's six spots are round the boat (either side, stem and stern), none within Book 10 boatSpotClear of the steerer's own work spot. Asked "The boat", a resident whose job is the boat's says what it needs next (content/company.json `boat.lines`, by need: the boards, the patch, the rigging to fetch or step, the oar to fetch, carve or ship, the fitting, ready); the boat's drawing follows its labour (Book 7 section 05; Book 10 hullStages and riggingStages).
- **Conversation topics** are generated from memories (recent deeds, deaths, wounds, the weather, their job, their ties) with a priority and a cooldown; residents may approach the player with high-priority topics. What they say is chosen from the conversation data of section 16.
- **Player references:** dialogue never uses gendered pronouns or gendered terms for the steerer. Content lint rejects strings tagged as addressing or describing the steerer that contain them.
- **Harming residents:** the player can strike residents. The first blow triggers a warning reaction; repeated harm or a killing is a deed with household-wide consequences, up to residents fleeing, fighting back or leaving.

### Traits, likes, relationships, tendencies and stances
Every resident and companion has two to four traits, likes and dislikes, relationships with other residents and small tendencies (Book 5 gives each person's; generated people draw theirs on the `people` stream). Values say what a person cares about; traits say how they behave; stance says how they hold their own culture's code.
- **Traits** are known at once or discovered over time (`known`): a trait is revealed by the first event that shows it (a berserk fit, a theft found, a panic at an omen), and is then shown for good. Each trait's effect comes from Book 10 section 08, "Traits":

| Trait | What it changes |
|---|---|
| Berserk | Combat (section 12): when wounded or when a friend falls, may go berserk on the `combat` stream |
| Cowardly | Cohesion (section 13): breaks first; may flee a fight; unhappy on night raids |
| Superstitious | Refuses tasks or voyages after bad omens (section 17); panics at supernatural signs; insists on rites |
| Brave | Holds the line longer; volunteers for danger |
| Greedy | Pockets loot; raises `PLUNDER_SHARE` disputes |
| Pious (to a faith) | Prays daily (a tendency); reacts more strongly to sacrilege against its faith and to its own faith's cruelty |
| Hot-tempered | Starts `INSULT` and `FIGHT` disputes; quick to fight |
| Gentle | Calms disputes as a watcher; unhappy at killing |
| Drinker | Drinks at feasts and in hard times; works and fights worse the morning after |
| Light-fingered | Takes small things from the stores (a `THEFT` dispute when found) |
| Keen-eyed | Spots sails, ambush signs (section 10) and hidden things sooner, at sea and on watch |
| Sea-sick | Works and fights worse at sea; better on land |
| Storyteller or singer | Raises the happiness of everyone at the evening fire |
| Grudge-holder | Remembers every slight as a grudge tie; feuds |
| Diligent or lazy | Works more or less without supervision |

- **Traits reach every system:** work output (section 07), combat behaviour (section 12) and cohesion (section 13), reactions to deeds (above), the disputes that arise and who calms them (below), and what a person says (section 16).
- **Likes and dislikes** cover foods (salt fish, honey, ale, kale), activities (fishing, carving, fighting), places, weather, people and gifts. A like that is met adds a `LIKE` mood factor (Book 10 section 08, "Likes and dislikes"); a like ignored costs nothing; a dislike suffered adds a `DISLIKE` factor. Likes start unknown unless shown and are learned by talk and by watching.
- **Relationships between residents** form and break through shared events (a fight side by side, a dispute judged, a share argued over, a night of drinking, a rescue) at the Book 10 section 08 "Relationships" rates: friends, rivals, grudges, mentors, drinking companions and family. A tie records the event it grew from. Existing marriages and family ties come from content; there is no romance system.
- **Tendencies** are small scheduled behaviours that make people readable (praying at dawn, walking the shore at night, hoarding stones, singing at the oars). They are entries in the person's schedule, never effects on the simulation beyond where the person stands.
- **Stances** (conventional, sceptical, cynical, transgressive) choose how a person justifies themselves and which lines they speak (section 16), and adjust their reactions by Book 10 section 08, "Stances". A stance can shift after a strong event, like a value, and the shift is a memory.
- **The household screen** shows each person's known traits, known likes and dislikes, relationships, happiness, friendship and fear, each with a line saying why it is what it is ("Happy: a hot meal, a warm bed, honey at the feast"; "Fears you: the flogging at the thing"; "Rival of Kolbeinn since the quarrel over the shares"). The lines come from `moodToday`, the deeds and memories behind each measure and each tie's cause, never from hidden truth (section 01). The household screen is interface text, not dialogue, so the dialogue word list (section 23) does not apply to it.

### Disputes
```ts
type DisputeKind = 'THEFT'|'INSULT'|'FIGHT'|'SHIRKING'|'PLUNDER_SHARE'|'BELIEF'|'GRUDGE'|'DEBT'|'BROKEN_PROMISE';
type Judgement = 'TAKE_SIDE'|'COMPROMISE'|'PUNISH'|'COMPENSATE'|'HOUSEHOLD_THING'|'IGNORE';
interface Dispute { id: Id; kind: DisputeKind; day: number; parties: Id[]; cause: Id | string /* deed, memory or fact */;
  watchers: Id[]; status: 'OPEN'|'JUDGED'|'IGNORED'|'BOILED_OVER';
  judgement?: { kind: Judgement; favoured?: Id; punished?: Id[]; paid?: Cost[]; day: number } }
```
- Disputes arise on the `people` stream at the Book 10 section 08 rate once the household reaches the size that table gives, more often when happiness is low. Each grows from something real: a tie, a memory, a share of plunder, a debt, a shrine, a broken promise. No dispute is about a stranger. Traits shape them: the hot-tempered, greedy, light-fingered and grudge-holding start more, and a gentle watcher makes boiling over less likely (Book 10 section 08, "Traits").
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
- Tasks include sow, weed, harvest, fish (shore and boat), gather (shellfish, seaweed, eggs, driftwood), cut peat, cut hay, build, carpentry, smith, cook, care, herd, shear, slaughter and preserve, repair ship, train, watch; and, from the steerer's list in Book 1 section 10, felling and splitting timber, watering the kale garden in dry spells, threshing, net-mending and milking. Build covers hammering, raising beams and thatching; care is tending wounds. **Fletching** makes arrows at the workshop from a shaft-blank of driftwood or timber, feathers and a head of bone or iron (Book 10 section 21, "Arrows"); the arrows go into the store or the steerer's count (section 24).
- **Every task by hand:** the steerer can do every task residents do, with the same work loop. The player interacts with a task site, or uses the selected hotbar tool on its tile (section 21), and performs its `playerAction`. A menial task's action is **plain** (decision PT-1): the work loop plays for Book 10's `actionSeconds` with no timing ring and no press, and adds work at their skill level. Only the tasks Book 10 names as timed (`timedTasks`: fishing from the shore) keep a **timed press**, which adds a quality bonus for good timing (`playerTimingBonus`); missing it never ruins the catch, it only adds less. Some things are not worked but found: a piece of driftwood is picked up with a plain interact and a short stoop, and its load goes into the camp's store at once (Book 10 section 03, "Driftwood finds"; decision PT-2). **Cutting** a net or a lashing is a hold, not a task: holding use with a blade at it plays a sawing loop for Book 10's `cutHold`, fibres flying, and letting go keeps what is cut (decision DE-16). **The sail shelter** goes up in stages at Hild's word (the user's third playtest, decision DG-12): the frame and the sail are each one plain action on day 1 (Book 10 section 03, `shelterFrame` and `shelterSail`), and the finishing is building work from 06:00 on day 2 (`shelterFinish`), by residents and the steerer alike.
- **Time, not toil:** each completed player action advances the clock by the task's `playerGameMinutes` while the work loop plays (section 03: run through the home step, safe rule only; when hostiles are aware the work still counts but no time is advanced) and costs the task's small `playerStamina`. Task stamina never empties the bar on its own; the hours worked count towards the hard day's work that lowers the maximum (section 24).
- Output per worker per unit follows Book 10 section 03 and is modified by skill, tools, weather, season, the worker's happiness and their traits (diligent or lazy without supervision, a drinker the morning after, the sea-sick at sea; section 06).

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
Stage 11 (decisions S11-2 and S11-3): the household's ship is `ships.flagship`; `ShipInstance` also holds where it lies on foot (`lies`), Chapter 1's repairs (`repairs`: HULL, RIGGING and STEERING_OAR, each LACKING, MATERIALS with work in worker-minutes, or DONE, and how it was come by) and a fitting under way (`fitting`); `fittings` is keyed by the hull's slot labels (content/hulls.json `slots`; a second midship is MIDSHIP_2). `deriveStats` reads every fitting's effect and drawback cells from Book 10 term by term; a ship lacking a repair is not seaworthy, and without rigging has no sail. Every cargo lot takes one slot; livestock pens two; passengers beyond berths two each. Replacing a hull transfers name, marks, history and up to two fittings. Wear and repair follow Book 10.

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
- **A fixed night at home** (section 16, the defence of Skarvholm): once the household is warned, the sea map refuses a voyage whose earliest return would keep the steerer away that night, and says why in words ("The attack comes before you could be home.").

## 10 / On-foot regions and exploration
*Home and island are streamed scenes joined by links on foot; the mainland is sites and wilderness routes joined by journeys. Discovery, resources, puzzles, territory, water, hazards and camping live here.*

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

### Doors, edges and things with a home
```ts
interface DoorDef { id: string /* zone-local key */; zone: Id; pos: Vec2; facing: Facing; width: number /* tiles */;
  kind: 'DOOR'|'FLAP'|'GATE'; sheet: string; stages?: string[] /* camp or building stages it exists at */;
  barrable: boolean; barSide?: Facing }
interface DoorState { id: string; open: number /* 0 closed .. 1 open */; moving: -1|0|1;
  closeAt?: number /* tick */; barred: boolean }
interface EdgeKind { kind: 'NOTHING'|'DEEP'|'STEEP' }              // which caption an edge gives
interface CarryHome { item: Id; zone: Id; pos: Vec2 /* where its outline shows */; settle: number /* tiles */ }
```
- **Doors** (decision DE-26). Every door and hide flap is a `DoorDef` in its zone's content and a `DoorState` in `onFoot.doors`. Walking into a closed door, interacting with it or clicking it opens it over Book 10's `openTicks`; it closes `closeAfter` seconds after its doorway is clear. Anyone opens a door by walking through it (residents and enemies use them too). A closed door blocks movement, sight and missiles like a solid tile; an open one blocks nothing; a barred door opens only from its `barSide` (barring comes with the defences). Doors are simulation state, drawn from it (Book 7 section 06); Book 9 lists which exist.
- **Edges** (decision DE-25). Movement pressed more than Book 10's `edgeStopAngle` into an edge or impassable ground stops the steerer at it, with no sliding along an invisible wall; pressed at a shallower angle, it moves along the edge. After `edgeCaptionAfter` of pressing, the edge's information caption shows (`NOTHING`: "Nothing that way"; `DEEP`: "The water's too deep"; `STEEP`: "Too steep to climb"; Book 8 section 10), at most once in `edgeCaptionCooldown`. The edge kind comes from the ground: deep water is `DEEP`, a cliff, a bank face or rock is `STEEP`, the end of a zone with no link and anything else is `NOTHING`.
- **No trap** (the user's third playtest; decision DG-20). No collision shape may trap anyone: every edge has a way out. A body whose footprint already overlaps blocking ground (tidal ground closed by the tide, deep water risen round it, a door shut on it, a prop or another body set on it) may always move in any direction that does not deepen the overlap, and is never held still by what it already stands in; tidal ground that closes under someone counts for them as wading water of its band until they leave it (Book 10 section 25, "No trap"). No gap between collision shapes narrower than the footprint plus Book 10's margin may be a dead end. The edge-walk test (section 23) proves it for every zone at every tide.
- **Things with a home** (decision DE-17). A carried thing with a `CarryHome` (Thorkel's chest) shows a faint outline at its home while carried within Book 10's `homeOutline`; set down within `settle` of it, it settles into place there, and the fact that it is home is kept. The outline is presentation of that state; there is no other marker.

### The mainland: sites, routes and journeys
```ts
interface MainlandPlaceDef { id: Id /* MAIN_ */; region: Id; kind: 'SITE'|'ROUTE'; scenes: SceneRef[];
  coastal: boolean; knownAtStart: 'NO'|'YES'|'BY_SEA'; homeSite?: Id; leader?: Id;
  territory: Id | 'WILDERNESS'; ends: RoadEnd[] /* where road legs leave it */;
  pois: PoiDef[]; seasonal: { season: Season; changes: Effect[] }[]; dungeon?: Id;
  route?: RouteDef /* kind ROUTE only */ }
interface RoadEnd { id: string /* 'NORTH', 'SOUTH', 'EAST', 'WEST', or a branch */; pos: Vec2; waymark?: Id }
interface RouteDef { campSpots: Id[]; waystationSpot?: Id /* one camp spot per route */; shortcuts: Id[];
  branches: { site: Id; at: Vec2 }[] /* sites entered from the route: the Black Wood's heart, the Trackway, the Mound Field */;
  encounterTable: Id /* Book 10 section 14, "Route encounters" */; ambushSites: Id[];
  secretEntrances: SecretEntranceDef[] /* Book 4 section 03; Book 9 section 14; Book 10 section 20 */ }
interface SecretEntranceDef { id: Id; pos: Vec2 /* hidden: no marker until found */; dungeon: Id /* its small dungeon's scene */;
  conditions?: Condition[] /* season, water level, ice to break */; hints: HintSign[]; rumours: RumourDef[];
  foundFact: string; rewards: Id[] }
interface HintSign { kind: 'MARK'|'DRAUGHT'|'BIRDS'|'COMPANION'|'OTHER'; pos: Vec2; seenFrom: Rect /* on the approach */;
  conditions?: Condition[] /* a draught shows on cold mornings; birds by day; the companion must be keen-eyed */ }
interface RumourDef { lineKey: string /* a minor character's line pool, section 16 */; speakers: Id[] | 'POOL';
  points: Vec2 /* where it says to look */; truth: boolean /* deliberately wrong rumours point elsewhere */ }
interface PoiDef { id: Id; major: boolean; pos: Vec2; offPath: boolean; guardedBy?: Id[] /* hazards, a climb, a wade, a puzzle */;
  rewards: Id[]; foundFact: string }
interface RoadLeg { id: Id; a: { place: Id; end: string }; b: { place: Id; end: string };
  hours: number /* Book 10 section 14, "Network" */; waterCrossing: boolean;
  conditions?: Condition[] /* season, spate, snow, flood, cold snap, block cleared */ }
interface Block { id: Id; on: { leg: Id } | { place: Id }; kind: 'LANDSLIDE'|'SPATE'|'SNOW'|'FLOOD'|'LEAVE'|'SEASON';
  clearedBy: Condition[][] /* any one way */; clearedFact: string; reasonKey: string; detour?: Id[] }
type JourneyStep =
  | { kind: 'ROAD'; leg: Id; minutes: number; modifiers: JourneyModifier[] }   // off screen
  | { kind: 'ROUTE'; place: Id; from: string; to: string }                     // crossed on foot
  | { kind: 'ARRIVE'; place: Id; end: string };
type JourneyModifier = 'NIGHT'|'CATTLE'|'CARGO'|'KNOWN_ROAD'|'KELPIE_BRIDLE'|'DETOUR';
interface JourneyPlan { from: Id; to: Id; steps: JourneyStep[]; offScreenMinutes: number; routesToCross: Id[] }
interface JourneyState { plan: JourneyPlan; step: number; leg?: { departed: number; arrives: number; elapsed: number };
  party: Id[]; cattle: number; cargo: CargoLot[] }
interface MainlandPlaceState { known: boolean; visited: boolean; poisFound: Id[]; secretsFound: Id[];
  route?: { cleared: boolean; waymarked: boolean; heldBy?: Id /* FAC_ */; shortcutsFound: Id[];
    waystation?: Id /* BLD_ */; crossings: number } }
interface RegionState { discoveredZones: Id[]; places: Record<Id, MainlandPlaceState>; blocksCleared: Id[];
  resourceNodes: Record<Id, ResourceNodeState>; puzzles: Record<Id, string>; bodies: Id[] }
```
- **One map for everyone.** The mainland is one region with `MAIN_` IDs (Book 4; plans in Book 9), the same in every campaign. It has two kinds of playable place: **sites**, destinations explored in full on foot (villages, forts, the monastery, farms, dungeons, the bog village, the mountain), and **wilderness routes**, long playable places *between* sites (the Black Wood path, the plank road, the High Pass, the Ridge Road, the river path and the Ford, the moor road). It holds both home sites. Glen Arra, Inis Rón and Crowwick stay separate places across the sea, each with its own small region.
- **Road legs** join sites and route ends. They are never walked on screen: a leg costs game time (Book 10 section 14, "Network") and is run through the world step (section 25), so the world goes on exactly as if the time had passed in play.
- **A journey is a chain** of road legs, routes and arrivals, for example Ardcarn, two hours on the road (off screen), the Black Wood path (crossed on foot), one hour on the road (off screen), Móin Mhór. **Whenever a journey passes through a route, the player crosses it on foot, in game**: no road leg skips a route, and the planner can only chain legs through route ends. Inland places can be reached only through the routes.
- **The travel map** (`Planning` mode, safe rule) plans a journey: it shows the whole chain before the player sets out, with each road leg's time after its modifiers, the routes to cross, camp spots and waystations, blocks with their reasons in words, and routes held by a hostile faction. Coastal sites (Carrick, Kilbrecc, Dún Fiach's landing, the salt pans, Saltvik, Saltness) can also be reached by the ship, the fast way along the coast, on the sea map with its own risks (section 09); the travel map offers it when the ship is at hand. Once the household is warned of a fixed night at home (section 16), the travel map refuses a journey whose return could not reach home before dusk on that day, and says why in words.
- **Journey modifiers** multiply a leg's time (Book 10 section 14, "Journey modifiers"): night (and riskier), driving cattle or carrying cargo, a known road, the kelpie bridle on a water crossing. Blocks (landslide, spate, snow, flood) force a detour or close the way; a blocked leg or route shows its reason in words. A block is a fact with one or more ways to clear it: a work party at the site (a designation with worker-days, built like a homestead building), an alliance, an item, the right words, a season window or a cold snap.
- **Journey events.** A road leg can be interrupted by a short playable scene (a scenario, `SCN_`, of section 11): travellers, bandits, wolves, weather, a wounded stranger, or a discovery ("smoke in the hills" adds a new point of interest). The chance comes from Book 10 section 14 ("Journey modifiers", `journeyEvent`), drawn on the `encounters` stream and filtered by season, time, faction state and cargo; most legs are quiet. The leg stops where the event happens, hands off to `OnFoot` in the event's scene, and resumes with the time left when the scene ends. Living-world travellers and bandits really on that leg (section 25) meet the player as themselves.
- **Routes are crossed on foot.** A route is a long scene with a clear main path, side paths, pockets, camp spots and at least one shortcut to find; its direct crossing takes the game time Book 10 section 14 gives ("Network"), and exploring off it takes longer. Time runs at the normal rate. Each crossing differs by time of day, weather, season and the living world: on entry the route draws its wandering people, wildlife and any hostile encounter on the `encounters` stream at the Book 10 section 14 "Route encounters" rates, modified by season, faction state, cargo carried and whether the household has cleared the route. Cargo and cattle slow the crossing and draw raiders; companions cross with the steerer.
- **Ambushes are readable.** Every route ambush declares its signs like any danger (section 17): a fallen tree across the path, crows rising ahead, a stretch gone too quiet, fresh tracks. The signs show at the distance Book 10 section 14 gives ("Route encounters", `ambushSign`) before the ambush can strike; keen-eyed companions see them sooner (section 06).
- **Route state.** A route can be made better: its shortcuts found (`shortcutsFound`, shortening later crossings), cleared of the outlaws who use it (`cleared`, lowering its hostile encounters), waymarked (`waymarked`), its ford bridged (a block cleared), and given a **waystation** at its waystation spot, a safe camp with a small store built as a designation (`BLD_`, Book 10 section 15, "Waystations"). A route held by a hostile faction (`heldBy`) stays open but dangerous: its patrols and toll posts follow that faction's hostility (territory, above).
- **Points of interest.** Every site has one or two major points of interest and every route one (a village, dungeon, ruin, shrine or camp with people and quests), and each has several minor ones (a cairn, a wreck, a carved stone, a hermit's hut, a hidden cache, a viewpoint, an eagle's nest, a herb patch, a grave, a burned farm). The best minor rewards lie off the obvious paths (`offPath`), behind a climb, a wade, a hazard or a puzzle (`guardedBy`). Book 9 places them in every plan; content lint checks that every site and route has its major point of interest and its minor ones.
- **Secret entrances.** At least four routes hide a secret entrance (`secretEntrances`) to a small dungeon of lore and equipment (Book 4 section 03; Book 6 section 13). An entrance has no marker until found: it is found by exploring, helped by its hint signs, each placed so it is seen from somewhere on the approach (`seenFrom`), and by rumours from travellers and minor characters, about one in three of them deliberately wrong (Book 10 section 20, "Secret entrances"). A keen-eyed companion within the Book 10 distance remarks on the entrance (section 06). Finding it writes its `foundFact` and adds it to `secretsFound`; entering it hands off to its dungeon's scene like a site's branch. The reachability test proves each entrance can be found and entered under its conditions, and that every hint and every true rumour points at it.
- **Shortest journeys** are a pure function of the network: the least game time between every pair of sites over road legs and the direct crossing times of routes, with no modifiers and every block cleared (and again under each season's closures). A unit test checks them against Book 10 section 14, "Shortest journeys", so the network and the table never drift apart.
- **Seasons** change each site and route through its `seasonal` effects and the legs' conditions, driven by the calendar and the weather.
- **How it opens.** From Chapter 3 the coastal sites have landings on the sea map; inland places open as they are discovered (walking there, a chart, testimony, a view from a height, a journey event) and as blocks are cleared.

### Water depth bands
- Every water tile has a bed height, from the height field baked with the zone (`src/content/terrain/`, so the simulation may read it); its **depth band** (`WET, ANKLE, KNEE, WAIST, DEEP`) is the still water level (the calendar's tide, spate, flood or freeze; never the drawn swash, which is visual only) over the bed, computed from the calendar and weather (Book 10 section 02, "Water depth bands"; decision S6R-3). It is never stored per frame, and what is drawn always agrees with it.
- **Who reads it:** movement (each band's speed), stamina (waist-deep wading and swimming drain, section 24), combat (waist deep, carrying and fighting are harder by the Book 10 band modifiers), AI and pathing (band costs; deep water is collision unless the scene allows swimming and the actor can swim), hearing (wading and splashing are louder), evidence (tracks do not hold in water), render (the band's mask, the waterline, ripples, splashes and wet sprites, Book 7 sections 07 and 14) and audio (water footsteps).
- **Deep water** allows swimming only where the scene marks it; the kelpie bridle's water-horse crosses where its rules allow.
- **Masking** is presentation: the actor view carries the band and the waterline, and the renderer hides the sprite below it by the band's mask height (Book 10 section 02).

### Movement verbs and hazards
- On foot the steerer can walk, run, sneak, carry, climb marked routes, wade, swim where allowed, jump short gaps, crawl through gaps, push and pull heavy objects, and ride the water-horse where the kelpie bridle allows. Each verb is a movement state with its Book 10 section 02 speed and its own collision rules; climbing, swimming, waist-deep wading, running and heavy carrying drain stamina (section 24).
- **Hazards** are state machines over world conditions and declare `sign, rule, response, consequence` like any dangerous mechanic (section 17): bog holes (slow, then sink unless pulled out), spate rivers (swept downstream), cliffs and scree (falls), cold at night (the cold reason of section 24), fog (sight and getting turned round), wolves, boar, outlaw ambushes and roadblocks, landslides after rain, lightning on high ground and the hill-folk's rules. Numbers are in Book 10 section 15. Every hazard shows its sign before it can hurt.

### Camping and companions
```ts
interface CampState { place: Id; spot?: Id /* a route's camp spot */; waystation?: Id; pos: Vec2; day: number;
  fire: boolean; sheltered: boolean; watch?: Id }
```
- **Camping:** if night falls away from home, the steerer camps at a site, at a route's camp spot or at a waystation. The `CAMP` command needs a bedroll and a fire's makings (a waystation provides both), a place that is not hostile, and the safe rule. A camp ends the day (to 06:00, section 03), heals by the Book 10 section 15 amount, and **saves if safe** (section 20). Its risk (wolves, outlaws, cold) comes from the place and season on the `encounters` stream and falls with a good fire, a companion on watch and a sheltered spot; a waystation is safer still (Book 10 section 15, "Waystations"). An attack wakes the steerer into `OnFoot` at the camp, with no save.
- **Companions on foot:** up to two friendly characters (Book 10 section 15) go with the steerer on any expedition on foot, in `party.companions`, and cross every route with them. They follow, comment from their topics, react through their traits, help with puzzles and hazards (pulling the steerer out of a bog hole, carrying, tasks), fight under the crew commands of section 12, and can be wounded and downed. Some quests need a particular companion (Book 6). While away they are out of the home's work and in their own condition (hunger, cold, wounds).

## 11 / Local scenes, raids, attacks and defences
*A raid, an attack or a defence is data: a scene, a true state, intel, complications, extraction and outcome bands. Every raid is a stealth raid or an all-out assault; attacks by land and from the sea, and defences, use the same assault rules.*

```ts
interface ScenarioDef { id: Id; kind: 'RAID'|'LAND_ATTACK'|'SEA_ATTACK'|'DEFENCE'|'JOURNEY_EVENT'|'OTHER';
  sceneId: Id; placeId: Id; trueState: TrueStateDef; gate?: Id /* a story gate (section 16); optional otherwise */;
  modes: ('STEALTH'|'ASSAULT')[]; assault?: AssaultDef; defence?: DefenceDef;
  safePlaces: Id[] /* where a carried downed ally is safe: the boat, the village, a safe camp or waystation (section 12) */;
  intel: IntelItem[]; approaches: ApproachDef[]; complications: ComplicationRule[];
  maxComplications: 1|2; extraction: ExtractionDef; bands: OutcomeBandDef[]; leads: Id[] }
interface AssaultDef { landing: Id /* a landing from the ships, or the muster point a land march arrives at */;
  approach: 'SEA'|'LAND'; allies: Id[]; muster: MusterWave[]; objectives: AssaultObjective[] }
interface DefenceDef { home: Id; watch: Id[]; warning: 'NONE'|'HORN'|'BEACON'|'SCOUT'; preparations: Id[] /* walls, traps, stakes, archers' platforms: designations */;
  attackers: MusterWave[] /* the time to prepare is the warning the threat gives, Book 10 section 11 */ }
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
- Carrying occupies both hands, sets speed to carry speed and disables attacks (shove remains). Carrying a downed ally uses the carry gait and speed of Book 10 section 06, "Downed and carried" (section 12).
- **Civilians** in scenes have behaviours (flee, hide, plead, fight with tools, surrender) and can be killed; their deaths are deeds with witnesses and evidence.
- Outcome bands are computed from facts. The post-raid summary reports haul, casualties, deeds and likely consequences in plain sentences.

### Assaults
- A scenario lists the modes it allows; fortified places, Crowwick and Orm's outposts allow only `ASSAULT`. Carrick allows both: a stealth raid by night or an assault by day.
- In an assault the full crew lands by day. Defenders **muster over time**: each wave starts where its people really are and comes when its trigger fires (a horn heard, a runner arriving, a beacon seen), so alarm still spreads only by the channels of section 13. Archers take positions; battles run 10 to 30 a side (Book 10 section 18).
- **Objectives** (break the gate, fire the thatch, seize the store, take or kill the leader, hold the landing) are facts that the outcome bands read.
- **Consequences** are heavier and more public: assault deeds carry `context.assault`, every defender who sees the fight is a witness, and the answer scheduler uses the assault timings of Book 10 section 18 (precursors still come first, section 15). The Glory-minded value it by the ordinary deed deltas.

### Attacks by land and sea, and defences
- **Raids** come by sea: a stealth raid or an all-out assault (above).
- **Attacks by land:** once the household is on the mainland it can march overland, with the household and its allies, as a journey (section 10), and assault a camp, farm or fort (`approach: 'LAND'`). The march's road legs and routes are crossed like any journey, with the war band as the party; the assault begins at the muster point it arrives at, with the same formations, muster waves and objectives as a raid assault.
- **Sea-borne attacks:** landing in force from the ships on a coastal settlement (`approach: 'SEA'`), including mainland coastal places (Carrick, Kilbrecc, Saltvik's outer harbour, Crowwick, Orm's outposts), by the assault rules above.
- **Defences** of the homestead and the mainland home run in four phases: the **watch** (who stands it, section 07), the **warning** (a horn, a beacon, a scout, or none), **preparation** in the time the warning buys (walls, traps, stakes and archers on platforms, built as designations, section 07) and then the **battle**, with the attackers mustering by the waves of their `DefenceDef`. A defence while the steerer is away is resolved by the away simulation (section 07).
- Each of these is a **gate** when it is a story event (section 16), and optional otherwise.

## 12 / Combat
*Tick-based, real-time melee with readable tells, committed actions and no pause. All numbers come from Book 10 sections 06 and 07.*

### States
`idle, move, light1, light2, light3, chargeL0, chargeL1, chargeL2, heavyRelease, recovery, parry, parryRecovery, riposte, block, blockStun, guardBroken, dodge, shove, draw, loose, stagger, carry, downed, surrendered, dead`; combat v2 adds `lunge, parried, backstab, flinch, knockdown, getUp, sidestep, heal` and the exhausted flag (decisions DE-1 to DE-10); design addendum 2.5 adds `parryWindup` (the parry's wind-up before its active `parry` ticks), `blockRaise` and `dodgeRecovery` (decisions DF-1 to DF-6). Transitions follow input or AI commands and frame data; no state skips its recovery, and nothing cancels into anything else (design addendum 2.5).

### Combat v2
Design addendum 2.4 makes fights weighty and deliberate (Book 1 section 09): few hits, and every hit matters. Until combat v2 is built the rules below marked v1 hold; from then the v2 rules replace them, reading Book 10 section 06's v2 tables (decision DE-13).
```ts
interface Stance { facing: number /* radians, continuous */; lockOn?: Id; sneaking: boolean }
interface FightV2 { poise: number; poiseRegenAt: number; hitstop: number /* ticks left */;
  exhausted: boolean; awareness: Record<Id, { level: number /* 0..100 */; state: 'UNAWARE'|'SUSPICIOUS'|'ALERT' }> }
type DamageType = 'CUT'|'THRUST'|'BLOW';
```
- **The combat stance.** A melee weapon, shield or bow in hand puts the steerer in the stance: the facing is continuous and turns towards the aim vector (the cursor, the right stick or the locked target) at Book 10's `turnRate`; movement is at `forward`, `strafe` or `backOff` speed by its angle to the facing; running turns the body to the way of travel. The body is drawn in the nearest of the four facings; strike arcs, shields and backs use the true facing. The aim is still a quantised command (section 21), so replays are exact.
- **Lock-on** (`LOCK_ON` command): takes the nearest enemy in front within `lockOnRange`, switches clockwise on another press and releases by Book 10's rules; while locked, the facing is the target's bearing.
- **Attacks commit:** (combat v2, superseded by design addendum 2.5 below) the facing turns at most `attackTurn` during a windup and not at all from the active ticks to the end of recovery; only a light attack's first `dodgeCancel` ticks can become a dodge; a swing that meets no one adds `missRecovery`.
- **Reach and spacing:** every weapon and every enemy has a reach (Book 10 section 06, "Weapon movesets"; section 07, Archetypes); a strike meets bodies inside its weapon's hitbox (Book 10 "Hitboxes": a swing within its reach in its arc; a spear's thrust a line along the shaft, held right of the facing line; the user's fourth playtest, decision DH-76), and every weapon layer's active frames are drawn to that reach in every facing (tests/unit/hitboxes.test.ts). The weapon rules (axe hook, spear edge and inside, Dane axe guard break and split, seax guard, mail by damage type) are applied by the simulation from Book 10's "Weapon rules".
- **Lunge:** an attack pressed while running at the faced direction, or at a locked target beyond reach, becomes a `lunge` with Book 10's distance, tell, stamina and recovery.
- **Parry and riposte:** a parry inside the window puts both fighters in hitstop (`parryHitstop`) and the attacker in `parried` for `parryOpen`; a riposte started then is uninterruptible, cannot be blocked, ignores poise and deals `riposteDamage`.
- **Poise:** each fighter has poise by build and armour; a hit wears it by the weapon's poise damage; at zero the fighter staggers, and a big enough hit knocks down. A hit that does not break poise flinches without interrupting (Book 10, "Poise").
- **Guard:** a block costs `blockCost`; a guard break opens the blocker for Book 10's time; a shield breaks by `shieldBreaks`.
- **Hitstop** is simulation: on contact both fighters' state machines pause for the Book 10 ticks while the rest of the world runs, so it replays identically. Knockback, flash, shake and the spray are presentation, from the hit event.
- **Stamina:** regeneration waits Book 10's ticks; at zero a fighter is exhausted until it recovers to the threshold (what exhaustion stops is design addendum 2.5's, below).
- **Healing:** binding a wound or eating is `heal`, a short committed action using a carried binding or ration (section 24); a hit, a dodge, a block, a run or a step ends it and the item is lost.
- **Sneak attacks:** a melee strike from behind on an actor that is unaware of the striker (or suspicious and not facing it) is a `backstab` (Book 10 section 07, "Sneak attacks"); a missile into an unaware actor does extra damage.
- **The steerer gets the same treatment** as every fighter: hitstop, flinch, knockback, stagger and knockdown.

### Combat by design addendum 2.5
Methodical, weighty and committed (Book 1 section 09; decisions DF-1 to DF-10). These rules replace the combat v2 rules above where they differ; Book 10 section 06's tables from "Commitment" to "Dodge" and section 07's from "AI states" to "Archers" hold the numbers, and the Book 10 rows they replace stay, marked, until this is built (decision DF-19).
```ts
type Phase = 'WINDUP' | 'ACTIVE' | 'RECOVERY';
interface ActionClock { action: Id /* the move, e.g. SEAX_LIGHT_2, PARRY, BLOCK_RAISE, DODGE */; phase: Phase;
  since: number /* tick the phase began */; ends: number; met: boolean /* the active ticks met someone */; queued?: Id /* a light in its chain window */ }
interface Motion { vel: Vec2 /* logical px per tick, eased */; want: Vec2 }
type FightState = 'IDLE'|'APPROACH'|'CIRCLE'|'WAIT_FOR_OPENING'|'ATTACK'|'RETREAT'|'RECOVER_STAMINA'|'FLEE_OR_SURRENDER';
interface FighterMind { state: FightState; since: number; nextDecision: number; dir: 1 | -1 /* circling */; patienceUntil: number }
```
- **Locked-on aim.** While locked on, every attack (light, heavy, lunge, riposte, shove, thrown spear and the bow's draw) is aimed at the locked target: the facing is set towards it at the press and then held by the action's lock. Without lock-on it is aimed at the cursor or the right stick (decision DF-81).
- **Commitment.** Every action runs an `ActionClock` through wind-up, active and recovery ticks from Book 10's "Frame data" (attacks), "Enemy attacks" (an enemy's, with the telegraph floors), "Parry", "Block" and "Dodge". From the first wind-up tick to the last recovery tick the fighter cannot move, turn, dodge, block, parry or start another action; commands for them are refused silently (no word, no caption). There are no cancels of any kind: `dodgeCancel` is gone. A light pressed in its chain window is `queued` and starts when the recovery ends. The facing is fixed at the first wind-up tick, also while locked on.
- **A missed attack is punished.** If an attack's active ticks meet no one, its miss recovery is added (`met` is false). A hit on a fighter in a miss recovery, a mistimed parry's recovery, a dodge's recovery or a broken guard is a punish (Book 10 "Commitment", `punish`).
- **Grounded movement.** Each actor's velocity eases towards the wanted velocity by Book 10's "Movement and acceleration" ticks (longer in mail and for the heavy build), so nothing starts or stops instantly and a reversal slows through a stop. The first wind-up tick of a melee attack, a charge included, sets the velocity to zero; the only ground an attack covers is its fixed step, spread evenly over its active ticks, and a lunge's strides over its wind-up. The animation's planted foot matches the step (Book 7 section 01): no slide or drift.
- **Exhausted.** Any cost that takes stamina to 0 sets `exhausted`: no attack, parry, shove, dodge, block or run, and half speed, until stamina is back to Book 10's `exhaustedUntil`; regeneration waits `exhaustedRegenDelay` and runs at the exhausted rate. An action that costs stamina starts only with stamina above 0. The same rule holds for every fighter but the dead.
- **Predictive parry.** A parry press starts `parryWindup`; its active ticks follow, then its recovery. A blow is parried only if its first active tick that would meet the parrier falls inside the parrier's active ticks and arc (the overlap rule); a blow that lands in the parry's wind-up or recovery hits. A parry stuns the attacker (`parried`, Book 10 `parryOpen`) after the hitstop, and the parrier's remaining ticks become `parrySettle`; a parry that meets nothing plays its full recovery, open to a punish.
- **Block.** Raising the shield takes `blockRaise` ticks before the guard is live; while raised, speed is halved. Each blocked hit drains Book 10's `blockDrain` (by the blow's vs-shield damage); a hit that empties the bar is a guard break with `guardBreakEmpty`'s stagger, after which the blocker is exhausted.
- **Dodge.** A dodge is a start, a dash with invulnerable ticks in its middle, and a long recovery with the feet planted, for a large stamina cost (Book 10 "Dodge").
- **Read by sight and sound only.** The simulation emits each attack's `TELEGRAPH` event at its wind-up's start, its flash tick and its weight; the render draws the draw-back and the one-frame flash, and the audio plays the tell's sound (Book 7 section 12; Book 11 section 07). No caption, number, word or log reports a hit, a block, a parry, damage or a fighter's state (section 18); the awareness marks are off by default (section 21). The input prompts of the user's third playtest (section 18) are the one exception, and they never report anything.
- **AI runs on the state machine** of section 13, with the same commitment, movement, exhaustion, parry, block and dodge rules as the steerer; only the telegraph floors are the enemies' alone.

### Finishing, sparing and the teaching foes (the user's third playtest)
Decisions DG-2 to DG-10; Book 10 section 06 ("Finishing a beaten foe", "Finishers") and section 07 ("First sight", "Teaching foes") hold the numbers.
```ts
type BeatenState = 'REELING' | 'DOWNED' | 'BEGGING';            // a beaten stagger is held as REELING for Book 10's reel
interface FinishOffer { foe: Id; state: BeatenState; since: number /* tick */ }   // while the steerer is within offerReach
type FinisherVariant = 'STANDING' | 'LYING';                     // by the foe's pose; the row by the steerer's weapon
interface TeachingRule { person: Id; lesson: 'PARRY' | 'RED'; opening: 'PARRIED' | 'RED_RECOVERY' }
```
- **The choice.** A foe is beaten when it is downed, begging (pleading or surrendered), or staggered at or below Book 10's `beatenBelow`, which turns the stagger into a reel for `reel` ticks. While the steerer is within `offerReach` of a beaten foe, in its strike arc and not in an action, the simulation offers the choice (`FinishOffer`, a view the interface draws as the finish-or-let-go prompt). The `FINISH` command is the finisher action held for `finisherHold` (the hold is a choosing: no stamina, no lock, ended by a hit); the `SPARE` command is the let-go action pressed once.
- **The finisher** is an action under "Commitment": its row in Book 10's "Finishers" (by the steerer's weapon; unarmed, the foe's own weapon, taken up) and variant (`STANDING` for a reeling or kneeling foe, `LYING` for a downed or prone one) gives its wind-up, active and recovery ticks, its step and its hitstop, which holds both bodies. It kills with no damage roll; dismemberment and gore follow section 12's gore rule. It writes `SURRENDERED_KILLED` on a downed or begging foe and `KILLING` on a reeling one. Other foes may strike the steerer while it plays. It is one quick blow: no event, sound or picture lingers on it, slows time or moves the camera beyond its shake (Book 7 section 12; Book 1's ban on player torture).
- **The spare.** `SPARE` emits `STEERER_SHOUTED` (the line, chosen on the presentation's own stream so the simulation stays deterministic: the line is not state) and, `spareReply` later, `SPARED_REPLY`; the foe drops its weapon (a pickup), gets up and runs a planned way out of the steerer's sight (Book 10 "Running off": round walls and water, never nearer the steerer), and is gone from the zone there, never to rejoin the fight (decision DH-75); its group's cohesion takes `allySpared`. It writes `SPARED` with `context.how` (`REELING`, `DOWNED`, `BEGGING`) and a `SparedRecord` (section 15). A surrender still left alive when a fight ends writes `SPARED` with `context.how = 'LEFT'` and its record too.
- **First sight.** See section 13: the line comes before any attack, and the speaker's group holds its attacks for Book 10's pause.
- **Teaching foes.** A fighter with a `TeachingRule` (Svart: `PARRY`; Ketill: `RED`; content, Chapter 1 only) takes no harm outside its opening: every blow, missile, shove and backstab that reaches it is turned (`GUARD_TURNED`, hitstopBlock, no stamina or poise cost, nothing breaks it), and an unaware one turns and is alert. Svart's opening is `parried` (a parry of any of his attacks); Ketill's is the recovery and miss recovery of his red blow, which is his only attack, and which a block cannot stop (it lands and breaks the guard with `guardBreakEmpty`) and a parry cannot meet (it lands as a punish). The red blow emits `TELEGRAPH` with `red: true`, which the render draws as the red glint and the audio as the scrape (Book 7 section 12; Book 11 section 07). When the lesson is done once (`lessons`, section 05), its prompt stops.

### Rules
- **Facing (v1):** four directions. Attacks, parries and shields commit to the current facing; turning is locked during windup and active frames. Combat v2 replaces this with the stance (above).
- **Light attacks** chain up to the weapon's combo length if the next input lands in the chain window.
- **Charged heavy:** holding attack enters `chargeL0`, reaching L1 and L2 at the Book 10 thresholds with distinct visual and audio tells; release attacks; L2 is a guard-break that cannot be blocked but can be parried or dodged. Movement is slowed while charging; maximum hold auto-releases.
- **Parry:** a timed press with a startup and an active window; success staggers the attacker and opens a riposte; failure leaves a recovery. Shields can parry and block; two-handed weapons parry only.
- **Block** covers the frontal arc, costs stamina on hit and becomes `guardBroken` when stamina empties.
- **Dodge** grants invulnerability frames; **shove** breaks blocks.
- **Vitality and armour** reduce by damage type; wounds result after a fight by severity.
- **Gore:** hits spawn blood particles and decals; bloodied overlays below half vitality; killing blows from heavy cutting weapons roll for dismemberment (`gore` stream). Corpses persist for the scene; at home they persist until buried or burned. A gore setting (off, low, full) changes presentation only, never simulation.
- **The steerer** at zero vitality dies and the game ends, unless *Second wind* is enabled (a short downed window in which an adjacent ally can lift them once per scene). Game over offers reload of the latest autosave or checkpoint. The game is over at the killing blow's tick (`gameOver`, with `from`, the blow's way); the presentation then plays the collapse (Book 10 "The steerer's death": the knees, the fall by the way of the blow, every sound dropping away, a still beat) before the game-over screen and its sting, and the screen's keys wait for it (decision DH-71).
- **Downed, not dead.** Crew, companions and allies at zero vitality are `downed`: they lie where they fell and do not bleed out; there is no timer. A downed ally carried to one of the scene's `safePlaces` (the boat, the village, or on a journey a safe camp or waystation, section 11) before the scene ends lives, with the wound of Book 10 section 06, "Downed and carried".
- **Carrying a downed ally** puts the carrier in `carry`: carry speed, both hands full, no attacks, parries or blocks (shove remains). Heavy residents carry faster but tire sooner when running (Book 10 section 24). Allies can be ordered to `CARRY(person)` (crew commands, below).
- **Left behind.** At the end of a scene, each downed ally not in a safe place is captured or killed according to the enemy holding the ground: enemies who take captives capture (the person becomes `captive` at a place, to be rescued or ransomed later), the rest kill (Book 10 section 06, "Downed and carried", `leftBehind`). Captives are people, never currency (section 26).
- **The downed are not finished off** by enemies. The exceptions are berserkers and the named cruel enemies whose content says so (`finishesDowned`), and they give a visible and audible warning first (a raised weapon, a shout, and an information caption) for the Book 10 time (`finishWarning`), so the player can intervene.
- **Berserk.** A person with the berserk trait (section 06), when wounded or when a friend falls, may go berserk on the `combat` stream for the Book 10 section 08 time ("Traits"): they ignore crew commands, attack the nearest enemy wildly (the surrendering, and farmers in reach, included), deal more damage and defend less. Their deeds are household deeds (`doer: 'HOUSEHOLD'`, `context.berserk` naming them) and count against the household like any other.
- **Rán's mercy** prevents every unscripted death of the crew and household: what would kill them (left behind with killers, a berserker's or cruel enemy's finishing blow, a hazard) becomes a grave wound, or capture where the enemy takes captives. **Scripted deaths** (section 16) still happen.
- **Finishing blows:** the player can kill beaten foes (downed, begging, or reeling from a beaten stagger) with a held finisher input, or let them go with the let-go input (above, "Finishing, sparing and the teaching foes"). Either records a deed.
- **Poise and the heavy build (v1):** a heavy fighter (section 19) has poise: light attacks do not stagger them (combat v2: section 12's poise, by build). Their wind-ups are slower, their hits heavier and their run a little slower, by Book 10 section 24. They reward the charged heavy attack, the parry and the dodge.

- **In water:** waist deep, attacks, dodges and carrying are harder by the Book 10 section 02 band modifiers.
- **Aim:** melee attacks commit to the four-way facing nearest the aim vector (v1), or to the stance's facing (combat v2); bows and thrown spears fire along the aim vector itself, which is part of the command, so replays stay deterministic.
- **Unarmed:** with no weapon selected (the steerer at the start, section 21), the use action does nothing; shove and dodge still work.

### Missiles
```ts
interface Projectile { id: Id; kind: 'ARROW'|'SPEAR'; item: Id /* ITEM_: the arrow or spear */; head?: 'BONE'|'IRON';
  shooter: Id; spawnTick: number; from: Vec2; aim: AimVector; pos: Vec2; height: number /* tiles above the ground */;
  vel: Vec2; range: number /* tiles: where it was aimed, or the weapon's full reach */;
  state: 'FLYING'|'STUCK'|'BROKEN'|'LOST';
  stuck?: { in: 'GROUND'|'WOOD'|'STONE'|'SHIELD'|'BODY'; target?: Id; offset: Vec2; angle: number };
  recoverable: boolean; until?: number /* tick it is cleared, Book 10 section 21 */ }
```
- **Loosed standing still, by everyone.** Drawing a bow or raising a spear to throw puts the actor in `draw`, which plants the feet: movement commands are ignored until the shot is loosed or cancelled (right-click, Escape or pad B), and the aim vector alone turns the body. Released before `minDraw`, the draw is cancelled and nothing is spent. The same rule holds for the steerer, the crew and enemies (section 13), and there is no walking draw.
- **Arrows are spent.** Loosing takes one arrow from the shooter's count (section 24); with none, the bow cannot be drawn and the refusal word says so ("No arrows").
- **A visible, deterministic flight.** A loosed missile is a `Projectile` in `onFoot.projectiles`, stepped every tick in the simulation: it flies along its aim at the Book 10 speed, with its spread drawn on the `combat` stream, rises and falls on a shallow arc whose height is part of its state, and lands where it was aimed or flies on to its full range and falls. It hits the first person, shield or cover in its path at its height, and it can miss: **its whole path since the last tick is swept** against every body, shield and piece of cover, so it hits whatever it touches first, whatever the combat state, before, during and after a fight, and never passes through anyone however fast it flies (decision DE-10). An aware actor who sees the shooter may sidestep (`sidestep`, Book 10 section 07, `awareDodge`), drawn on the `combat` stream, with a tell; an unaware one cannot. a shield held up in front stops it, and solid cover stops it below its height (Book 10 section 21, "Missiles"). The render reads each `Projectile` (position, height, direction, state) to draw the missile rotated along its flight, its shadow and whatever is stuck; it never changes one.
- **Sticking, breaking and recovery.** A missile that hits stays where it hit, `STUCK` in the ground, timber, a shield or a body, until the Book 10 time or until the zone is left, the oldest going first past the cap. Whether it is whole (`recoverable`) or `BROKEN` is drawn on the `loot` stream when it hits, by the Book 10 chance for what it hit; into water it is `LOST`. A whole arrow can be picked up (interact) back into the count; arrows in bodies are recovered after the fight.
- Damage, reach and draw time come from Book 10 section 06; speeds, arc, spread, blocking and recovery from Book 10 section 21. `onFoot.projectiles` arrives with its own world-state version step (section 05).

### Crew commands and formations
`FOLLOW, HOLD(point), ATTACK(target), PROTECT(person), CARRY(lot|person), WITHDRAW(extraction), SHIELD_WALL(line), CHARGE(target), VOLLEY(area), FALL_BACK(ships)` on quick keys and a command ring that does not stop time. Each is acknowledged with a bark and an icon. A person gone berserk ignores them until the fit passes. Allies never block a `keepClear` tile for more than a second.
- **Shield wall:** members lock into the slots of a line; the line has a wide front arc, moves slowly and is strong against missiles (Book 10 section 18). A fallen member's slot is filled from behind; a line with a gap it cannot fill, or whose cohesion breaks (section 13), falls apart.
- **Charge:** the group runs at its target and, on contact, delivers a cohesion shock to the group it hits.
- **Volley:** the group's archers loose together at an area on one command; shields up reduces it.
- **Fall back:** the group withdraws towards the ships in order, the wall facing the enemy, and boards as in an extraction.
- Enemy groups use the same formations and commands, chosen by their AI.

## 13 / AI
*Enemies, civilians, allies and wildlife see, hear, remember and communicate through real channels. Ranges are in tiles (Book 10 section 07).*

- **Sight:** a 110 degree cone with range by light (day, dusk, night outside light), halved in fog, shortened in rain, increased from height; blocked by solid tiles and closed doors; dunes, scrub and tall grass hide sneaking actors, and shadow halves the range on them (Book 10 section 07).
- **Awareness** (combat v2, decision DE-9): each actor keeps a level for each actor it might see or hear, filled by sight (faster when near) and by noise, and decaying when nothing is seen or heard; it moves from `UNAWARE` to `SUSPICIOUS` (a bark, turning and going to look) to `ALERT` at Book 10's thresholds. The state is shown by barks and body language; the "?" and "!" marks are an option, off by default (design addendum 2.5; Book 7 section 10).
- **Hearing:** noise by action and surface (sneak, walk, run, combat, shout, horn, dog bark) in tiles.
- **Memory:** last known position per target, decaying after the Book 10 time.
- **Alarm** spreads only by sight, shouts, horns, dogs and runners who physically travel.
- **Behaviour selection:** utility scoring over `GUARD, PATROL, INVESTIGATE, RAISE_ALARM, FIGHT, HOLD_LINE, FLANK, PROTECT, FLEE, HIDE, PLEAD, SURRENDER, LOOT, CARRY, WORK, SLEEP`, and with combat v2 `WARN, HOLD_OFF, CIRCLE, RETREAT`, evaluated at 10 Hz from the `ai` stream. Once `FIGHT` is chosen, the fighter is driven by the state machine below.
- **The fight state machine** (design addendum 2.5 section 1.5; decision DF-7): each fighter is in one `FightState` (section 12): idle, approach, circle, wait for opening, attack, retreat, recover stamina, and flee or surrender. It chooses only every Book 10 `decisionInterval` (each fighter offset on the `ai` stream so a group never decides in step), holds each state at least its least time (a cooldown) unless it is staggered, knocked down or its target falls, and keeps its archetype's distances (Book 10 section 07, "AI states", "AI decisions", "Distances by archetype"). Melee fighters circle at their circle radius, just outside their attack range or the reach they face, and **wait for an opening**: they step in only when the target is in a recovery, a broken guard, a stagger, exhausted, healing, drawing or turned away, and only if they can reach it and finish their wind-up before it ends, judged from the target's drawn state, never hidden numbers; or when their patience runs out. After every attack they retreat to their circle radius; below their recover-at share of stamina they back off and recover. They never swarm: the attack tokens still allow one or two in an attack at once. No fighter jitters: it turns its circling round at most once in Book 10's `turnAround` time and never steps back and forth within a decision.
- **Guarding and pursuit** (the user's fourth playtest; decisions DH-72, DH-73; Book 10 section 07, "Guarding and pursuit"). A band whose encounter names a `post` guards it: when its foe is further than `guardRadius` from the post it runs back (`GUARD_RETURNS`) and stands there, and comes out again only when the foe is within `guardResume` of the post or strikes it (struck, it chases for `guardChase` first). A band without one pursues to its leash and goes home the same way, held until the foe is within `pursuitResume`; a pursuer ahead of its band walks, then waits (`cohesionSpread`, `cohesionWait`), and the last one still pursuing breaks off when the rest have. Each side of a choice holds until its other limit, so no one walks back and forth at a line. Replaces the leash's bare go-home.
- **Target choice** (decision DH-74; Book 10 "Target choice"). At each look round an enemy scores every foe it sees, and any who struck its band within `threatMemory` (heard), by damage done to its band, a blow at itself (even turned), being the steerer, being in an attack on its band, nearness and weakness, with a bonus for the foe it has; it changes foe only for one scoring `threatSwitch` more. The blows are kept on the battle (`harm`).
- **Self-preservation** (combat v2, decision DE-6): fighters want to live. They hold off just outside the reach of the one they face, circle, step in to strike and out again, and sometimes feint; they wait further out from a longer weapon and crowd a seax; wounded, they grow cautious, guard more, back off and call for help, then fall back towards friends; in a group one or two press the attack (the attack tokens) while the rest circle, flank or hang back; they avoid deep water, cliff edges and fire, keep to their own ground and remember the steerer (Book 10 section 07, "Self-preservation"). Morale still breaks them into flight, pleading or surrender.
- **First sight** (the user's third playtest; decision DG-8, replacing combat v2's "warn first" as the general rule). The first time in an encounter an enemy turns `ALERT` to the steerer, before it starts any attack, it speaks a first-sight line (`FIRST_SIGHT` event: the speaker, `WARNING` or `TAUNT`, the line's key): a warning if it is alone, wounded or outnumbered, else a taunt or threat (Book 10 section 07, "First sight", by count and traits). One more of its group may add a line a moment later. Then the speaker's group starts no attack for the pause (`pauseWarning`, `pauseTaunt`) unless the steerer steps within reach or strikes; a blow landed in the pause lands as a punish. Lines come from the speaker's own pool or their voice's pool (Book 8 section 07), never one twice running and never one again until its pool has been used through; the choice is drawn on the `ai` stream so replays are exact. Beasts, the dead, berserkers and a sentry whose first act is the alarm have no line; an enemy struck while unaware has none.
- **Warnings** (combat v2, decision DE-11): scavengers, thieves and wary locals `WARN` before they fight, at Book 10's distances, the first-sight line being their first warning; walking closer or taking a weapon in hand starts the fight, walking away or a bargain ends it. Scavengers and thieves leave when the steerer's side is clearly stronger. Guards of a `HOSTILE` faction speak a threat and attack on sight.
- **Overheard talk** (decision DG-26). A group with an ambient exchange in content (the fold: Bran and the wreck-scavengers) plays it while none of them is aware of the steerer, by Book 10 section 07's "At the fold"; it is presentation of their idle state, shown as speech within `overhearRange`, and stops for good when any of them turns suspicious or alert.
- **Groups** hold narrow ground, flank when outnumbering by two, support allies, form shield walls, charge and volley (section 12), and break when cohesion drops below the Book 10 thresholds (sooner for the cowardly, later for the brave; a superstitious member panics at supernatural signs; Book 10 section 08, "Traits"). In a formation the group leader decides at 10 Hz and members steer to their slots, choosing their own behaviour only when in contact, so a battle of 30 a side stays within budget (section 22).
- **Muster:** defenders who hear a horn or meet a runner arm and gather at their muster point before moving, as the assault's waves say (section 11).
- **Archers and spear-throwers stop to shoot.** An actor with a bow or a spear to throw chooses a spot within its shooting range with a clear line of sight to the target (no cover, closed door or friend in the line), stops, stands completely still to settle and draw (Book 10 section 06, "Enemy attacks"), looses, recovers, then moves again; it never moves with a drawn bow (section 12, Missiles), and never draws without a clear line. A volley is the group's archers doing this together. If the target comes too close, the archer dashes away once, resets and re-evaluates; cornered (or too close again soon after), it draws its sidearm and fights in melee for the rest of the fight (Book 10 section 07, "Archers"). Out of arrows, an archer fights with its sidearm.
- **Travellers** use the same behaviours with their own needs (keep to the road, trade, rest, flee, hide, plead, fight back); bandits ambush from cover on roads (section 25).
- **The downed are left alone:** no AI chooses a downed actor as a target, except a berserker or a cruel enemy allowed to finish the downed, after its warning (section 12).
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
- **Each culture judges by its own code.** The same deed reads differently to the Norse, the Gaels, the Church, the Keepers and Saltvik: a witness's reaction is weighted first by their culture (Book 10 section 08, "Deed reactions by culture"), then by their values, traits and stance (section 06). Factions apply their culture's factor too. What people say about it (section 16) gives a period reason, never a modern one.
- **Deed tags added by design addendum 2.3 (Book 6 section 01):** `KILLING_HIDDEN`, a killing concealed (the body hidden, or the killing denied when asked) rather than declared; `HOSPITALITY_BROKEN`, harm to a host or guest, or under truce; `BLOOD_PRICE_PAID` and `BLOOD_PRICE_TAKEN`; `RITES_DENIED`, the dead left unburied or without rites; and `CHALLENGE_REFUSED`. The berserk deeds of section 12 are ordinary household deeds.
- **The spared remembered** (the user's third playtest; decisions DG-5 and DG-6). Every `SPARED` deed that lets a person go adds a record, and its fate is drawn then, hidden, on the `world` stream by Book 10 section 17 ("The spared remembered"):
```ts
interface SparedRecord { person: Id; deed: Id; day: number; placeId: Id; how: 'REELING'|'DOWNED'|'BEGGING'|'LEFT';
  begged: boolean; kinKilled: boolean; shamed: boolean; robbed: boolean;
  fate: 'FAVOUR'|'AMBUSH'|'GONE';                    // hidden truth: never shown, never read by the interface
  favour?: 'HELP'|'WARNING'|'GIFT'|'STAND_ASIDE'; due: number /* day */; precursorDay: number; paid: boolean }
```
  A due record arrives through the living world (section 25) like any delayed consequence: a precursor the steerer could hear of, then the ambush (with its sign first) or the favour, or nothing. The first unpaid favour when a worst moment comes is the grateful survivor (Book 4 section 12, twist 8), at most once a campaign. In Chapter 1 a spared wreck-scavenger plays the fate on the island first (Book 10 `chapter1`). A record is never removed; `paid` is set when its fate has played.
- **Answer scheduler** at season start and chapter open, with precursors at least five days before arrival. When the Chapter 5 answer is an attack on Skarvholm, the scheduler sets its fixed night and its warning (section 16; Book 10 section 22).
- **Anti-dominance:** the autoplay harness reports value per approach family per chapter; gates fail if one dominates every measure.

## 16 / Narrative, chapters, story gates and conversation
*Chapters move forward only through gates the player chooses to start; beats fire from facts; conversation reads time, season, deeds, feelings and story, and writes facts.*

```ts
interface ChapterState { id: Id; status: 'LOCKED'|'OPEN'|'ACTIVE'|'RESOLVED';
  openedDay?: number; resolvedDay?: number; resolvedBy?: string[] }
interface BeatDef { id: Id; chapter: Id; prereqs: Condition[]; trigger: Trigger;
  oneShot: boolean; effects: Effect[]; waitsAt?: Id /* the gate a dated story event waits at */;
  typicalDay?: number /* Book 4: a guide, never a deadline */; death?: ScriptedDeath }
interface DialogueNode { id: Id; speaker: Id; textKey: string; conditions: Condition[];
  choices: { textKey: string; conditions: Condition[]; effects: Effect[]; next?: Id }[] }
```
Event deck cards (section 25) and quest steps (section 06) are beats. Dialogue follows Book 8. Barks are short and unblocking. **Ledger-truth dialogue:** the Door of Three Truths offers statements generated from the ledger and from residents' secrets (true) alongside plausible fabrications (false); its response reads the ledger, and spoken truths become memories for everyone present. The Chapter 7 council resolves each ally to `COMMITTED | CONDITIONAL | ABSENT | HOSTILE` with reasons. Endings are a pure function of the final state, with reasons recorded for the epilogue.

### Story gates
```ts
interface GateDef { id: Id /* BEAT_ */; chapter: Id; kind: 'RAID'|'EXPEDITION'|'DEFENCE'|'COUNCIL'|'VOYAGE'|'BATTLE';
  opensWhen: Condition[]; typicalDay: number /* Book 10 section 22 */; scenario?: Id;
  readiness: { kind: 'CREW'|'SHIP'|'STORES'|'ALLIES'|'EQUIPMENT'|'OTHER'; measure: Id; labelKey: string }[];
  pressure: Effect[] /* demands grow, rumours spread: Book 10 section 22 */; retries: number;
  fixed?: { warningDays: number /* Book 10 section 22: the defence of Skarvholm only */ } }
interface GateState { status: 'CLOSED'|'OPEN'|'STARTED'|'PASSED'; openedDay?: number; startedDay?: number;
  pressureSteps: number; retriesUsed: number; fixedDay?: number; warnedDay?: number }
interface ReadinessView { gate: Id; lines: { kind: string; state: 'READY'|'SHORT'|'UNKNOWN'; textKey: string }[];
  pointOfNoReturnKey: string }
```
- **The story moves forward only through gates**, major events the player chooses to start: a raid, an expedition, a defence, a council (the list in Book 4 and Book 10 section 22: the launch, the Carrick raid, the reply to Asgrim, the defence of Skarvholm, the household council, the move ashore, the Gathering, the Return to Skarvholm and the final battle). A gate opens when its conditions hold and starts only on a player command; nothing else starts it, with the one exception below.
- **The calendar keeps running** (section 03). A dated story event is a beat that `waitsAt` its gate: it fires when the gate starts, never on its date alone. Chapter windows are typical dates (`typicalDay`), a guide for a well-paced player, never a limit; Book 10's ideal progression is the same guide.
- **Gentle pressure.** While a gate waits past its typical day, its `pressure` effects apply at the Book 10 section 22 rates (a demand grows, a rumour spreads), carried by people like any news (section 25). Pressure never starts a gate, never fails a chapter and never closes the story.
- **The readiness screen** (`Planning` mode, safe rule) shows the crew, ship, stores, allies and equipment the gate calls on, each in plain words from the household's knowledge (never hidden truth), and a clear warning that starting is a point of no return. Starting the gate takes a confirmation, makes a labelled checkpoint (section 20) and hands off to its scenario (Stage 12: each line also carries the values and the IDs its words name, decision S12-5).
- **The fixed night: the one exception.** The defence of Skarvholm (Book 6 scenario 8), when the coast's answer is an attack, is a gate with `fixed`: it does not wait for the player. Its night (`fixedDay`) is set by the answer scheduler (section 15) from Book 10 section 22, and the household is warned (`warnedDay`) at least `warningDays` before it by omens, scouts and Thrand, carried like any news (section 25). From the warning, the travel map and the sea map refuse any journey or voyage that would keep the steerer away that night, saying why (sections 09 and 10). If the steerer is away when the warning comes, word reaches them and they are brought home by dusk on the day: the journey or voyage is cut short and its remaining time run through the world step, as any time advance (section 03). At dusk on the day the readiness screen opens (preparation goes on until it does); confirming it makes the checkpoint, and the gate starts at nightfall whatever the player does. Settling with the attackers before the night (Book 6 scenario 8) turns the night's scene into a parley at the landing rather than removing it. No other gate is ever fixed.
- **Retries** are counted per gate (`retries`). The Return to Skarvholm allows one retry before the player sets out for the final battle; once the final battle's gate starts, the retry is gone.
- **Scripted deaths** are beats with a `death`: a named person dies, or a choice decides who (Rán's debt, the Return's cairn door, Bran's reckoning, Thrand's proof, the defence of Skarvholm, a berserk death, the washer at the ford; Book 6 section 17). *Rán's mercy* does not prevent them (section 12). Every death applies its consequences: household grief (happiness), lost skills and jobs, changed ties, a grave to tend, songs at the fire, a ghost or fetch where the dead had unfinished business, story branches that close, and enemies who mock or allies who honour (Book 6; numbers in Book 10 section 08).

### Aims, hints and the journal
```ts
interface AimDef { id: Id /* AIM_ */; chapter: Id; journalKey: string; opensWhen: Condition[]; doneWhen: Condition[];
  givenBy: { speaker: Id; textKey: string };                      // the aim is given in speech
  progress: Condition[] /* what counts as a step towards it */;
  hints: [HintLine, HintLine] }                                   // first, then clearer
interface HintLine { speaker: Id | 'NEAREST_RESIDENT'; textKey: string; canCall: boolean /* as a distant call */ }
interface AimState { current: Id | null; since: number /* tick of the last progress */; hintsGiven: number }
```
- **Aims come from people, not markers** (design addendum 2.4 section 3; decisions DE-23 and DE-24). Each aim is given in speech; distant shouts carry direction in an information caption ("Hild, calling from the west"); companions remark on what is next; people walk up to the steerer at key moments (Hild at the camp, Book 4 section 08).
- **Stuck help, escalating gently.** With no progress on the current aim for Book 10's `stuckFirst`, a person within earshot speaks the aim's first hint; after `stuckSecond` more, the clearer one, then again at `stuckRepeat`. With no one near, a hint whose speaker can call comes as a distant call with its direction; otherwise it waits. No hint in a fight, a scene, a conversation or a menu.
- **Nudges** (the user's fourth playtest, decisions DH-53 to DH-56; Book 10 section 08, "Nudges and advice"): besides the stuck hints, whoever is near says what to do next, in their own voice, more often: nudgeFirst after an aim becomes current, then every nudgeEvery, at most nudgeMax an aim, never within nudgeQuiet of another speech line or nudgeAfterProgress of a step towards the aim, and quiet as the hints are. The nearest resident in earshot with a line for the current aim speaks it; with none, the next open aim's (the next person to find). Lines are content/guidance.json's `nudges`, by aim and speaker, so any chapter's aims gain them as they are written; a line is never said twice by one speaker within the bark rule's spacing.
- **Ask for advice** (DH-57, DH-58): a topic offered by an advisor while there is an aim: those named `always` (Hild), and any resident whose friendship is at adviceTrust or more (later the steward). The answer is their opening line, then their lines for the current aim and the next open one (adviceAims), in turn; with nothing open, their line for that.
- **The journal** holds the current aim, always, as one plain sentence (Book 8 section 13), and the morning report beneath it. There are no on-screen quest markers. The world points the way instead: gulls over the wreck, a glint, smoke from a fire, tracks in the sand (Book 7).

### Conversation
```ts
interface LinePool { id: Id; speakerKind: 'FARMER'|'TRADER'|'GUARD'|'TRAVELLER'|'MONK'|'HERDER'|'OTHER';
  culture: Code; lines: { textKey: string; when: LineWhen }[] }        // one or two lines per minor character
interface LineWhen { seasons?: Season[]; times?: Watch[]; weather?: WeatherKind[]; feastDay?: boolean;
  deeds?: { tag: DeedTag; known: boolean }[]; reputation?: Condition[] }
interface ConversationDef { person: Id; major: true;
  greetings: { season: Season; time: Watch; feastDay?: Id; node: Id }[];
  topics: { id: Id; root: Id /* a DialogueNode tree */ }[];
  reactions: { deed: DeedTag; node: Id }[];              // what they say about a deed they witnessed or heard of
  callbacks: { memory: Condition; node: Id }[];          // remembered events: a death, a raid, a storm, a kindness
  voices: { when: Condition /* friendship or fear past a threshold */; voice: 'WARM'|'COLD'|'AFRAID'|'DEVOTED' }[] }
```
- **Most people are ordinary.** Minor characters (farmers, traders, guards, travellers) say one or two lines, drawn from pools keyed by culture, season, time of day, weather and the household's known deeds and reputation; the best-matching line is picked on the `people` stream.
- **Major characters** (leaders, antagonists, residents and quest characters) have branching topic and reaction trees. Every node's conditions can read the time of day and season (a dawn greeting, a winter fire, a feast day), the household's deeds and reputation, the speaker's happiness, friendship and fear towards the steerer, quest and story state, and recent events (a death, a raid, a storm). The voice changes when friendship or fear crosses a threshold.
- **Minimum-depth lint.** Content lint fails a major character whose conversation lacks the Book 10 section 23 minimums ("Conversation depth"): a greeting for each season and time of day, the topic trees, reactions to the deed types, the callbacks to remembered events, and a voice change at the friendship and fear thresholds. A minor character's pool must have one or two lines.
- **Deed reactions** pick their line by the same weighting as the deltas (section 15): the witness's culture first, then values, traits and stance. The line gives a period reason in the speaker's own code (honour and shame, luck, oaths, kin and vengeance, hospitality, the blood-price, sin and penance, what the gods or saints will do), never a modern one (Book 8).
- **The steerer's choices** cover the range a person of the time might take (conventional, pragmatic, merciful, cruel, transgressive), each phrased with a period reason. The player can act against the household's code; the household reacts by that code.
- **Period views are spoken, never systems.** Characters may speak of thralls, the slave market, arranged marriages, blood-feud and harsh penance as ordinary, and may urge the steerer to take captives for sale; no system lets them be bought or sold (section 26). No line applies period attitudes to women or men to the steerer, or reveals the steerer's gender (section 06; Book 8 section 03).

### The first raid's facts (read by Stages 15 and 16)
*The user's request "give the player a reason to make the first raid" (decisions DH-130 to DH-159; src/sim/narrative/raid.ts; content/raid.json). World state facts, so no new state version.*

```ts
type Need = 'IRON' | 'GRAIN' | 'CLOTH' | 'SALT';
type ClueSource = 'CHART' | 'BOAT' | 'TOLD' | 'SEEN';
type Intent = 'QUIET' | 'THREAT' | 'TRADE' | 'FORCE';
// facts['need.felt.<Need>']: boolean       a need felt now (its store under Book 10's "enough")
// facts['carrick.clue.<ClueSource>']: day   a Carrick clue came in; facts['carrick.<source>_by']: who
// facts['carrick.intel.<Item>']: 'RUMOUR' | 'LIKELY'  Item: PLACE | STOREHOUSE | GRAIN | IRON | FEW_SPEARS | MAINLAND
// knowledge.places['SITE_CARRICK'] = 'RUMOURED' once a clue names it
// facts['carrick.goods']: 'TAKEN' | 'CAMP' (absent: still in the skin boat); facts['carrick.goods_how']
// facts['ch1.council']: Intent; facts['council.day']; facts['council.said.<person>']: what they argued;
// facts['council.heard.<person>']: 'HEARD' | 'OVERRULED' | 'NEITHER'; memories EVENT 'COUNCIL_<Intent>'
interface CarrickLead { named: boolean; sources: ClueSource[]; intel: Record<string, 'RUMOUR' | 'LIKELY'> }
```
- **Stage 15** builds the Carrick lead from these facts (`carrickLead`): its sources, each intel item's confidence (likely from Book 10 likelyFrom sources; certain only by scouting), and the plan screen opened on the council's intent (`content/raid.json` `carrick.plan`: mode, approach, advantage, timing), which the player may change.
- **Stage 16** reads `ch1.council` and `council.said.*` for each resident's landing line and their judgement of the raid as kept, harder or softer by the approaches' `hardness` (`carrick.reactions`; Book 10 intentKept and intentBroken), and Conn's fate (the spared records) for Colla.
- **The launch waits for the council** while `council.required` is set (the first raid's content loaded): `startLaunch` refuses `NO_COUNCIL`, and the readiness screen shows a COUNCIL line (Book 6 section 15).
- **A beaten foe can be asked** (Interact on a begging or downed scavenger, no other enemy fighting): a search's words with them (`<who>.beaten`), whose choice ASK_HOME writes the TOLD clue. The same choice is added to the parleys' words at the fold and the cave.

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
- **Fades** (decision DE-29): a piece fades in from one layer and its other layers join over its first seconds; music fades out whenever it stops, and a change cross-fades; only stingers are sharp (Book 11 section 03, "Fades"; times in Book 10 section 25).
- **Ambience** layers by zone, season, weather and time of day, driven by the game's state (the wind from the game's own wind field, the tide). **SFX** by event and surface material.
- **Voice blips**, not voiced barks: each speaker's lines appear as text with a short blip voice of their own; the steerer has none. Every line has a subtitle.
- **Captions** for gameplay-relevant sounds the picture does not already show (a horn, a supernatural sign, a call from out of sight), as information captions (below). In a fight, combat sounds are read by their sound and their drawn twin (the telegraph's draw-back and flash, sparks, the parry's spark) and are not captioned; an accessibility option, off by default, captions them (design addendum 2.5; decision DF-14).
- **Presentation only:** audio reacts to simulation events and never affects gameplay, saves or determinism. Its random streams are its own (seeded), never the simulation's.
- Sliders for master, music, ambience, effects, voice blips and supernatural tells, and a mono option. Loudness and budgets follow Book 11.

### Subtitles and captions: speech and information
```ts
type CaptionKind = 'SPEECH' | 'INFO';
type InfoClass = 'SAFETY' | 'DIRECTION' | 'STORY' | 'SOUND';      // priority, highest first (design addendum 2.5)
interface CaptionLine { kind: CaptionKind; text: string /* already formatted */; until: number; info?: InfoClass; fadeFrom: number }
interface CaptionView { info: CaptionLine | null; speech: CaptionLine | null; held: CaptionLine | null /* waiting out a fight */;
  lastShown: Record<string, number> /* text -> when, for repeats */ }
```
- **One of each, never stacked** (design addendum 2.5 section 2; decisions DF-11 to DF-13). At most one information line and one speech line show at once (`CaptionView`). A new line replaces the shown line of its kind at once, with a short cross-fade; lines never stack or queue. The same information line is not shown again within Book 10's `captionRepeat`, and repeated speech follows Book 8's bark rules. Lines fade in and out quickly (Book 10 section 21, "On-screen text"). Captions sit at the bottom centre, clear of the action, above the hotbar.
- **Fights: barks only.** While Book 10's `inFight` holds, only speech barks and `SAFETY` information lines show (the list is Book 8 section 10's); other information waits as the one `held` line, shown once the fight ends if it is still fresh, else dropped. When two information lines arrive together, the higher class shows.
- **Cut what the picture says.** Information lines are only for what the picture and sound do not already convey. Every on-screen message category is listed in Book 8 section 10's audit as kept, cut or merged; a new category needs a row there before it is shown.
- **Two kinds of line, and they look different.** **Speech** is what someone says: the speaker's name, a colon and the words, in upright type ("Hild: Here! Over here, past the rocks!"). **Information** is sounds, directions and other cues that aren't speech: italic, with no speaker prefix and no quotation marks ("Hild, calling from the west"; "Surf breaking on the rocks"). When both show at once, information lines sit above speech lines.
- **Every caption string is tagged** `SPEECH` or `INFO` in the string table (every key under `caption.`), and the event that shows it carries the kind. **Content lint** fails a caption string tagged neither or both, a `SPEECH` string that does not start with its speaker (`{speaker}: `), and an `INFO` string with a speaker, a "Name:" prefix, quotation marks, or eight words or more. Speech follows Book 8's period rules; information lines are short, in the present tense, plain modern-neutral English with no glossary words and no slang, and give a direction when it helps the player find the source (Book 8).
- **Speaker names come from what the player knows.** A speaker the player has not met is named by what they appear to be ("Monk:", "Stranger:", "Ardcarn guard:") until introduced; the name is chosen from `knowledge`, never from hidden truth, so a hidden identity (Nessa's secret, a disguised enemy) is never given away by a subtitle name.
- **Drawing:** captions are text on the native-resolution overlay (Book 7 sections 01 and 10). Information uses a real italic face of the caption font, never a synthesised slant (`font-synthesis: none`), so it is crisp at 1x; speech is upright. A browser test checks the order and both styles.
- **Settings:** information captions can be turned off separately from speech subtitles (the information toggle is in the display settings of the system menu, section 21), and combat prompts set to the first fights, always or off (section 21); the combat sound captions option is withdrawn (decision DF-80). Display settings are per-viewer presentation, never world state.
- **Tutorial prompts and tooltips** (the move hint, a timed task's press, a pickup tooltip) fade out during speech lines, story beats, scenes and talk and come back after, unless done; once the player has done the thing they disappear for good; they never share the screen with a narrative line (Book 10 section 21, `promptQuiet`, `promptDone`, `tipHold`).
- **Combat prompts: the one exception to "no combat text"** (the user's third playtest; decisions DG-7, DG-9, DG-11 and DG-25). Input prompts only, each a control and a verb (lock on, strike, parry, dodge, block; the heal prompt; the sneak hint; the two teaching foes' prompts; the finish-or-let-go choice), shown at the screen's right edge by Book 10 section 21's "Combat prompts" (`promptPlace`, at most two lines, faded while any fighter or missile is drawn under them), never in the caption area and never over the action. The lock-on, strike, parry, dodge and block prompts show only in the steerer's first `promptFights` fights (counted in `player.teaching`, section 05) and then fade away for good; each also retires once used `promptRetire` times. They are not captions: they never report a hit, a block, a parry, damage, a state or anything that happened, and there is still no damage number and no log. A fight bark does not hide them; story beats, scenes and talk do (`quiet`).
```ts
type CombatPromptId = 'LOCK_ON'|'STRIKE'|'PARRY_DODGE'|'BLOCK'|'HEAL'|'SNEAK'|'TEACH_PARRY'|'TEACH_DODGE'|'FINISH_OR_SPARE';
interface CombatPromptView { shown: { id: CombatPromptId; textKey: string; since: number; fading: boolean }[] /* at most 2 */ }
```

## 19 / Art pipeline (authored by Claude)
*Final art is written as palette-indexed pixel sources, compiled and checked, never improvised at runtime.*

- **Source format:** one file per sprite sheet: a palette reference (Book 7), frame size (people 32 x 48, Book 7 section 01), and frames as rows of palette indices or characters, with pivots, footprints, a ground shadow and animation events. A sheet can also be produced by a deterministic generator script committed with its output.
- **Compiler** (`tools/art`) validates sources, packs atlases and writes manifests. Builds fail on unknown palette indices, missing facings or missing states.
- **Art lint** (`npm run lint`) runs the checks of Book 7 section 14 on every sheet and zone, including for people: a 32 x 48 canvas about 18 x 40 occupied (the heavy build up to about 4 px wider) with feet on the pivot row; the 6-frame walk with the torso and head dropping exactly 1 px on its down frames (1 to 2 px for the heavy build); the 8-frame **run cycle** (Book 7 section 17), whose two suspension frames have both feet at least 1 px above the ground line and whose down frames drop the torso 1 to 2 px; every layer sheet matching its body's states, facings, frame counts, pivots and events; and the composite outline (below).

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
- Every layer the steerer can wear exists for both body models. Equipment is simulation state (it changes armour, recognition and noise); its drawing is presentation. A layer is drawn only for what the person owns and carries: the steerer, who wakes with nothing in hand, has no weapon layer until the seax is picked up, and no bow on the back until the bow is (Book 7 section 07).
- **Body builds.** People are drawn on one of three builds: the steerer's two body models (A and B) and the **heavy build** (`actor_heavy`), a third body for some residents and enemies, never the steerer (Book 7 section 16). Every build shares the same 32 x 48 cell, foot anchor, states, facings, frame counts and timing, so all animation logic is shared; only the drawing differs. Paper-doll layers are fitted to each build (`layer_<slot>_<name>_<body>`, Book 7 section 11): every layer a heavy person wears exists for the heavy build. A person's build is part of `appearance` (section 06); its play effects (poise, wind-ups, hits, run, carrying and running stamina) are Book 10 section 24's, applied by the simulation (section 12), never by the art.
- **Outlines on the composite.** The one-pixel ink outline is checked on each person as composited (every layers file, every frame), not on each layer alone, so cloth that meets skin is not double-outlined; body sheets alone keep the edge-ink rule (decision S6R-6).
- **Visual check:** before a stage marks art done, Claude renders every new sheet at 1x and 4x to an image, inspects it, and records the check in the stage report.
- **Gore layers:** bloodied overlays, dismemberment pieces and decals are separate sheets so the gore setting can change presentation.
- **Placeholders** carry `placeholder: true` and are listed in the stage report; never circles, boxes or emoji.

## 20 / Saves
*Saves are versioned, migratable, and safe to load without repeating one-shot events.*

- JSON world state, compressed; header with schema version, build, seed, day, chapter and state hash.
- Migration chain with golden-save tests; unknown future versions refused. Every version of the world state (section 05) keeps a frozen golden save that loads through the chain (version 2 through the version-3 migration, decision S6R-7).
- **Autosaves at safe checkpoints** (decision DE-12): because the steerer's death is game over and fights are deadly, a death costs a couple of minutes, not twenty. Before each set-piece fight (each encounter with a checkpoint in content, the scavengers at dusk among them), on reaching camp (the first time in a day, under the safe rule), on waking (before the morning report), on waking at a camp or waystation when it is safe (not attacked in the night, no hostile aware, the place not hostile), before departure (by sea or on a journey), before landing, and labelled **checkpoints** at every story gate once its readiness screen is confirmed (section 16), before other major danger and before the final battle. Three rotating autosaves plus manual slots.
- Manual saves are allowed only under the safe rule. Game over offers the latest autosave or checkpoint.
- **Slots and the pause menu** (the user's third playtest; decisions DG-16 and DG-17). The pause menu (section 02) shows **three manual slots and the autosave**: the autosave slot is the newest of the three rotating autosaves and checkpoints, loadable but never saved to. Each slot shows the day and season, the time of day, the place's name and a small screenshot (Book 10 section 21, "Menus and saves": `thumbnail`, `thumbnailBytes`), read from the save's header and thumbnail without unpacking the world. Saving over a used slot, loading and quitting each confirm once. The save's header gains what a slot shows; the thumbnail sits beside the header, outside the world data, and is presentation only (never hashed, never read by the simulation):
```ts
interface SaveHeader { /* as built, plus: */ minuteOfDay: number; season: Season; zone: Id | null;
  placeKey: string /* the place's name string */; dev?: true /* made after a developer command (section 21) */ }
interface Thumbnail { w: number; h: number /* Book 10 thumbnail */; format: 'png'; data: string /* base64 */ }
interface SaveFile { format: 'oar-and-ember-save'; header: SaveHeader; thumbnail?: Thumbnail; data: string }
type SlotId = 'manual-1'|'manual-2'|'manual-3'|'autosave-1'|'autosave-2'|'autosave-3'|'day-start';
interface SaveSlotView { slot: 'AUTO'|'MANUAL_1'|'MANUAL_2'|'MANUAL_3'; empty: boolean; header?: SaveHeader; thumbnail?: Thumbnail; savedAgo?: string }
```
  The thumbnail is made by the render from the last frame drawn before the menu opened (no menu, captions or prompts in it), at a quarter of the logical view, each pixel the mean of its 4 x 4 block. Manual slots are `manual-1` to `manual-3` (Book 10 `saveSlots`).
- **Reset to the start of this day** loads the `day-start` save: written at every waking at 06:00 (before the morning report; on day 1, at the waking in the surf after the cold open) and kept, never rotated, until the next waking writes over it. It restores the whole world state as it was then: the calendar and tide, every person, the ledger, facts, stores, fights and the teaching counts. It keeps everything that is not world state: display and audio settings, bindings, the help record, whether the intro has been seen, and the manual and autosave slots, which are untouched. Like load, it is offered in the overlay too, after one confirmation, and the reset day's progress is lost.
- One-shots, ledger, evidence and bargain hashes survive every save and load.

## 21 / Input, interface and accessibility
*Mouse, keyboard or gamepad, accessible without a pause. Devices make commands; the simulation never sees a raw pointer.*

- Actions: move, run, sneak (a toggle in combat v2), use selected item (attack with a weapon; hold to charge a heavy; hold to cut with a blade), interact, aim, hotbar slots 1 to 12, next and previous slot, parry, block, dodge, shove, lock-on, heal (bind or eat), finisher (hold), let go (spare a beaten foe), jump, camp, command ring, quick commands 1 to 6 (on their own keys: the number keys select hotbar slots), map (and the travel map, section 10), inventory, build menu, journal (with the report), system menu. All remappable on keyboard, mouse and gamepad.
- The command ring opens on hold and leaves time running.
- **One list of what Interact does** (the user's fourth playtest, decisions DH-4 and DH-10): the uses in the zone in view are gathered by one function (`placedUsesHere`, src/sim/narrative/uses.ts) that the simulation acts on and the play view names as its prompt, and the view's choice between a use and a lift or pickup is the simulation's own (`useWins`), so a prompt is always shown for what the key will do. A use may be marked `first` (the shelter's stages at their marked spot): within reach it comes before every other use but a bed stood on.

### Hotbar and target tile
```ts
interface Hotbar { slots: (Id | null)[] /* tools, seeds, items, weapons; Book 10 section 21, hotbarSlots */; selected: number }
type PlayerCommand =
  | { kind: 'USE_AT'; slot: number; tile: TilePos }       // chop, dig, sow, water, harvest, hammer, fish, attack
  | { kind: 'INTERACT_AT'; tile: TilePos }                // talk, pick up, open, harvest ripe crops, eat
  | { kind: 'AIM'; vector: AimVector }                    // quantised; bows and thrown spears while drawing
  | { kind: 'SELECT_SLOT'; slot: number };               // and move, run, parry, block, dodge and the rest
```
- The **hotbar** lives in `PlayerState` (section 24) and is chosen with the number keys, the mouse wheel or the gamepad's shoulder buttons. **It starts empty** (Book 10 section 21, "Starting weapons"): a new item picked up goes into the first free slot. A slot shows its item's count where it has one: arrows are shown on the bow's slot, from the count in `PlayerState`, not as a slot of their own.
- **Pickup tooltips.** The first time the player picks up an item of a kind that has controls (the seax, the bow, a spear, a tool), a short tooltip names its controls for the input in use (mouse and keyboard, keyboard only, or gamepad), from the current bindings, never written into the string (Book 8 section 10). It shows once per item kind, never blocks play and never stops time, and is kept afterwards in the **help pages** of the system menu, which list every tooltip the player has seen, for any input. Which tips have been shown is a per-viewer setting, not world state:

```ts
interface HelpRecord { seenTips: Id[] /* ITEM_ kinds whose pickup tooltip has shown, in settings beside the display options */;
  introSeen: boolean /* the cold open played to its end once on this device (decision DG-19) */ }
```
- **Combat v2 bindings** (decision DE-3): lock-on on Z, the middle mouse button and the right stick's click (pad R3); sneak moves on the pad to the d-pad's down, and quick command 1 leaves the pad for the command ring; heal (bind a wound, or eat with a ration selected) on H, and in the command ring on a gamepad. J opens the journal, with the morning report below the current aim.
- **Default bindings** (decision S6R-2; all remappable): slots on 1 to 9, 0, minus and equals; next and previous slot on the mouse wheel, `]` and `[`, and the gamepad's right and left bumpers; use the selected item on the left mouse button, F and the right trigger; interact on the right mouse button, E and gamepad A; quick commands on F1 to F6; parry on gamepad Y, block on the left trigger, shove on gamepad X; the light and heavy attacks are the use action with a weapon selected. The finisher has no gamepad button of its own. **Since the user's third playtest** (decision DG-22): let go on G; the system menu also on P; on a gamepad, while the finish-or-let-go choice is offered and no other foe within its attack range of the steerer is in a wind-up, Y (parry) held is the finisher and A (interact) is let go, and otherwise they parry and interact as ever. In developer mode (below) F3 opens the developer menu, and quick command 3 is reached from the command ring and the pad only.
- **The target tile** is chosen per device. **Mouse:** the tile under the cursor, if it is within reach of the steerer for the selected use (`toolReach`, `interactReach` or `castReach`, Book 10 section 21 "Controls and camera"). **Gamepad:** the right stick moves a target-tile cursor around the steerer within the same reach; with the stick released (inside the stick dead zone) it is the tile in front of the steerer's facing. **Keyboard only:** the tile in front of the facing, so every task and interaction can be done without a pointer.
- **Left-click** (or the use button) uses the selected item at the target tile; **right-click** (or the interact button) interacts there. A target out of reach does nothing but show it: a dimmed, red-edged cursor tile and a short refusal word (Book 7 section 10), never a sound alone.
- **Aim:** melee attacks go towards the cursor (or the right stick), snapping to the nearest of the four facings (combat v1), or along the combat stance's facing towards the cursor or the locked target (combat v2, section 12); bows and thrown spears aim freely along the aim vector, with an aim line while drawing. Parry, block, dodge and lock-on keep their own keys.
- **Determinism:** the input layer turns device state into `PlayerCommand`s (use at a tile, interact at a tile, an aim vector quantised to a fixed set of directions) stamped with their tick. The simulation receives only commands, never screen or pointer coordinates, and replays record commands, so a mouse game replays exactly. Nothing in `sim/` reads a pointer, the screen or the camera.

### Camera
- The camera follows the steerer with a **look-ahead towards the cursor**: `lookAheadScale` x the cursor's distance from the steerer, ignored inside `lookAheadDeadZone`, capped at `lookAheadMax`, or `lookAheadAiming` while drawing a bow or aiming a spear (Book 10 section 21 "Controls and camera"). With a gamepad it leads towards the right stick, and in keyboard-only play towards the direction of travel.
- Smoothing runs in sub-pixel space with the `camera smoothing` half-life; only the final offset is snapped to whole logical pixels, with its hysteresis, so a still or slowly moving cursor never makes the view step one pixel back and forth. The camera is presentation: it never changes what the simulation can see (sight ranges are those of Book 10 section 07).
- Options: combat speed 70 to 100%, parry window widening, enemy damage, *Second wind*, *Rán's mercy*, gore level, day length, text size 100 to 200%, speech subtitles and information captions (each on its own switch, section 18), awareness marks (off by default), combat prompts (for the first fights, the default; always; or off: section 18), colour-blind presets, reduced shake and flashes, hold-or-toggle inputs, and the intro (play or skip). The combat sound captions option is withdrawn (decision DF-80).
- **The pause menu's pages** (decisions DG-15 and DG-18). **Settings** holds the options above in four groups (display, audio with Book 11's sliders and mono, gameplay with the campaign's options, and the intro), each change applied at once; the campaign's options are world state and change only while the menu holds time. **Controls** lists every action with its bindings for the input in use and remaps them (keyboard, mouse and pad), with the help pages of seen tooltips beside it. **Fullscreen** asks the browser for fullscreen on the page (a user gesture, so it works from the menu) and keeps the integer scaling and letterbox; its state is a display setting. In Chromium, fullscreen locks the Escape key (`navigator.keyboard.lock`) so a press opens the pause menu and a long press leaves fullscreen as the browser shows; in WebKit, where Escape leaves fullscreen, leaving fullscreen during play opens the pause menu. **Quit to title** confirms once, naming how long ago the last save was made, and does not save.
- **The title screen** offers New game, Continue (the newest save), Load (the same slot view), Settings (with the intro setting) and Fullscreen, so fullscreen can be chosen before a game starts (decision DG-18).
- **Skipping the intro** (decision DG-19). Once `introSeen` is set, the cold open shows a Skip button and "Hold any key to skip"; holding any key or pad button for Book 10's `skipHold`, or clicking the button, goes to the black and the waking with the world exactly as after the cold open. The title screen's intro setting leaves it out of every new game on the device. Skipping is presentation: the cold open writes nothing the waking needs.
- **The developer menu** (decision DG-21). Only in a debug build (`import.meta.env.DEV`) or with `?dev` in the address; never built into a player's view otherwise, and never named in player-facing text. F3 toggles it. It shows the current aim's journal line, the day and the time, the frames per second (averaged over a second, with the slowest frame's time), the zone and the steerer's tile, and offers: skip 6 hours (Book 10 `devSkipHours`), teleport to the clicked tile, and kill the clicked enemy. Each is a command (`DEV_SKIP`, `DEV_TELEPORT`, `DEV_KILL`) stamped with its tick like any other, so a replay stays exact; a dev kill writes no deed; any save made after one is marked `dev` in its header, and the chapter's telemetry ignores such a run.
- **The cursor is hidden** in cinematic and non-interactive moments: the cold open, the black and the waking until the first input, and every scene that takes control; it shows again on the first mouse movement once control returns, or when a pointer use is offered (design addendum 2.5 section 3; Book 10 section 25, `cursorHidden`).
- Generous interaction radius with the target tile highlighted; every refusal or shortage shows its reason in words.
- **Stamina bar:** its length shows the current maximum, and each reason it is smaller is shown with its icon and a plain word ("Cold", "Hungry"), from the stamina view of section 24 (art in Book 7 section 10).
- **Health and stamina bars** (combat v2, decision DE-8): two bars, top left, shown in a fight and fading out after Book 10's `barsFade` at full outside one; a thin health bar over the locked or recently hit enemy (`enemyBar`). Awareness marks ("?" and "!") are a display option, off by default (design addendum 2.5; decision DF-9). Nothing else in a fight is text: no damage numbers, no hit or state words, no log.

## 22 / Performance budgets
| Budget | Target |
|---|---|
| Frame rate | 60 fps at 1080p on integrated graphics (WebGL2) |
| Simulation tick | Under 4 ms with 60 active actors including residents |
| Assault battle | Simulation tick under 4 ms with 30 a side plus the scene's civilians; 60 fps held |
| World step (off screen) | Under 2 ms per game-hour step for every mainland site and route, their travellers and bandit camps, a journey's road leg, and the away simulation |
| Scene streaming | No visible hitch at link edges; full scene load under 3 s |
| Sea-map watch resolution | Under 2 ms |
| Save | Under 200 ms |
| Memory | Under 700 MB |

**Rules for big scenes.** Simulation detail never depends on the camera. AI decisions are spread across ticks (each actor still at 10 Hz); sight and hearing query a spatial grid, not every pair of actors; formation members follow their leader's plan (section 13); groups moving to one objective share a path field; corpses, decals and particles are capped by presentation settings, never by deleting simulation state.

## 23 / Testing
*Each stage proves itself. Tests are part of the deliverable.*

- **Unit tests** for pure functions: ship stats, friendship and fear deltas by deed (weighted by culture, then values, traits and stance, with two codes taking the stronger factor), each trait's effect, likes and dislikes as mood factors, happiness from its factors and the work multiplier, food runway, spoilage, crop stages, fuel, frame data, tide and calendar, depth band from bed and water level, the stamina maximum from each reason, traversal drains, the away efficiency, the target tile for each device and reach, the melee facing snap and aim quantisation, camera look-ahead and snapping, a road leg's time under each journey modifier, and the **shortest journeys** between all sites computed from the network, row by row against Book 10 section 14 ("Shortest journeys").
- **Property tests:** ledger append-only, roster cap, no resource below zero, accepted bargains unchanged, one-shots never refire, no gendered steerer strings; stamina `current <= max`, the maximum never below its floor, and every point of lost maximum listed with a reason; companions never more than the cap; an event card never fires twice, never during a tutorial and never two at once; news never reaches a place sooner than a carrier could walk or sail there; every quest that can end in a killing has another out; every layer sheet matches its body's frames; no gate starts without a player command, and no event that waits at a gate fires before it starts; no journey reaches a place beyond a route without crossing that route on foot; no downed ally dies or is captured while the scene runs except by a finishing blow after its warning; with *Rán's mercy* on, no unscripted death; captives are never traded as goods.
- **Stamina and traversal:** emptying the bar mid-climb slides the steerer down; mid-swim starts the sink; walking, ordinary carrying and water up to the knee never drain; a homestead task advances the clock by its game time and costs only its small stamina; restorers lift the reasons Book 10 gives them.
- **Scenario runner:** `scenario run SCN_CARRICK --approach STEAL --seed 42` asserts bands, deeds, evidence and leads; `--mode ASSAULT` runs the assault (muster waves arrive by their triggers, objectives become facts, formations hold and break by the rules).
- **Homestead simulation:** a headless run of 120 days under a delegated policy reports food, fuel, sickness and deaths against Book 10 targets. An **away run** with the steerer gone reports output against the Book 10 section 19 efficiency (with and without a skilled steward), shows the home never starves while food is stored, and checks every queued event appears in the homecoming report.
- **Living world:** a headless world run of a year reports traveller and event density on roads, in settlements and in the wilderness, trader visit intervals, bandit camps forming and breaking, and event deck pacing against Book 10 sections 17 and 20.
- **Reachability:** flood-fill every scene from Book 9 under tide and season conditions, including each route's main path end to end, its camp spots and its branches to sites; walk the mainland's network of road legs and routes under every season and every combination of cleared blocks, proving every site reachable once its blocks are cleared and both home sites reachable from Chapter 3.
- **Camping:** a camp ends the day, heals, and saves only when safe; its risk falls with a fire, a watch, shelter and a waystation.
- **Journeys:** a road leg advances the clock by its modified time through the world step and only under the safe rule; a journey event stops the leg, plays its scene and resumes with the time left; route encounter rates over many seeded crossings match Book 10 section 14 ("Route encounters") with their season, faction, cargo and cleared modifiers; every ambush shows its sign first.
- **Downed and carried:** a downed ally never bleeds out; carried to a safe place before the scene ends they live; left behind they are captured or killed by the enemy's rule; enemies do not attack the downed except berserkers and cruel enemies after their warning; a berserker ignores orders and its deeds are household deeds.
- **Story gates:** a delaying bot that never starts a gate sees the calendar, seasons and crops go on, pressure build at the Book 10 section 22 rates and no gate or waiting event fire; the readiness screen shows only known state; the Return's retry closes when the final battle's gate starts.
- **Combat v2:** every weapon's frame data, reach, poise damage and special rule matches Book 10; a parry inside the window gives the hitstop, the open time and a riposte that cannot be blocked; poise breaks into stagger and a big hit knocks down; a fighter holds off outside the reach it faces and steps in after a miss; the first scavengers die to three clean seax hits or one riposte; a missile fired at any speed through any crowd hits the first body or shield on its path (never passes through), in and out of a fight; an unaware actor is backstabbed, an aware one sometimes sidesteps a missile; warnings come at their distances and walking away ends them; an autosave exists before every set-piece fight.
- **Combat by design addendum 2.5:** every move's wind-up, active, recovery, miss recovery, step and stamina match Book 10's "Frame data" and "Enemy attacks" (no enemy wind-up below its telegraph floor); no command moves, turns, blocks, dodges, parries or starts an action between a wind-up's first tick and a recovery's last (property test over random inputs); no action ever cancels; speed ramps up and down over the Book 10 ticks and is zero from an attack's first wind-up tick; stamina at 0 exhausts and refuses attack, parry, shove, dodge, block and run at half speed until the threshold; a parry pressed so that its active ticks overlap the blow's first active tick parries it and stuns for `parryOpen`, one pressed earlier or later is hit, and a parry that meets nothing plays its recovery; a block halves speed and drains by the blow, and the hit that empties it staggers for `guardBreakEmpty`; a dodge is invulnerable only in its middle ticks; a fighter never changes state sooner than its least time, decides only every `decisionInterval`, circles at its circle radius, steps in only on an opening (or its patience), and retreats after attacking; an archer never draws without a clear line, never moves while drawn, dashes once when too close and draws its sidearm when cornered; every enemy attack emits its telegraph with its flash 28 ticks before its first active tick; no text is shown for any combat event.
- **On-screen text:** never more than one information line and one speech line at once (property test over random event streams); a new line replaces the old; a repeat within `captionRepeat` is not shown; in a fight only speech and `SAFETY` lines show, and one held line shows after it; tutorial prompts are hidden whenever a speech line, story beat, scene or talk shows, and gone once done; the cursor is hidden through the cold open and every scene (browser test).
- **The rescue scenario test** (design addendum 2.5 section 4; decision DF-18): for **every rescued person** (Hild, Oddi, Bran, Runa, and anyone a later chapter rescues), a scenario plays the rescue several ways: at different times of day (morning, midday, dusk and night), by every route home the content allows (carried, walking on their own, after each search's choices: Oddi with the strongbox first or himself first; Bran by fight, sneak or bargain; Runa by the offering or the cliff path), with the steerer staying, leaving the zone straight away, sleeping straight away or fighting, and across a save and load during the walk home. Each run checks that the person gets up after `rescueGetUp`, reaches the camp within `rescueHome`, takes up work, eats at the next meal, sleeps under the shelter at night and answers talk with a line, and is never stuck (`rescueStuck`). It runs headless in `tests/scenario/`, and a browser spec plays one rescue of each person at the scripted pace.
- **Guidance and the world:** with no progress, the first hint comes at `stuckFirst` and the second at `stuckSecond` more, from someone in earshot or as a call; no quest marker is ever drawn; every Chapter 1 aim has its journal line and two hints (content lint); walking into an edge stops without sliding and gives its caption at most once per cooldown; every door opens when walked into, closes after its delay, and blocks movement and sight while closed; a carried thing with a home settles at its outline.
- **The user's third playtest** (decisions DG-1 to DG-29; the tests the user asked for are marked *asked*):
  - *Asked:* **pause and reset-day restore the right state.** Under the safe rule the pause menu runs no tick: the state hash is the same after a pause of any length, and the game resumes on the next tick; with a hostile aware the overlay lets ticks run, and a hostile turning aware while the menu holds time starts time again. Reset to the start of this day restores a state hash equal to the `day-start` save's, on day 1 and on a later day, after a fight, a rescue and a sleep missed, and keeps the settings, bindings, help record and every save slot unchanged.
  - *Asked:* **save slots round-trip.** For each of the three manual slots: save, load, and the state hash matches; the header gives the day, season, time and place, and the thumbnail is Book 10's size and under `thumbnailBytes`; a save with a hostile aware is refused with its reason; the autosave slot shows the newest autosave or checkpoint and cannot be saved to; an old save without a thumbnail lists and loads.
  - *Asked:* **spared enemies are recorded.** Letting go a reeling, a downed and a begging foe each writes `SPARED` with its `how`, adds a `SparedRecord` with a fate, makes the foe drop its weapon and leave without rejoining the fight; over 2,000 seeded spares the fates' shares match Book 10's odds under each condition within 3 points; a due record plays as its fate says (an ambush with its sign and line first, or its favour), and the grateful survivor comes at most once.
  - *Asked:* **the two teaching foes are beatable only their intended way.** Scripted players that block and punish, chip with lights, charge heavies, shove, backstab from cover, loose arrows or throw spears leave Svart and Ketill at full vitality over 5 minutes each; a player that parries beats Svart, and one that dodges (or steps out of reach) and strikes in the red blow's recovery beats Ketill, on 10 seeds each; Ketill's red blow breaks a raised guard and beats a parry; every red blow emits its red telegraph at the flash lead and its scrape from its first wind-up tick.
  - *Asked:* **every tutorial enemy speaks before attacking.** In every Chapter 1 encounter (the dusk, the fold, Seal Cave), by every approach and from every side, each enemy's `FIRST_SIGHT` event comes before its first attack's first wind-up tick and its pause is kept unless the steerer steps within reach or strikes; the line is a warning or a taunt by Book 10's rule; over many encounters no line follows itself or is reused before its pool is used through (property test); no line uses a gendered word for the steerer (content lint).
  - **Finishers:** the choice is offered only to beaten foes within `offerReach`; each weapon's two finishers match Book 10's "Finishers" ticks, step and hitstop; a finisher writes `SURRENDERED_KILLED` on the downed and begging and `KILLING` on the reeling; it never slows time or moves the camera beyond its shake; a hold let go early does nothing.
  - **Prompts:** the lock-on, strike, parry, dodge and block prompts show only in the first `promptFights` fights and retire after `promptRetire` uses; no prompt box ever overlaps a drawn fighter or missile (browser test); the heal prompt shows on a hit below the threshold while a binding or ration is carried and stops after `healPromptUntil` heals; the sneak hint shows at the dusk and the fold approach, at most `sneakHintTimes`, and is gone once the steerer has sneaked; still no damage number, hit word or log in any fight (the on-screen text property test, with the prompts allowed at their place only).
  - **The fold's talk:** plays only while all are unaware, never the same exchange twice in a row, leaves out absent speakers, and stops for good at the first suspicion, the first-sight lines following.
  - **The shelter:** its three stages in order, the frame and the sail on day 1, the finishing not before 06:00 on day 2; Hild's line at each stage; the household sleeps under the sail from the first night; the camp's worker-days match Book 10.
  - **The sea burial:** the body is drawn wholly under water (masked) for at least `seaSink` before it is taken out of the world, after the three waves, and the scene keeps Book 10's timings (browser capture).
  - **No trap** (the edge-walk test; Book 9 section 13): for every zone, every collision shape's edges are walked at `probeStep`, at every tide state of `probeTides`, with doors open and shut, and from every probe point the steerer, driven through the real movement step, gets `escapeDistance` away within `escapeTime` in some direction; a steerer standing on tidal ground as it closes, or in water as it deepens, can always walk off. The case of the user's screenshot (the western outcrop on Wreck Strand, the mast's foot and the stream's mouth, at night at every tide) is its own named test.
  - **The intro and the developer menu:** the cold open cannot be skipped before it has been seen once, and a skip lands on the same world state hash as a cold open played through; no developer command or readout exists without a debug build or `?dev`; developer commands replay exactly and mark later saves.
- **The user's fourth playtest's people** (decisions DH-40 to DH-66; `tests/unit/pt4people.test.ts`, `tests/browser/pt4people.spec.ts`): a resident being bound is `TENDED`, sitting and unmoved until it ends; Runa refuses a binding the first time and that day, is bound at once when the steerer offers to hold the end, and lets it be done on a later day, and nobody else refuses; the household's hours by trait (early, late) and the watch by turns; when the steerer lies down nobody else goes to bed, each goes at their own hour through the night, and on waking the early risers are at work, the watch abed, and everyone at their activity's place; exchanges fit only by their speakers, ties, traits, events and earshot, the most particular chosen, their lines in order at exchangeLineGap, never back to back (exchangeEvery), never with another speech line inside, never twice within exchangeRepeat, never in a fight or out of hearing; nudges name an open aim (the current first), come from a speaker with that aim's line, at least nudgeEvery apart and at most nudgeMax an aim; advice is the advisor's opening line and their lines for the next adviceAims aims, offered by Hild always and by others only when trusted; boat workers never share a spot (in content, in the schedule and in play), and what the boat needs next and its drawing follow the work, the hull passing through every drawn stage in order.
- **The user's fourth playtest's story and scenes** (decisions DH-10 to DH-39; `tests/unit/pt4story.test.ts`, `tests/browser/pt4story.spec.ts`): **the shelter's prompt shows at its marked spot whenever it can be worked, in every order of play** (the usual order; the frame before the fire with Hild still on the strand; straight to the broch with nothing carried and the chest after; after dark and across a save and load; the second morning's finishing at its build site), with its mark drawn, and Interact there does what the prompt says; the strongbox is never taken out of sight (leaving the strand takes nothing), while Oddi is carried a free scavenger takes it in a held scene (Conn first, Svart if Conn is dead), runs it to the edge and is remembered, and run down with Oddi set down he drops it and it can be carried home, and with none free nobody comes; the steerer's word over Thorkel's body (the first with his key) and once over each fallen foe, never the last line twice running; Hild's topics follow the facts of her father (never "never found" once found) and "Your father's rites" opens the rites wherever she is; the rites' two music cues; the broch's quarrel waits behind the wall and starts in view; Runa's reminder at Book 10's times; Bran's two shouts at their foes' wind-ups, never back to back; the stores' second hint only by the mast with the bow and the lashing whole; "Nothing that way" names an open way and never one that does not lead on.
- **Input and camera:** replaying a recorded mouse-and-keyboard session reproduces identical state hashes; `sim/` imports nothing from `input/`, `render/` or the DOM; keyboard-only and gamepad-only bots can do every task and interaction; a still cursor gives a still camera (no one-pixel oscillation over a long run); every new action is remappable.
- **Performance:** an assault of 30 a side and the off-screen world step stay within section 22.
- **Autoplay harness:** bot policies (greedy, merciful, trader, glory, brutal, mixed) play from any chapter and report Book 10 progression metrics.
- **Content lint** (`npm run lint`): schemas and references; the ID registry; no gendered word to or about the steerer (section 06); caption tags, `SPEECH` with a speaker and `INFO` without (section 18); no event card puts a child on stage (section 25); every quest that can end in a killing has another out (section 06); every site and route has its points of interest (section 10); the conversation minimum depth for each major character and the one or two lines of each minor pool (section 16); and the **dialogue word list** (Book 8): dialogue strings (those spoken by a person) may not use modern moral vocabulary: rights, war crime, genocide, trauma, civilian, ethics, morality, values, consent, abuse, victim, tolerance, equality, or their plurals. "Innocent" is allowed (it is a Church word); dialogue says "farmers", "folk" or "people who bore no weapon". Interface text (the household screen, menus, reports' labels) is exempt. Book 8's modern register words ("okay", "guys" and the rest) are checked in review.
- **Art lint** (section 19; Book 7 section 14), including the walk drop, the run cycle's suspension and down frames, layers matching their bodies and the composite outline. **Golden saves**, **determinism replay**.

### Stage report format
```
STAGE <n> REPORT
Implemented:        <list with file paths>
Tests:              <commands run, pass/fail counts>
Gate checks:        <each acceptance check: PASS / FAIL with evidence>
Art check:          <sheets rendered and inspected; walk and run GIFs if people changed; placeholders remaining>
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
  counts: Partial<Record<Id, number>>;    // items carried by number, such as arrows (ITEM_ arrows: bone- or iron-headed), up to Book 10's quiverMax; bindings and carried rations (combat v2: Book 10 healCarry)
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
interface TravellerState { def: Id; members: Id[]; place: Id; detail: 'FULL'|'LOW';
  leg?: { leg: Id /* a road leg, or a route crossing */; departed: number; arrives: number /* minutes of campaign time */ };
  goods: CargoLot[]; news: Id[]; status: 'TRAVELLING'|'STAYING'|'CAMPED'|'GONE'|'DEAD'|'CAPTIVE' }
interface NewsItem { id: Id; about: { deed?: Id; fact?: string }; origin: Id; day: number;
  truth: boolean /* rumours can be wrong */; carriers: Id[]; reached: { place: Id; day: number }[] }
interface TraderVisit { kind: 'SALTVIK_KNARR'|'GAELIC_PEDLAR'|'WANDERING_SMITH'|'SEA_WIFE'|'FENCE';
  traveller: Id; nextDay: number; conditions: Condition[]; stock: CargoLot[]; leads: Id[] }
interface BanditCamp { id: Id; place: Id /* a route or a wilderness site */; leader?: Id; members: Id[]; formedDay: number;
  status: 'FORMING'|'ACTIVE'|'BROKEN'; targets: Id[] }
interface EventCard extends BeatDef { deck: true; oneShot: true }
interface LivingWorldState { travellers: Record<Id, TravellerState>; banditCamps: Record<Id, BanditCamp>;
  news: Record<Id, NewsItem>; traders: TraderVisit[]; deck: { lastFiredDay?: number; active?: Id } }
```
- **Full and low detail.** Whatever is in the active or a streamed scene runs at full detail as actors. Everything else runs at low detail in the **world step**, once per game hour on foot and per watch at sea, on the `world` stream: travellers move leg by leg along the mainland's network (road legs and route crossings) at the times of Book 10 section 14, trade, rest and camp; places spend and refill their stores and move their people's moods; bandit camps grow, strike and scatter. The low-detail step applies the same rules in summary, so nothing is gained or lost by being watched. Moving between detail levels is lossless: a traveller entering a scene (a route being crossed, a site, a journey event) appears where its leg puts it; one leaving keeps its state.
- **Travellers** follow schedules with an origin, a destination and a reason (pilgrims to Kilbrecc, monks, herders driving cattle, Fiachra's riders, a travelling poet, traders' carts, tinkers, fugitives, refugees from Orm's raids). They can be talked to, traded with, helped, recruited or robbed, and each of those is a deed with witnesses (section 15). Named wanderers (the poet, the pedlar, the hermit, the disgraced warrior) are people with memories and recur across the campaign.
- **News** is carried, never broadcast. A deed's knowledge and any notable happening (a fire at Saltvik, a raid by Orm, a death at Ardcarn) become news items on the people who know them; a place learns when a carrier arrives, and passes it on with its own travellers. The steerer hears news by talking to a carrier, from a visiting trader, or in the morning report when a carrier reaches the home. Rumours can be wrong.
- **Visiting traders** come to the homestead on the Book 10 section 17 schedule (a Saltvik knarr in the sailing season, a Gaelic pedlar once the household is on the mainland, a wandering smith once a season, the sea-wife now and then, Ulf's men as fences for stolen goods). They arrive as travellers, whether or not the steerer is home, and bring goods, prices, news and leads.
- **Bandits:** outlaw camps form on routes and in wilderness sites when Book 10 section 17's conditions hold, take in fugitives, ambush routes and road legs, raid farms when unchecked (deeds against those places, carried as news) and break up when beaten, when their leader dies, or when they starve.
- **Leaders:** every settlement and camp has a named leader (`PlaceState.leader`), a person with friendship and fear (section 06).
- **The event deck** holds about forty cards (Book 4), each a beat with conditions that fit the moment. A governor draws at most one at day start on the `world` stream, keeping the Book 10 section 17 interval between cards, never during a tutorial and never while another is active; every card fires at most once per campaign (a one-shot, recorded before its effects). Content lint rejects any card that puts a child on stage.
- **Density** is a content and world-step target, measured by the living-world run (section 23): on a road or in a settlement a traveller or living event about every minute, on a route or in the wilderness a creature, sign or event every 30 to 60 seconds, and something worth stopping for every 20 to 30 seconds of walking (Book 10 sections 17 and 20).

## 26 / Prohibited shortcuts and the decision log
- Do not delete or bypass a locked feature to make a test pass.
- Do not use permanent primitive shapes or emoji in place of sprites.
- Do not read hidden truth into UI, audio or dialogue unless discovered.
- Do not introduce `Math.random()`, wall-clock time or frame-rate-dependent logic in the simulation.
- Do not rewrite accepted bargains or delete ledger or evidence entries.
- Do not hard-code tuning numbers; read them from `balance.json`.
- Do not add children as actors, sexual violence of any kind, or a player torture action.
- Do not make captives currency or add a slave-market loop: period views of thralls and the slave market may be spoken (section 16), never become a system.
- Do not add a bleed-out timer for the downed (section 12), or let the calendar force a story gate (section 16), except the one fixed night of the defence of Skarvholm (section 16).
- Do not refer to the steerer with gendered pronouns or terms, or apply period attitudes to women or men to the steerer.
- Do not add a tactical pause.
- Do not let the simulation read the pointer, the screen or the camera; devices make commands (section 21).

**Decision log:** `docs/decision-log.md`, one entry per departure: date, stage, decision, reason, alternatives, books affected, approved by.
