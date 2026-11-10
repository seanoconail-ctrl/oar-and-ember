/**
 * The world state (Book 2 section 05): one serialisable object holding everything a consequence
 * depends on. The ledger and evidence are append-only, facts are superseded but never deleted, the
 * dead stay in `people`, and one-shots are recorded before their effects apply.
 *
 * Fields that later stages fill (ships, homes' buildings, regions' resource nodes, knowledge,
 * bargains, powers) are present with their Book 2 shape and start empty.
 */
import type { PeopleBasics, TimeBalance } from '../content/balance.ts';
import type { Content, VALUES, TIE_KINDS } from '../content/registry.ts';
import type { Id } from '../core/ids.ts';
import { seedAllStreams } from '../core/rng.ts';
import type { RngState, RngStream } from '../core/rng.ts';
import type { CalendarState } from './calendar/calendar.ts';

export const WORLD_STATE_VERSION = 1;

export type Value = (typeof VALUES)[number];
export type TieKind = (typeof TIE_KINDS)[number];
export type Origin = 'NORSE' | 'GAELIC' | 'NORSE_GAELIC' | 'KEEPERS' | 'UNSTATED';
export type BodyModel = 'A' | 'B';
export type FactValue = string | number | boolean;

export interface Tie {
  readonly to: Id;
  readonly kind: TieKind;
}

export interface Memory {
  readonly day: number;
  readonly about: string;
  readonly deedId?: Id;
}

export interface Wound {
  readonly day: number;
  readonly severity: 'LIGHT' | 'SERIOUS' | 'GRAVE';
  readonly where: string;
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
  faithTarget?: 'OLD_GODS' | 'CHRIST' | 'LAND_SPIRITS' | 'NONE';
  /** -100 to 100, towards the player. */
  regard: number;
  ties: Tie[];
  memories: Memory[];
  wounds: Wound[];
  job?: { readonly kind: string; readonly site?: Id };
  schedule: string;
  hiddenStance?: Id;
  valueShifts: number;
}

export interface PlayerState {
  /** Chosen by the player (Stage 6); empty until then. */
  name: string;
  bodyModel: BodyModel | null;
  vitality: number;
  stamina: number;
  skills: Partial<Record<string, 0 | 1 | 2 | 3 | 4 | 5>>;
  gear: Id[];
  awake: boolean;
  /** Change to maximum stamina for the current day (the collapse penalty, Book 10). */
  staminaMaxChange: number;
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
  stores: Record<string, number>;
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
      stamina: 0,
      skills: {},
      gear: [],
      awake: true,
      staminaMaxChange: 0,
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
  content: Content,
): WorldState {
  const world = emptyWorld(seed, b);
  world.player.vitality = basics.vitality;
  world.player.stamina = basics.stamina;
  for (const def of content.people.values()) {
    if (def.kind === 'PLAYER') continue;
    world.people[def.id] = {
      id: def.id,
      nameKey: def.nameKey,
      origin: 'UNSTATED',
      appearance: `actor_${def.id.toLowerCase()}`,
      // Chapter 1: the starting crew are lost in the wreck until found (Book 4 section 08).
      status: def.kind === 'RESIDENT' ? 'missing' : 'alive',
      vitality: basics.vitality,
      skills: {},
      skillXp: {},
      values: { ...(def.values ?? {}) },
      regard: 0,
      ties: (def.ties ?? []).map((t) => ({ to: t.to, kind: t.kind })),
      memories: [],
      wounds: [],
      schedule: 'default',
      valueShifts: 0,
    };
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
  world.homes['ISLE_SKARV'] = { place: 'ISLE_SKARV', stage: 'S0', buildings: [], stores: {} };
  world.knowledge.places['ISLE_SKARV'] = 'KNOWN';
  CHAPTERS.forEach((ch, i) => {
    world.chapters[ch] = i === 0 ? { status: 'ACTIVE', openedDay: 1 } : { status: 'LOCKED' };
  });
  return world;
}

/** The chapter currently being played, for save headers. */
export function activeChapter(world: WorldState): Id | null {
  return Object.entries(world.chapters).find(([, c]) => c.status === 'ACTIVE')?.[0] ?? null;
}
