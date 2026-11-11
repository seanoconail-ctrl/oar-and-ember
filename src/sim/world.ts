/**
 * The world state (Book 2 section 05): one serialisable object holding everything a consequence
 * depends on. The ledger and evidence are append-only, facts are superseded but never deleted, the
 * dead stay in `people`, and one-shots are recorded before their effects apply.
 *
 * Fields that later stages fill (ships, homes' buildings, regions' resource nodes, knowledge,
 * bargains, powers) are present with their Book 2 shape and start empty.
 */
import { parseControlsBalance, parseStartingWeapons } from '../content/balance.ts';
import { parseStaminaBalance, parseWorkBalance } from '../content/homeBalance.ts';
import { campContext, setupCamp } from './home/camp.ts';
import { setReason } from './home/stamina.ts';
import type { PeopleBasics, TimeBalance } from '../content/balance.ts';
import type {
  ACTIVITY_KINDS,
  CODE_STANCES,
  CODES,
  Content,
  FAITHS,
  JOBS,
  JUDGEMENTS,
  LIKING_KINDS,
  MEMORY_KINDS,
  TIE_KINDS,
  TRAITS,
  VALUES,
} from '../content/registry.ts';
import { newPerson } from './people/person.ts';
import type { Id } from '../core/ids.ts';
import { seedAllStreams } from '../core/rng.ts';
import type { RngState, RngStream } from '../core/rng.ts';
import type { CalendarState } from './calendar/calendar.ts';
import { placeOnFoot } from './land/onFoot.ts';
import type { GroundItem, OnFootState } from './land/onFoot.ts';

/**
 * Version 2 (Stage 6) adds `onFoot`: where the steerer and the people nearby stand in a zone.
 * Version 3 (the Stage 6 rework) adds the steerer's hotbar (`player.hotbar`) and a drawn bow's aim
 * (`onFoot.player.aim`).
 * Version 4 (starting weapons and missiles, decisions DD-6 to DD-9) adds the steerer's inventory
 * with counts (`player.inventory`: arrows), the pickup tooltips already shown
 * (`player.tipsSeen`), an aim's distance (`aim.dist`), and in the zone the items lying there,
 * missiles in flight and missiles at rest (`onFoot.items`, `projectiles`, `nextMissile`, `stuck`).
 * Version 5 (Stage 7: day and night, shelter and first tasks) makes stamina the Book 2 section 24
 * shape (`player.stamina`: current, max, base and the reasons it is smaller; the collapse's
 * `staminaMaxChange` becomes the Exhausted reason), adds the steerer's condition (meals, sleep,
 * warmth, hours worked, wounds), the camp at home (stores with fresh fish by the day caught, the
 * fire, a building going up, the day's ration), a tended day on wounds, people's skills, the
 * zones out of view (`onFoot.elsewhere`) and the latest morning report.
 * Version 6 (Stage 8: crew agents, schedules and conversation) makes people Book 2 section 06's
 * shape: happiness, friendship and fear replace the single `regard`; codes, stance, traits (known or
 * still to discover), likes and dislikes, tendencies, the reasons for today's mood, a job, and their
 * day's bookkeeping (`life`: meals, the warning flow, talk, barks, a light-fingered stash); memories
 * gain a kind and a source; the world gains the conversation or scene under way (`talk`), the barks
 * heard (`barks`) and Book 2's disputes.
 * Version 7 (Stage 9: combat v1) adds the campaign's options that change the simulation (Second
 * wind, Rán's mercy, the parry window: Book 1 section 15), the game over (`gameOver`), and on foot
 * each person's part in a fight (`fight`: their state machine, vitality, stamina, side and mind),
 * the steerer's fighter, someone carried by another (`carries`), and the fight under way
 * (`battle`); the three wreck-scavengers join `people`.
 */
export const WORLD_STATE_VERSION = 7;

/** The difficulty options that change the simulation (Book 1 section 15; decision S9-9). */
export interface CampaignOptions {
  /** A short downed window in which an adjacent ally can lift the steerer once a scene. */
  secondWind: boolean;
  /** No unscripted crew deaths: what would kill them is a grave wound, or capture. */
  ransMercy: boolean;
  /** The parry window in ticks (Book 10: the default, up to the option's widest); null: Book 10's. */
  parryWindow: number | null;
}

export type Value = (typeof VALUES)[number];
export type TieKind = (typeof TIE_KINDS)[number];
export type Origin = 'NORSE' | 'GAELIC' | 'NORSE_GAELIC' | 'KEEPERS' | 'UNSTATED';
export type BodyModel = 'A' | 'B';
export type FactValue = string | number | boolean;

export type Code = (typeof CODES)[number];
export type CodeStance = (typeof CODE_STANCES)[number];
export type Trait = (typeof TRAITS)[number];
export type Faith = (typeof FAITHS)[number];
export type JobKind = (typeof JOBS)[number];
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type MemoryKind = (typeof MEMORY_KINDS)[number];
export type Judgement = (typeof JUDGEMENTS)[number];

export interface Tie {
  readonly to: Id;
  readonly kind: TieKind;
  /** Day it formed (0: before the campaign) and the shared event it grew from. */
  readonly since?: number;
  readonly cause?: string;
}

/**
 * A memory (Book 5 section 01): a significant event the person witnessed or was told of, with the
 * source. Memories drive conversation topics and are never deleted.
 */
export interface Memory {
  readonly day: number;
  readonly kind: MemoryKind;
  /** What it is about: a deed tag (RESCUE), an event (FIRE_LIT, WRECK), a death (THORKEL). */
  readonly about: string;
  readonly source: 'SAW' | 'TOLD';
  readonly deedId?: Id;
  /** A death or loss of someone tied to them (grief). */
  readonly tie?: boolean;
  /** An outcome remembered with it (a judgement's). */
  readonly detail?: string;
}

export interface Wound {
  readonly day: number;
  readonly severity: 'LIGHT' | 'SERIOUS' | 'GRAVE';
  readonly where: string;
  /** The day it was first tended (Book 10 section 08: an untended wound does not heal). */
  tendedDay?: number;
}

/** Book 2 section 06: a trait, known at once or discovered over time. */
export interface PersonTrait {
  readonly trait: Trait;
  known: boolean;
  readonly faith?: Faith;
  /** Revealed only by this event (Oddi's light-fingers by the theft found). */
  readonly revealedBy?: 'THEFT_FOUND';
  /** The day a hidden trait shows (Book 10 section 08: 5 to 20 days), drawn on joining. */
  discoverDay?: number;
}

export interface Liking {
  readonly kind: (typeof LIKING_KINDS)[number];
  readonly ref: string;
  known: boolean;
}

export interface MoodFactor {
  readonly cause:
    | 'FOOD'
    | 'WARMTH'
    | 'REST'
    | 'SAFETY'
    | 'SUCCESS'
    | 'GRIEF'
    | 'FESTIVAL'
    | 'TREATMENT'
    | 'LIKE'
    | 'DISLIKE'
    | 'TIE';
  readonly amount: number;
  /** A string key or tag: what it was ("hungry", "salt fish", "a cold night"). */
  readonly detail?: string;
}

/** Book 2 section 06, JobAssignment: the outcome the steerer asked for. */
export interface JobAssignment {
  readonly kind: JobKind;
  /** Day it was given (REST lasts the day it was given). */
  readonly since: number;
  readonly byOrder: boolean;
}

/** One track of the warning flow (Book 2 section 06): its steps, and when the last was taken. */
export interface WarningTrack {
  /** Steps taken: 0 none, 1 remark, 2 complaint, 3 refusal, 4 request to leave. */
  step: number;
  /** Steps due (each downward band crossing, or leaving's effect, adds them). */
  pending: number;
  lastDay: number | null;
}

/**
 * A person's day (Stage 8): what the three measures and the household day are computed from. Kept
 * in the world so a save resumes the day exactly.
 */
export interface PersonLife {
  /** The day they joined the household (null: not a resident yet). */
  joinedDay: number | null;
  /** Nights spent in the household (counted at each dawn). */
  nights: number;
  /** Meals today: how many, whether one was hot, and what was eaten. */
  meals: { day: number; count: number; hot: boolean; foods: string[] };
  /** The night just slept: by a fire that stayed lit, and in a bed. */
  night: { day: number; warm: boolean; bed: boolean } | null;
  /** The fire went out while they slept tonight. */
  coldTonight: boolean;
  /** Told a story at the fire, or heard one, today (Book 10 Storyteller). */
  storyDay: number;
  /** Mood that lasts days: success, grief, festival (Book 10 "Happiness inputs"). */
  lasting: {
    cause: 'SUCCESS' | 'GRIEF' | 'FESTIVAL';
    amount: number;
    fromDay: number;
    days: number;
    fade: boolean;
    detail: string;
  }[];
  /** Today's treatment and likes and dislikes met. */
  today: { day: number; treated: number; likes: string[]; dislikes: string[] };
  /** Campaign minute happiness fell below Book 10's lowHappiness (null: not low). */
  lowSince: number | null;
  /** The last day fear rose (fear decays on days without it). */
  fearDay: number;
  warning: { friendship: WarningTrack; happiness: WarningTrack };
  /** The friendship band last seen, and the rising steps already spoken (praise, offer, favour). */
  band: string;
  rising: number;
  /** Fear past the threshold (the fear line said), devotion reached. */
  feared: boolean;
  devoted: boolean;
  /** The work they refuse (the warning flow's refusal step). */
  refuses: JobKind[];
  /** A request to leave has been made (the departure itself is Stage 23's). */
  wantsToLeave: boolean;
  /** Lines owed to the steerer, said when next in earshot (warning steps, rising steps). */
  owed: string[];
  /** Friendship from time spent today (capped), and minutes worked beside the steerer. */
  time: { day: number; friendship: number; besideMinutes: number };
  /** Topics talked through, by topic id, with the day; pressing topics already raised. */
  topics: Record<string, number>;
  raised: string[];
  /** The tick of their next bark. */
  nextBark: number;
  /** The activity last minute (a light-fingered theft is tried on going to bed). */
  activity: ActivityKind | null;
  /** Food hidden in their bedding, in ration-days, and the day they last took any. */
  stash: number;
  lastTheftDay: number | null;
}

/** Book 2 section 06. */
export interface Person {
  id: Id;
  nameKey: string;
  origin: Origin;
  /** The sprite set; Book 7 section 11 names actors actor_<id>. */
  appearance: string;
  status: 'alive' | 'downed' | 'wounded' | 'sick' | 'dead' | 'missing' | 'captive';
  vitality: number;
  skills: Partial<Record<string, 0 | 1 | 2 | 3 | 4 | 5>>;
  skillXp: Partial<Record<string, number>>;
  values: Partial<Record<Value, 1 | 2 | 3>>;
  faithTarget?: Faith;
  /** One code, or two for people of mixed birth (Book 5 section 16). */
  codes: Code[];
  codeStance: CodeStance;
  traits: PersonTrait[];
  likes: Liking[];
  dislikes: Liking[];
  /** Small daily behaviours, by schedule: the household's tendency keys. */
  tendencies: string[];
  /** 0..100: mood now. */
  happiness: number;
  /** -100..100: how they feel about the steerer over time. */
  friendship: number;
  /** 0..100: how much they fear the steerer. */
  fear: number;
  /** The reasons for today's happiness, each with its share. */
  moodToday: MoodFactor[];
  ties: Tie[];
  memories: Memory[];
  wounds: Wound[];
  job?: JobAssignment;
  schedule: string;
  requests: Id[];
  secret?: Id;
  valueShifts: number;
  /** The day's bookkeeping (Stage 8). */
  life: PersonLife;
}

/** The conversation or scene under way (Book 8 section 09; Book 2 section 16). */
export interface TalkState {
  readonly kind: 'TALK' | 'SCENE';
  /** The resident spoken with (in a scene, the one it is about). */
  readonly with: Id;
  /** A scene: its beat, and who found it (null: the steerer). */
  readonly scene?: Id;
  readonly finder?: Id | null;
  /** The node shown (null: the topics). */
  node: string | null;
  /** The topics offered, by id. */
  topics: string[];
  /** The topic being talked through. */
  topic: string | null;
  /** Lines still to come, and the tick the next is due. */
  queue: { readonly speaker: Id; readonly key: string }[];
  nextLineTick: number;
  /** The line on screen. */
  line: { readonly speaker: Id | null; readonly key: string } | null;
  /** The scene's choice taken (its lines then play and it ends). */
  chosen: number | null;
  /** Ends once its lines have been said. */
  ending: boolean;
  readonly since: number;
}

/** Book 2 section 06. */
export interface Dispute {
  readonly id: Id;
  readonly kind:
    | 'THEFT'
    | 'INSULT'
    | 'FIGHT'
    | 'SHIRKING'
    | 'PLUNDER_SHARE'
    | 'BELIEF'
    | 'GRUDGE'
    | 'DEBT'
    | 'BROKEN_PROMISE';
  readonly day: number;
  readonly parties: readonly Id[];
  readonly cause: string;
  readonly watchers: readonly Id[];
  status: 'OPEN' | 'JUDGED' | 'IGNORED' | 'BOILED_OVER';
  judgement?: {
    readonly kind: Judgement;
    readonly favoured?: Id;
    readonly punished?: Id[];
    readonly day: number;
  };
}

export interface PlayerState {
  /** Chosen by the player (Stage 6); empty until then. */
  name: string;
  bodyModel: BodyModel | null;
  vitality: number;
  /** Book 2 section 24: the bar, its maximum and the reasons it is smaller (version 5). */
  stamina: Stamina;
  skills: Partial<Record<string, 0 | 1 | 2 | 3 | 4 | 5>>;
  gear: Id[];
  awake: boolean;
  /** What the steerer's condition depends on: meals, sleep, warmth and work (version 5). */
  condition: Condition;
  /** The steerer's own wounds (none until Stage 9's combat); they lower the bar's maximum. */
  wounds: Wound[];
  /** Book 2 section 21: the slots (Book 10 section 21, hotbarSlots) and the one in hand. */
  hotbar: Hotbar;
  /** Items carried by count rather than in a slot: arrows (Book 10 section 21, "Arrows"). */
  inventory: Record<Id, number>;
  /** Item kinds whose pickup tooltip has been shown; the help pages list them. */
  tipsSeen: Id[];
}

export interface Hotbar {
  slots: (Id | null)[];
  selected: number;
}

/** Book 2 section 24: why the bar is smaller (or, for a feast, larger). */
export type StaminaReason =
  | 'COLD'
  | 'HUNGRY'
  | 'STARVING'
  | 'WOUNDED'
  | 'BADLY_WOUNDED'
  | 'SICK'
  | 'TIRED'
  | 'EXHAUSTED'
  | 'HARD_WORK'
  | 'FEAST';

export interface StaminaReduction {
  readonly reason: StaminaReason;
  /** Taken off the maximum (a feast's is negative: it adds). */
  readonly amount: number;
  /** Campaign minute it began. */
  readonly since: number;
  readonly cause?: string;
}

export interface Stamina {
  /** 0..max. */
  current: number;
  /** base minus every reduction, never below Book 10's minimumMax. */
  max: number;
  base: number;
  reductions: StaminaReduction[];
  /** The tick stamina was last spent (regeneration waits Book 10's ticks after it). */
  spentTick: number;
}

/** What the steerer's condition reads (Book 10 section 06, "Stamina capacity"). */
export interface Condition {
  /** Campaign minute the steerer last woke, and last ate a meal (null: not since the campaign began). */
  wokeAt: number;
  lastMealAt: number | null;
  /** Meals in a row while starving (two end it). */
  mealsWhileStarving: number;
  /** Game minutes worked at tasks since waking. */
  workedMinutes: number;
  /** Game minutes spent warm (within a lit fire's reach) since becoming cold. */
  warmMinutes: number;
}

/** Book 2 section 15. */
export interface Deed {
  readonly id: Id;
  readonly tag: string;
  readonly day: number;
  readonly placeId: Id;
  /** 'HOUSEHOLD', or the ID of whoever else did it. */
  readonly doer: Id;
  readonly context: Readonly<Record<string, number | boolean | string>>;
  readonly victims: readonly Id[];
  readonly witnesses: readonly { readonly person: Id; readonly escaped: boolean }[];
  readonly identification: number;
  readonly marksSeen: readonly string[];
}

export interface Evidence {
  readonly id: Id;
  readonly kind: 'BODY' | 'ITEM' | 'TRACKS' | 'BURNED';
  readonly placeId: Id;
  readonly pos: { readonly x: number; readonly y: number };
  readonly deedIds: readonly Id[];
  readonly points: number;
  readonly discoverDay?: number;
}

/** Book 2 section 16. */
export interface ChapterState {
  status: 'LOCKED' | 'OPEN' | 'ACTIVE' | 'RESOLVED';
  openedDay?: number;
  resolvedDay?: number;
  resolvedBy?: string[];
}

/** Book 2 section 17. */
export interface Bargain {
  readonly id: Id;
  readonly power: Id;
  readonly parties: readonly Id[];
  readonly terms: readonly string[];
  readonly status: 'OFFERED' | 'ACCEPTED' | 'KEPT' | 'BROKEN' | 'ENDED';
  readonly acceptedDay?: number;
  readonly hash?: string;
}

export interface HomeState {
  place: Id;
  /** Book 7 section 06 stage, S0 (wreck camp) onwards. */
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'M0' | 'M1' | 'M2' | 'M3';
  buildings: Id[];
  /** RES_ id to amount: ration-days of food, loads of fuel (version 5: never below zero). */
  stores: Record<string, number>;
  /** Fresh fish by the day it was caught, in ration-days (it spoils after Book 10's days). */
  fresh: { rd: number; day: number }[];
  /** The camp fire: lit, and the loads of fuel left in it. */
  fire: { lit: boolean; fuel: number };
  /** A building going up: worker-minutes of labour done. */
  building: { id: Id; progress: number } | null;
  /** Fish hooked but not yet landed: a share of one fish. */
  catch: number;
  /** The day the day's ration was last served, and the days the stores fell short since. */
  rationDay: number;
  shortDays: number;
}

/** A sentence of the morning report: a string key and its values (Book 7 section 10: words). */
export interface ReportLine {
  readonly key: string;
  readonly vars: Readonly<Record<string, string | number>>;
}

/** The steward's morning report, v0 (Book 1 section 03; Book 2 section 02, Report mode). */
export interface MorningReport {
  readonly day: number;
  readonly lines: readonly ReportLine[];
}

export interface RegionState {
  discoveredZones: Id[];
  resourceNodes: Record<Id, { readonly nextDay: number }>;
  puzzles: Record<Id, string>;
}

export interface PlaceState {
  known: boolean;
  stores: Record<string, number>;
  people: Id[];
}

export interface FactionState {
  attitude: string;
  regard: number;
  fear: number;
  hostility: 'NONE' | 'WARY' | 'HOSTILE';
  knownDeeds: Id[];
}

export interface WorldState {
  readonly version: number;
  readonly seed: string;
  /** Ticks run since the campaign began. */
  tick: number;
  rng: Record<RngStream, RngState>;
  /** Tide is computed from the calendar (decision S2-5); weather arrives in Stage 13. */
  calendar: CalendarState;
  clock: { subMinute: number; dayLengthPercent: number };
  player: PlayerState;
  household: { residents: Id[]; hostages: Id[]; guests: Id[] };
  people: Record<Id, Person>;
  ships: Record<Id, unknown>;
  homes: Record<Id, HomeState>;
  regions: Record<Id, RegionState>;
  places: Record<Id, PlaceState>;
  factions: Record<Id, FactionState>;
  /** Append-only (see ledger.ts). */
  ledger: Deed[];
  /** Append-only (see ledger.ts). */
  evidence: Evidence[];
  knowledge: { places: Record<Id, 'RUMOURED' | 'KNOWN'> };
  bargains: Record<Id, Bargain>;
  powers: Record<Id, unknown>;
  chapters: Record<Id, ChapterState>;
  facts: Record<string, FactValue>;
  /** One-shot id and the day it fired; recorded before its effect applies. */
  oneShots: Record<Id, number>;
  /** The on-foot scene the steerer is in (decision S6-3); null at sea or in a world with no zone. */
  onFoot: OnFootState | null;
  /** The latest morning report (version 5), shown on waking. */
  report: MorningReport | null;
  /** Book 2 section 06 (version 6). */
  disputes: Dispute[];
  /** The conversation or scene under way (version 6). */
  talk: TalkState | null;
  /** Barks heard: by speaker and line, the tick each was last said (Book 8 section 08). */
  barks: { bySpeaker: Record<Id, Record<string, number>>; byLine: Record<string, number> };
  /** The campaign's options (version 7). */
  options: CampaignOptions;
  /** The steerer has died: the game is over until a save is loaded (version 7). */
  gameOver: { readonly day: number; readonly tick: number; readonly cause: string } | null;
}

/** A new steerer's stamina: full, at Book 10's base. */
export function freshStamina(base: number): Stamina {
  return { current: base, max: base, base, reductions: [], spentTick: 0 };
}

/** An empty world: the calendar and RNG only. Used by runtime tests that need no content. */
export function emptyWorld(seed: string, b: TimeBalance): WorldState {
  return {
    version: WORLD_STATE_VERSION,
    seed,
    tick: 0,
    rng: seedAllStreams(seed),
    calendar: { day: 1, minuteOfDay: b.dayStart },
    clock: { subMinute: 0, dayLengthPercent: 100 },
    player: {
      name: '',
      bodyModel: null,
      vitality: 0,
      stamina: freshStamina(0),
      skills: {},
      gear: [],
      awake: true,
      condition: {
        wokeAt: 0,
        lastMealAt: null,
        mealsWhileStarving: 0,
        workedMinutes: 0,
        warmMinutes: 0,
      },
      wounds: [],
      hotbar: { slots: [], selected: 0 },
      inventory: {},
      tipsSeen: [],
    },
    household: { residents: [], hostages: [], guests: [] },
    people: {},
    ships: {},
    homes: {},
    regions: {},
    places: {},
    factions: {},
    ledger: [],
    evidence: [],
    knowledge: { places: {} },
    bargains: {},
    powers: {},
    chapters: {},
    facts: {},
    oneShots: {},
    onFoot: null,
    report: null,
    disputes: [],
    talk: null,
    barks: { bySpeaker: {}, byLine: {} },
    options: { secondWind: false, ransMercy: false, parryWindow: null },
    gameOver: null,
  };
}

const CHAPTERS = [
  'CH_1_WRECK',
  'CH_2_FIRST_RAID',
  'CH_3_OPEN_COAST',
  'CH_4_NAME_ON_WATER',
  'CH_5_LONG_MEMORY',
  'CH_6_BORROWED_SHORE',
  'CH_7_GATHERING',
  'CH_8_SEA_KING',
] as const;

/** A new campaign: day 1, 06:00, on Wreck Strand, with Book 4 and 5 content laid out. */
export function newCampaign(
  seed: string,
  b: TimeBalance,
  basics: PeopleBasics,
  content: Pick<
    Content,
    'people' | 'places' | 'factions' | 'regions' | 'opening' | 'zoneMaps' | 'onFoot' | 'balance'
  > &
    Partial<Pick<Content, 'camp' | 'household'>>,
  steerer: { readonly name: string; readonly bodyModel: BodyModel | null } = {
    name: '',
    bodyModel: null,
  },
): WorldState {
  const world = emptyWorld(seed, b);
  world.player.name = steerer.name;
  world.player.bodyModel = steerer.bodyModel;
  world.player.vitality = basics.vitality;
  world.player.stamina = freshStamina(basics.stamina);
  // What the steerer has on waking (content/onfoot.json), in a hotbar of Book 10's size.
  const start = content.onFoot?.hotbar;
  if (start !== undefined) {
    const size = parseControlsBalance(content.balance).hotbarSlots;
    world.player.hotbar = {
      slots: Array.from({ length: size }, (_, i) => start.start[i] ?? null),
      selected: Math.min(start.selected, size - 1),
    };
  }
  for (const def of content.people.values()) {
    if (def.kind === 'PLAYER') continue;
    world.people[def.id] = newPerson(def, basics.vitality, content.balance);
  }
  // Starting skills (Book 10 section 08): the skills Book 5 names at their level, and the
  // steerer's level in every homestead task.
  const camp =
    content.camp == null ? null : campContext({ camp: content.camp, balance: content.balance });
  if (camp !== null) {
    const skills = parseWorkBalance(content.balance).startingSkills;
    for (const def of content.people.values()) {
      const person = world.people[def.id];
      if (person !== undefined)
        for (const s of def.skills ?? []) person.skills[s] = skills.named as 0 | 1 | 2 | 3 | 4 | 5;
    }
    for (const t of camp.tasks.values())
      world.player.skills[t.def.skill] = skills.steererTasks as 0 | 1 | 2 | 3 | 4 | 5;
  }
  for (const place of content.places.values()) {
    world.places[place.id] = {
      known: place.id === 'ISLE_SKARV' || place.region === 'REG_SK',
      stores: {},
      people: [...content.people.values()].filter((p) => p.home === place.id).map((p) => p.id),
    };
  }
  for (const faction of content.factions.values()) {
    world.factions[faction.id] = {
      attitude: faction.startAttitude,
      regard: 0,
      fear: 0,
      hostility: 'NONE',
      knownDeeds: [],
    };
  }
  for (const region of content.regions.values()) {
    world.regions[region.id] = { discoveredZones: [], resourceNodes: {}, puzzles: {} };
  }
  world.regions['REG_SK'] = { discoveredZones: ['ZONE_SK_STRAND'], resourceNodes: {}, puzzles: {} };
  world.homes['ISLE_SKARV'] = {
    place: 'ISLE_SKARV',
    stage: 'S0',
    buildings: [],
    stores: {},
    fresh: [],
    fire: { lit: false, fuel: 0 },
    building: null,
    catch: 0,
    rationDay: 1,
    shortDays: 0,
  };
  if (camp !== null) setupCamp(world, camp);
  world.knowledge.places['ISLE_SKARV'] = 'KNOWN';
  CHAPTERS.forEach((ch, i) => {
    world.chapters[ch] = i === 0 ? { status: 'ACTIVE', openedDay: 1 } : { status: 'LOCKED' };
  });
  // Chapter 1 beat 1: the steerer wakes on Wreck Strand; Hild lies beyond the rocks.
  const opening = content.opening;
  const strand = opening === null ? undefined : content.zoneMaps.get(opening.zone);
  if (opening !== null && strand !== undefined) {
    world.onFoot = placeOnFoot(
      strand,
      [opening.caller],
      opening.callerPose,
      zoneItems(content, strand.zone),
    );
    // The other zones keep what lies in them until walked into (the hand line at the camp).
    for (const zone of content.zoneMaps.keys()) {
      if (zone === strand.zone) continue;
      const items = zoneItems(content, zone);
      world.onFoot.elsewhere ??= {};
      world.onFoot.elsewhere[zone] = { actors: {}, items, stuck: [] };
    }
    // Washed ashore wet through on a spring morning: the steerer wakes cold (decision S7-9).
    if (camp !== null)
      setReason(world.player.stamina, parseStaminaBalance(content.balance), 'COLD', 0, 'wet');
  }
  return world;
}

/**
 * The items lying in a zone at the start (content/onfoot.json `pickups`): the seax in the wreck's
 * debris, and the bow with a quiver of Book 10's startingArrows by the wreck's stern.
 */
export function zoneItems(content: Pick<Content, 'onFoot' | 'balance'>, zone: Id): GroundItem[] {
  const starting = parseStartingWeapons(content.balance);
  return (content.onFoot?.pickups ?? [])
    .filter((p) => p.zone === zone)
    .map((p) => ({
      key: p.key,
      item: p.item,
      count: p.count,
      x: p.x,
      y: p.y,
      ...(p.quiver === true ? { arrows: starting.startingArrows } : {}),
      ...(p.after === undefined ? {} : { after: p.after }),
      ...(p.glint === true ? { glint: true } : {}),
    }));
}

/** The chapter currently being played, for save headers. */
export function activeChapter(world: WorldState): Id | null {
  return Object.entries(world.chapters).find(([, c]) => c.status === 'ACTIVE')?.[0] ?? null;
}
