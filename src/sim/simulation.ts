/**
 * The simulation root (Book 2 sections 02 and 03): one serialisable state, advanced by a fixed
 * 60 Hz tick. All changes arrive as commands, applied at the start of a tick in the order they
 * were submitted; systems report what happened as events. No wall-clock time or Math.random here.
 *
 * Systems so far: the calendar and the on-foot clock with sleep and collapse (Stage 2); the
 * on-foot controller, interaction and carrying, and Chapter 1 beat 1 on Wreck Strand (Stage 6);
 * picking up, the inventory with counts, the shove, and missiles loosed standing still with their
 * flight, spread, cover, shields and rest (decisions DD-6 to DD-9); the camp at home, hands-on
 * tasks with their game time and stamina, stamina and condition, sleep in a bed, the day's start
 * and the morning report, walking between zones, and Hild leading to the broch (Stage 7); people
 * with happiness, friendship and fear, schedules, jobs and delegation, conversation, barks, the
 * warning flow and scenes (Stage 8).
 */
import { applyDev } from './dev.ts';
import type { DevCommand } from './dev.ts';
import type { TimeBalance } from '../content/balance.ts';
import type { StaminaBalance } from '../content/homeBalance.ts';
import { EventBus } from '../core/events.ts';
import { hashValue } from '../core/hash.ts';
import { emptyWorld, WORLD_STATE_VERSION } from './world.ts';
import type { WorldState } from './world.ts';
import {
  advanceMinutes,
  clockText,
  minutesIntoDay,
  seasonOf,
  seasonDay,
  tideAt,
  watchOf,
  yearOf,
} from './calendar/calendar.ts';
import type { TidePhase, Watch } from './calendar/calendar.ts';
import type { Season } from '../content/balance.ts';
import type { OpeningDef } from '../content/registry.ts';
import type { Id } from '../core/ids.ts';
import {
  applyInteraction,
  facingOf,
  inReach,
  interactionAt,
  interactionNow,
  itemShown,
  stepActor,
  stepMovement,
  stuckRecoverable,
  TICKS_PER_SECOND,
} from './land/onFoot.ts';
import type {
  Aim,
  Interaction,
  ItemRules,
  LandContext,
  MissileKind,
  RefusalReason as OnFootRefusal,
  TilePos,
} from './land/onFoot.ts';
import { stepArcher } from './land/archer.ts';
import {
  broughtTo,
  campReached,
  duskBargain,
  duskBargainAt,
  seeMissile,
  sidestepsMissile,
  steererFace,
  steererHeal,
  steererLockOn,
  steererSneak,
  stepDuskAway,
  stepStance,
  crewOrder,
  finishOffer,
  sparedDay,
  startFinisher,
  steererSpare,
  hostilesAware,
  leaveZone,
  meleePress,
  meleeRelease,
  endInBargain,
  spawnEncounters,
  startFight,
  steererBlock,
  steererDodge,
  steererFighter,
  steererParry,
  steererShove,
  stepFight,
  missileStruck,
  BINDING,
  RATION,
} from './land/fight.ts';
import { aboveTideLine, terrainAt, tileOf } from './land/zoneMap.ts';
import type { FightContext, FightEvent, FightWorld } from './land/fight.ts';
import { expireStuck, gameMinute, launch, STEERER, stepProjectiles } from './land/missiles.ts';
import { updateExhausted } from './combat/fighter.ts';
import type { MissileEvent } from './land/missiles.ts';
import { bandAt, isDeep, stillWaterLevel } from './land/water.ts';
import { seaBurialActive } from './narrative/seaBurial.ts';
import {
  byTheFire,
  homeOf,
  campaignMinute,
  campUseAt,
  campUseNear,
  campUses,
  eat,
  feedFire,
  finishWork,
  homeMinute,
  isTimed,
  markTick,
  morningReport,
  sleepAllowed,
  startDay,
  timingQuality,
  workTicks,
} from './home/camp.ts';
import type { CampContext, CampEvent, NightRecord, PlacedUse, SiteUse } from './home/camp.ts';
import { clearReasons, hasReason, setReason, traversalTick, updateMax } from './home/stamina.ts';
import { edgeAt, entryPoint, linkOf, switchZone } from './land/zoneLinks.ts';
import { stepBroch } from './narrative/broch.ts';
import {
  chooseSearch,
  galeHolds,
  galeRefused,
  searchHolds,
  searchLifted,
  searchSetDown,
  searchPlacedUses,
  startSearchTalk,
  stepSearches,
} from './narrative/searches.ts';
import type { SearchContext, SearchEvent } from './narrative/searches.ts';
import {
  addShipWork,
  boatLooked,
  chooseRepair,
  repairActionDone,
  repairPlacedUses,
  repairSetDown,
  repairsHold,
  stepRepairs,
  takeOar,
} from './narrative/repairs.ts';
import type { RepairEvent, RepairsContext } from './narrative/repairs.ts';
import {
  closeSeaMap,
  FACT_LAUNCHED,
  launchActive,
  launchHolds,
  markSail,
  nameShip,
  startLaunch,
  stepLaunch,
} from './narrative/launch.ts';
import type { LaunchContext, LaunchEvent } from './narrative/launch.ts';
import { addHeld, stepTelemetry } from './narrative/telemetry.ts';
import { onLifted, onSetDown, onTideRefusal, stepOpening } from './narrative/opening.ts';
import {
  chestInteract,
  finishWreckWork,
  interactFirst,
  isWreckWork,
  netInteract,
  runaAnswer,
  runaAsks,
  rescueSetDown,
  startHagStone,
  stepMast,
  stepWreck,
  stepWreckPhase,
  wreckCommand,
  wreckHolds,
  wreckLifted,
  wreckPhase,
  wreckPickUp,
  wreckPlacedUses,
  wreckSetDown,
  wreckUse,
  wreckWorkCancelled,
} from './narrative/wreck.ts';
import type { WreckContext, WreckEvent, WreckHooks } from './narrative/wreck.ts';
import { stepAims } from './narrative/aims.ts';
import type { AimEvent, AimsContext } from './narrative/aims.ts';
import { edgeKindAt, stepEdges } from './land/edges.ts';
import type { EdgeEvent } from './land/edges.ts';
import { doorAt, doorsHere, openDoor, stepDoors } from './land/doors.ts';
import type { DoorEvent, DoorTimings } from './land/doors.ts';
import type { OpeningEvent } from './narrative/opening.ts';
import type { PeopleContext } from './people/context.ts';
import { joinNew, peopleDawn, peopleMinute, residents, stepPeopleTick } from './people/day.ts';
import { householdDeed, remember, tended } from './people/deeds.ts';
import type { PeopleEvent } from './people/events.ts';
import { chooseScene, sceneMinute } from './people/scenes.ts';
import { assignJob, barkTick, chooseTalk, endTalk, startTalk, talkTick } from './people/talk.ts';
import type { JobKind } from './world.ts';

/** The simulation runs on the world state of Book 2 section 05 (src/sim/world.ts). */
export type SimState = WorldState;
export const SIM_STATE_VERSION = WORLD_STATE_VERSION;

/** Crew orders (Book 2 section 12), carried out by the crew in the zone (Stage 9). */
export type CrewOrder = 'FOLLOW' | 'HOLD' | 'ATTACK' | 'PROTECT' | 'CARRY' | 'WITHDRAW';

export type Command =
  | { readonly type: 'SLEEP' }
  | { readonly type: 'SET_DAY_LENGTH'; readonly multiplier: number }
  | { readonly type: 'CREW_ORDER'; readonly order: CrewOrder }
  /** The movement wanted from now on: a vector of length at most 1, and the gait buttons. */
  | {
      readonly type: 'MOVE';
      readonly x: number;
      readonly y: number;
      readonly run: boolean;
      readonly sneak: boolean;
    }
  | { readonly type: 'INTERACT' }
  /**
   * Book 2 section 21: the input layer turns the pointer, the stick or the facing into a target
   * tile and sends these; the simulation never sees a pointer or the screen.
   */
  | { readonly type: 'SELECT_SLOT'; readonly slot: number }
  | { readonly type: 'USE_AT'; readonly slot: number; readonly tile: TilePos }
  | { readonly type: 'INTERACT_AT'; readonly tile: TilePos }
  /**
   * Drawing a bow towards one of AIM_DIRECTIONS (0 east, clockwise), or null to loose. `dist` is
   * how far the aim point is, in tiles (the cursor's ground point); absent or null, the shot flies
   * to the weapon's full range.
   */
  | { readonly type: 'AIM'; readonly dir: number | null; readonly dist?: number | null }
  /** Lowers a drawn bow without loosing: no arrow is spent (right-click, Escape or pad B). */
  | { readonly type: 'CANCEL_AIM' }
  /** The timing press during a timed hands-on action (Book 2 section 07); ignored on plain work. */
  | { readonly type: 'WORK_PRESS' }
  /** Stops a hands-on action before it ends: nothing is done and nothing is spent. */
  | { readonly type: 'CANCEL_WORK' }
  /** A shove with empty hands or the shove key, towards a tile (or the facing). */
  | { readonly type: 'SHOVE'; readonly tile?: TilePos }
  /**
   * Stage 9 (Book 2 section 12): the melee press (the charge begins; it is a light attack if let go
   * before level 1) towards a facing, and its release; parry; block held or let go; dodge along a
   * direction (none: straight back); the finisher held or let go.
   */
  | { readonly type: 'MELEE'; readonly facing: 's' | 'n' | 'e' | 'w' }
  | { readonly type: 'MELEE_RELEASE' }
  | { readonly type: 'PARRY' }
  | { readonly type: 'BLOCK'; readonly on: boolean }
  | { readonly type: 'DODGE'; readonly x: number; readonly y: number }
  | { readonly type: 'FINISHER'; readonly on: boolean }
  /** The user's third playtest (decision DG-2): let a beaten foe go (G; a pad's A in context). */
  | { readonly type: 'SPARE' }
  /**
   * Combat v2 (Book 2 section 12, decisions DE-2, DE-3, DE-8 and DE-9): the stance's aim towards
   * one of AIM_DIRECTIONS (null: none; keyboard-only play sends the way last moved); the lock-on
   * key pressed or let go (a tap switches, a hold releases); the sneak key (a toggle); binding a
   * wound or eating.
   */
  | { readonly type: 'FACE'; readonly dir: number | null }
  | { readonly type: 'LOCK_ON'; readonly down: boolean }
  | { readonly type: 'SNEAK' }
  | { readonly type: 'HEAL' }
  /** The difficulty options that change the simulation (Book 1 section 15), from the menu. */
  | { readonly type: 'SET_OPTIONS'; readonly secondWind?: boolean; readonly ransMercy?: boolean }
  /** Stage 8: talk to a resident; choose an option in the conversation or scene; leave it. */
  | { readonly type: 'TALK'; readonly person: Id }
  | { readonly type: 'TALK_CHOOSE'; readonly index: number }
  | { readonly type: 'TALK_END' }
  /** Delegation (Book 1 section 10): give a resident a job. */
  | { readonly type: 'ASSIGN_JOB'; readonly person: Id; readonly job: JobKind }
  /** Stage 12: start a story gate from its readiness screen (Book 2 section 16). */
  | { readonly type: 'START_GATE'; readonly gate: Id }
  /** The boat's name and its sail's mark, given at the launch (Book 7 section 04). */
  | { readonly type: 'NAME_SHIP'; readonly name: string }
  | { readonly type: 'MARK_SAIL'; readonly pattern: string; readonly dye: string | null }
  /** The sea map shown at the launch is closed: Chapter 1 ends. */
  | { readonly type: 'CLOSE_SEA_MAP' }
  /** Real milliseconds a menu held the game (time stopped), for the telemetry. */
  | { readonly type: 'TIME_HELD'; readonly ms: number }
  /** The developer menu's commands (decision DG-21; src/sim/dev.ts), recorded like any other. */
  | DevCommand;

/** Aim vectors are quantised to this many directions, so replays are exact. */
export const AIM_DIRECTIONS = 64;
/** Aim distances are quantised to this fraction of a tile. */
export const AIM_DIST_STEPS = 16;

export type RefusalReason =
  | 'TOO_EARLY_TO_SLEEP'
  | 'DAY_LENGTH_OUT_OF_RANGE'
  | 'NOT_ON_FOOT'
  | 'NOTHING_IN_REACH'
  | 'OUT_OF_REACH'
  | 'NOTHING_THERE'
  | 'NOTHING_TO_USE_ON'
  | 'EMPTY_SLOT'
  | 'NO_SUCH_SLOT'
  /** A draw refused: the quiver is empty (detail: the bow). */
  | 'NO_ARROWS'
  /** Stage 12: the launch cannot start (detail: why). */
  | 'GATE_REFUSED'
  | 'HOTBAR_FULL'
  | 'QUIVER_FULL'
  | 'HANDS_FULL'
  /** Stage 7: no bed in reach to sleep in; nothing to light, cook or eat; no water to fish. */
  | 'NO_BED'
  | 'NO_DRIFTWOOD'
  | 'NO_FOOD'
  | 'NO_WATER'
  /** The bar ran empty carrying: a person cannot be lifted until it recovers. */
  | 'TOO_TIRED'
  /** Stage 8: a resident asleep cannot be talked to; one already in a conversation. */
  | 'ASLEEP'
  | 'BUSY'
  | OnFootRefusal;

export type SimEvent =
  | { readonly type: 'WATCH_STARTED'; readonly day: number; readonly watch: Watch }
  | { readonly type: 'TIDE_TURNED'; readonly day: number; readonly phase: TidePhase }
  | {
      readonly type: 'SEASON_STARTED';
      readonly day: number;
      readonly season: Season;
      readonly year: number;
    }
  | { readonly type: 'SLEPT'; readonly day: number; readonly at: string }
  | { readonly type: 'COLLAPSED'; readonly day: number; readonly at: string }
  | {
      readonly type: 'WOKE';
      readonly day: number;
      readonly at: string;
      readonly cause: 'slept' | 'collapsed';
    }
  | { readonly type: 'MORNING_REPORT_DUE'; readonly day: number }
  | { readonly type: 'DAY_LENGTH_CHANGED'; readonly percent: number }
  | { readonly type: 'CREW_ORDER_GIVEN'; readonly order: CrewOrder; readonly tick: number }
  | { readonly type: 'PERSON_LIFTED'; readonly person: Id }
  | { readonly type: 'PERSON_SET_DOWN'; readonly person: Id; readonly aboveTideLine: true }
  | { readonly type: 'SLOT_SELECTED'; readonly slot: number; readonly item: Id | null }
  | { readonly type: 'BOW_DRAWN'; readonly item: Id }
  /** The steerer loosed a missile (`n`, now in flight). */
  | {
      readonly type: 'BOW_LOOSED';
      readonly item: Id;
      readonly drawTicks: number;
      readonly n: number;
    }
  /** A draw let go without a shot: cancelled, or released before Book 10's minDraw. */
  | {
      readonly type: 'DRAW_CANCELLED';
      readonly item: Id;
      readonly reason: 'CANCELLED' | 'TOO_SOON';
    }
  /** Anyone loosed a missile (the steerer, crew or enemies). */
  | {
      readonly type: 'MISSILE_LOOSED';
      readonly n: number;
      readonly kind: MissileKind;
      readonly shooter: Id;
    }
  | MissileEvent
  /** Picked up: `first` the first time the steerer has had one of this kind (its tooltip is due). */
  | {
      readonly type: 'ITEM_PICKED_UP';
      readonly item: Id;
      readonly count: number;
      readonly first: boolean;
    }
  | { readonly type: 'SHOVED'; readonly facing: 's' | 'n' | 'e' | 'w' }
  | OpeningEvent
  | CampEvent
  | PeopleEvent
  | FightEvent
  | SearchEvent
  | RepairEvent
  | LaunchEvent
  /** Design addendum 2.4: the opening, the aims, the edges' captions and the doors. */
  | WreckEvent
  | AimEvent
  | EdgeEvent
  | DoorEvent
  /** The held finisher has begun on someone (Book 10 finisherHold). */
  | { readonly type: 'FINISHER_STARTED'; readonly target: Id }
  /** The steerer walked on into another zone. */
  | { readonly type: 'ZONE_ENTERED'; readonly zone: Id; readonly from: Id }
  /** Combat v2 (decision DE-12): the camp reached the first time in a day: a checkpoint is due. */
  | { readonly type: 'CAMP_REACHED'; readonly day: number }
  /** The steerer lay down in a bed; the night passes after the camp's sleepSeconds. */
  | { readonly type: 'FELL_ASLEEP'; readonly site: string }
  /** The bar ran empty carrying someone: they are set down where the steerer stands. */
  | { readonly type: 'LOAD_DROPPED'; readonly person: Id }
  | {
      readonly type: 'COMMAND_REFUSED';
      readonly command: Command['type'];
      readonly reason: RefusalReason;
      readonly detail: string;
    };

/**
 * Unit vectors of the aim directions, rounded to 1/4096 so every engine stores the same numbers
 * (y runs south: direction 16 is south).
 */
const AIM_UNIT: readonly (readonly [number, number])[] = Array.from(
  { length: AIM_DIRECTIONS },
  (_, i) => {
    const a = (i / AIM_DIRECTIONS) * 2 * Math.PI;
    return [Math.round(Math.cos(a) * 4096) / 4096, Math.round(Math.sin(a) * 4096) / 4096] as const;
  },
);

/** Each tick adds this many units to clock.subMinute; integer arithmetic keeps replays exact. */
export const TICK_UNITS = 100;

/** Units per game minute: ticks per minute (secondsPerHour x multiplier) times TICK_UNITS. */
function unitsPerMinute(b: TimeBalance, percent: number): number {
  // (secondsPerHour s/h * 60 ticks/s / 60 min/h) * (percent / 100) * TICK_UNITS
  return b.secondsPerHour * percent;
}

/** A world with only the calendar and RNG, for runtime tests. Campaigns use newCampaign. */
export function initialState(seed: string, b: TimeBalance): SimState {
  return emptyWorld(seed, b);
}

export function stateHash(state: SimState): string {
  return hashValue(state);
}

export interface Simulation {
  readonly state: SimState;
  readonly events: EventBus<SimEvent>;
  /** Queues a command for the start of the next tick. */
  submit(command: Command): void;
  /** Runs one 60 Hz tick. */
  step(): void;
  /**
   * Replaces the whole world with a loaded one (game over's reload, Book 2 section 20): the same
   * state object takes the loaded world's fields, so everything holding it sees the new world.
   */
  restore(world: SimState): void;
}

/** What the on-foot systems need: zone maps, Book 10 speeds and the controller rules. */
export interface SimWorldContext extends LandContext {
  readonly opening: OpeningDef | null;
  /** Book 10 section 06: stamina in traversal and its capacity. */
  readonly stamina?: StaminaBalance;
  /** The camp at home and its tasks (Stage 7). */
  readonly camp?: CampContext | null;
  /** The household's people: their day, talk and scenes (Stage 8). */
  readonly people?: PeopleContext | null;
  /** Fights (Stage 9): weapons, fighters, encounters, safe places, Book 10's combat numbers. */
  readonly fight?: FightContext | null;
  /** Chapter 1's three searches and the Hag's Seat's sign (Stage 10). */
  readonly searches?: SearchContext | null;
  /** Chapter 1's repairs, the first fitting and Thorkel's rites (Stage 11). */
  readonly repairs?: RepairsContext | null;
  /** Chapter 1's gate, the launch (Stage 12). */
  readonly launch?: LaunchContext | null;
  /** Design addendum 2.4: the opening (src/sim/narrative/wreck.ts) and Chapter 1's aims. */
  readonly wreck?: WreckContext | null;
  readonly aims?: AimsContext | null;
  /** Book 10 section 25's doors and edge captions (decisions DE-25 and DE-26). */
  readonly doors?: DoorTimings | null;
  readonly edgeCaption?: { readonly afterSeconds: number; readonly cooldownSeconds: number } | null;
}

export function createSimulation(
  b: TimeBalance,
  state: SimState,
  land: SimWorldContext | null = null,
): Simulation {
  if (state.version !== SIM_STATE_VERSION) {
    throw new Error(`Simulation state version ${state.version} is not ${SIM_STATE_VERSION}`);
  }
  const events = new EventBus<SimEvent>();
  let queue: Command[] = [];

  const camp = land?.camp ?? null;
  const people = land?.people ?? null;
  const fightCtx = land?.fight ?? null;
  const searchCtx = land?.searches ?? null;
  const repairCtx = land?.repairs ?? null;
  const launchCtx = land?.launch ?? null;
  const wreckCtx = land?.wreck ?? null;
  const aimsCtx = land?.aims ?? null;
  const sb = land?.stamina ?? null;
  const emitPeople = (e: PeopleEvent | CampEvent): void => {
    events.emit(e);
    if (people === null || camp === null) return;
    // What the household remembers of the camp's work, and the care of a tended wound.
    const here = residents(state);
    if (e.type === 'WOUND_TENDED') tended(state, people, e.person, emitPeople);
    if (e.type === 'FIRE_LIT') remember(state, here, 'FIRE_LIT');
    if (e.type === 'FISH_LANDED') remember(state, here, 'FIRST_FISH');
    if (e.type === 'CAMP_STAGE' && e.stage === 'S1') {
      remember(state, here, 'SHELTER');
      // A building finished is a success (Book 10 "Happiness inputs").
      for (const id of here)
        state.people[id]?.life.lasting.push({
          cause: 'SUCCESS',
          amount: people.b.inputs.success.amount,
          fromDay: state.calendar.day,
          days: people.b.inputs.success.days,
          fade: false,
          detail: 'shelter',
        });
    }
  };
  const emitCamp = (e: CampEvent): void => {
    emitPeople(e);
  };
  /** A resident speaks (a line from the camp's work, in their voice). */
  const sayAs = (person: Id, lineKey: string): void => {
    events.emit({ type: 'PERSON_SPOKE', person, lineKey });
  };
  /** Hild's lines at the camp (the opening's caller). */
  const sayHild = (lineKey: string): void => {
    const who = land?.opening?.caller;
    if (who === undefined) return;
    // Design addendum 2.4: Hild is not always at the camp now; she speaks only in earshot.
    const wc = land?.wreck ?? null;
    const onFoot = state.onFoot;
    if (wc !== null && onFoot !== null) {
      const a = onFoot.actors[who];
      if (
        a === undefined ||
        Math.hypot(a.x - onFoot.player.x, a.y - onFoot.player.y) > wc.earshotTiles * 24
      )
        return;
    }
    events.emit({ type: 'PERSON_SPOKE', person: who, lineKey });
  };
  /** Where the steerer is, for the fire's warmth. */
  const steererAt = (): { zone: Id; x: number; y: number; tile: number } | null => {
    const onFoot = state.onFoot;
    if (onFoot === null) return null;
    const tile = land?.maps.get(onFoot.zone)?.tile ?? 24;
    return { zone: onFoot.zone, x: onFoot.player.x, y: onFoot.player.y, tile };
  };
  /** Sets a reason at its Book 10 amount (or, with no stamina balance, the collapse's own). */
  const addReason = (reason: Parameters<typeof setReason>[2], cause?: string): void => {
    const st = state.player.stamina;
    if (sb !== null) {
      if (!hasReason(st, reason)) {
        setReason(st, sb, reason, campaignMinute(state, b), cause);
        events.emit({ type: 'REASON_ADDED', reason });
      }
      return;
    }
    if (reason !== 'EXHAUSTED' || hasReason(st, reason)) return;
    st.reductions = [
      ...st.reductions,
      { reason, amount: -b.collapse.staminaMaxChange, since: campaignMinute(state, b) },
    ];
    st.max = st.base - st.reductions.reduce((s, r) => s + r.amount, 0);
    st.current = Math.min(st.current, st.max);
  };
  const liftReasons = (reasons: Parameters<typeof clearReasons>[2]): void => {
    const st = state.player.stamina;
    if (sb !== null) {
      for (const r of clearReasons(st, sb, reasons))
        events.emit({ type: 'REASON_LIFTED', reason: r });
      return;
    }
    st.reductions = st.reductions.filter((r) => !reasons.includes(r.reason));
    st.max = st.base - st.reductions.reduce((s, r) => s + r.amount, 0);
  };

  /**
   * Waking (Book 2 section 03): the rest lifts or sets its reasons (Book 10 section 06), the day
   * starts (spoilage, the ration, wounds mending) and the morning report is written.
   */
  const wake = (cause: 'slept' | 'collapsed', night: NightRecord): void => {
    state.clock.subMinute = 0;
    state.player.awake = true;
    if (state.onFoot !== null) state.onFoot.player.sleep = null;
    const restMinutes = sb?.fullRestMinutes ?? 0;
    const shortMinutes = sb?.shortSleepMinutes ?? 0;
    if (cause === 'collapsed') addReason('EXHAUSTED', 'collapse');
    else {
      liftReasons(['HARD_WORK']);
      if (night.slept >= restMinutes) liftReasons(['TIRED', 'EXHAUSTED']);
      else if (night.slept < shortMinutes) addReason('TIRED', 'short sleep');
    }
    if (night.cold) addReason('COLD', 'night');
    const c = state.player.condition;
    c.wokeAt = campaignMinute(state, b);
    // A night's sleep brings the steerer's vitality back, less what light wounds take (Stage 9).
    if (fightCtx !== null && state.gameOver === null) {
      const lights = state.player.wounds.filter((w) => w.severity === 'LIGHT').length;
      state.player.vitality = fightCtx.cb.vitality - fightCtx.cb.lightWoundVitality * lights;
    }
    c.workedMinutes = 0;
    const day = state.calendar.day;
    if (camp !== null) {
      startDay(state, camp);
      const plans = people === null ? [] : peopleDawn(state, people, camp, emitPeople);
      state.report = morningReport(state, camp, night, (id) => id, plans);
    }
    events.emit({ type: 'WOKE', day, at: clockText(state.calendar.minuteOfDay), cause });
    // The scheduler's daily entry for the spared (decision DG-6; src/sim/land/fight.ts).
    if (fightCtx !== null) {
      if (state.facts[FACT_LAUNCHED] === true && state.facts['spared.launchDay'] === undefined)
        state.facts['spared.launchDay'] = state.chapters['CH_1_WRECK']?.resolvedDay ?? day;
      const launchDay = state.facts['spared.launchDay'];
      sparedDay(state, fightCtx, emitFight, typeof launchDay === 'number' ? launchDay : null);
    }
    if (seasonDay(day) === 1) {
      events.emit({ type: 'SEASON_STARTED', day, season: seasonOf(day), year: yearOf(day) });
    }
    events.emit({ type: 'MORNING_REPORT_DUE', day });
  };

  /** Runs `minutes` game minutes through the home step (a task's time, a night), quietly. */
  const advanceBy = (minutes: number, onMinute?: () => void): void => {
    for (let i = 0; i < minutes; i++) {
      advanceOneMinute(true);
      onMinute?.();
    }
  };

  /** The night: from now to the next dawn, through the home step; cold if the fire was out. */
  const nightPasses = (): void => {
    const from = minutesIntoDay(state.calendar, b);
    events.emit({
      type: 'SLEPT',
      day: state.calendar.day,
      at: clockText(state.calendar.minuteOfDay),
    });
    state.player.awake = false;
    let cold = false;
    const minutes = 1440 - from;
    advanceBy(minutes, () => {
      if (camp !== null && state.onFoot !== null && !byTheFire(state, camp, steererAt()))
        cold = true;
    });
    wake('slept', { slept: minutes, cold, collapsed: false });
  };

  /** Minutes into the day at which an awake steerer collapses (02:00 is 1200 after 06:00). */
  const collapseAt = (b.dayEnd - b.dayStart + 1440) % 1440;
  /** Earliest minute into the day a bed ends the day (18:00 is 720 after 06:00). */
  const sleepFrom = (b.sleepAfter - b.dayStart + 1440) % 1440;

  const apply = (command: Command): void => {
    // The sea taking Thorkel (DG-14) is a scene that takes control: only the options and the
    // telemetry are taken until it ends.
    if (
      seaBurialActive(state) &&
      !['TIME_HELD', 'SET_OPTIONS', 'SET_DAY_LENGTH'].includes(command.type)
    )
      return;
    // Stage 12: while the launch scene has the household, the steerer is part of it: only the
    // launch's own commands, the options and the telemetry are taken.
    if (
      launchActive(state) &&
      ![
        'NAME_SHIP',
        'MARK_SAIL',
        'CLOSE_SEA_MAP',
        'TIME_HELD',
        'SET_OPTIONS',
        'SET_DAY_LENGTH',
      ].includes(command.type)
    )
      return;
    // Design addendum 2.4: in the cold open MOVE steers the oar; waking, any input gets up.
    if (wreckCtx !== null && wreckCommand(state, command)) return;
    switch (command.type) {
      case 'TIME_HELD':
        addHeld(state, command.ms);
        return;
      case 'DEV_SKIP':
      case 'DEV_TELEPORT':
      case 'DEV_KILL': {
        const done = applyDev(state, command, {
          advanceBy: (m) => {
            advanceBy(m);
          },
          land,
          tidalGroundOpen: tideAt(state.calendar, b).tidalGroundOpen,
          fightWorld,
        });
        if (done !== 'DONE') refuse(command, done === 'BUSY' ? 'BUSY' : 'NOTHING_THERE');
        return;
      }
      case 'START_GATE': {
        if (launchCtx === null || land === null || command.gate !== launchCtx.def.gate) return;
        const why = startLaunch(state, launchCtx, land, b, launchHooks, emitLaunch);
        if (why !== null) refuse(command, 'GATE_REFUSED', why);
        return;
      }
      case 'NAME_SHIP': {
        if (launchCtx === null) return;
        nameShip(state, launchCtx, command.name, emitLaunch);
        return;
      }
      case 'MARK_SAIL': {
        if (launchCtx === null) return;
        markSail(state, launchCtx, command.pattern, command.dye, emitLaunch);
        return;
      }
      case 'CLOSE_SEA_MAP': {
        if (launchCtx === null) return;
        closeSeaMap(state, launchCtx, launchHooks, emitLaunch);
        return;
      }
      case 'SLEEP': {
        const into = minutesIntoDay(state.calendar, b);
        if (into < sleepFrom) {
          events.emit({
            type: 'COMMAND_REFUSED',
            command: command.type,
            reason: 'TOO_EARLY_TO_SLEEP',
            detail: clockText(b.sleepAfter),
          });
          return;
        }
        // On foot at home: in a bed (Book 2 section 03), lying down first.
        const onFoot = state.onFoot;
        const map = onFoot === null ? undefined : land?.maps.get(onFoot.zone);
        if (camp !== null && onFoot !== null && map !== undefined && land !== null) {
          const bed = campUseNear(
            usesHere().filter((u) => u.use.kind === 'SLEEP'),
            onFoot.player,
            land.rules.interactRadiusTiles * map.tile,
          );
          if (bed === null) {
            refuse(command, 'NO_BED');
            return;
          }
          applyUse(command, bed.use, bed);
          return;
        }
        nightPasses();
        return;
      }
      case 'WORK_PRESS': {
        const work = state.onFoot?.player.work;
        if (work?.press !== null || camp === null) return;
        // A plain action has no ring and takes no press (decision PT-1).
        if (!isTimed(camp, work.task)) return;
        work.press = state.tick;
        events.emit({
          type: 'WORK_PRESSED',
          task: work.task,
          quality: timingQuality(work, camp.action),
        });
        return;
      }
      case 'CANCEL_WORK': {
        const p = state.onFoot?.player;
        if (p?.work == null) return;
        // The hold-to-cut keeps what is cut (Book 10 cutHold).
        wreckWorkCancelled(state, p.work.task, p.work.since);
        events.emit({ type: 'WORK_CANCELLED', task: p.work.task });
        p.work = null;
        return;
      }
      case 'SET_DAY_LENGTH': {
        const percent = Math.round(command.multiplier * 100);
        if (
          percent < Math.round(b.dayLength.min * 100) ||
          percent > Math.round(b.dayLength.max * 100)
        ) {
          events.emit({
            type: 'COMMAND_REFUSED',
            command: command.type,
            reason: 'DAY_LENGTH_OUT_OF_RANGE',
            detail: `${b.dayLength.min} to ${b.dayLength.max}`,
          });
          return;
        }
        state.clock.dayLengthPercent = percent;
        events.emit({ type: 'DAY_LENGTH_CHANGED', percent });
        return;
      }
      case 'CREW_ORDER':
        events.emit({ type: 'CREW_ORDER_GIVEN', order: command.order, tick: state.tick });
        if (fightCtx !== null && !fallen()) crewOrder(state, fightCtx, command.order, emitFight);
        return;
      case 'SET_OPTIONS':
        if (command.secondWind !== undefined) state.options.secondWind = command.secondWind;
        if (command.ransMercy !== undefined) state.options.ransMercy = command.ransMercy;
        return;
      case 'MELEE':
        if (fightCtx === null || fallen() || busy()) return;
        if (state.onFoot?.player.aim != null) return;
        meleePress(state, fightCtx, command.facing, emitFight, tileSize());
        return;
      case 'FACE': {
        if (state.onFoot === null) return;
        const dir =
          command.dir === null
            ? null
            : ((Math.round(command.dir) % AIM_DIRECTIONS) + AIM_DIRECTIONS) % AIM_DIRECTIONS;
        steererFace(state, dir === null ? null : (dir / AIM_DIRECTIONS) * 2 * Math.PI);
        return;
      }
      case 'LOCK_ON':
        if (fightCtx === null || fallen()) return;
        steererLockOn(state, fightCtx, command.down, emitFight, tileSize());
        return;
      case 'SNEAK':
        if (state.onFoot === null || fallen()) return;
        steererSneak(state);
        return;
      case 'HEAL':
        if (fightCtx === null || fallen() || busy()) return;
        steererHeal(state, fightCtx, emitFight);
        return;
      case 'MELEE_RELEASE':
        if (fightCtx === null || fallen()) return;
        meleeRelease(state, fightCtx, emitFight);
        return;
      case 'PARRY':
        if (fightCtx === null || fallen() || busy()) return;
        steererParry(
          state,
          fightCtx,
          emitFight,
          Math.min(
            fightCtx.cb.parry.windowMax,
            state.options.parryWindow ?? fightCtx.cb.parry.window,
          ),
        );
        return;
      case 'BLOCK':
        if (fightCtx === null || fallen()) return;
        if (command.on && busy()) return;
        steererBlock(state, fightCtx, command.on, emitFight);
        return;
      case 'DODGE': {
        if (fightCtx === null || fallen()) return;
        const p = state.onFoot?.player;
        if (p == null || p.work != null || p.sleep != null || state.onFoot?.carrying != null)
          return;
        const len = Math.hypot(command.x, command.y);
        steererDodge(
          state,
          fightCtx,
          len < 1e-6 ? null : { x: command.x / len, y: command.y / len },
          emitFight,
        );
        return;
      }
      case 'FINISHER': {
        // The finisher held (Book 10 finishKey): a choosing, not an action (no stamina, no lock);
        // let go sooner and nothing happens (decision DG-2).
        const p = state.onFoot?.player;
        if (fightCtx === null || p == null || fallen()) return;
        if (!command.on) {
          finishing = null;
          return;
        }
        const offer = finishOffer(state, fightCtx, tileSize());
        if (offer === null) {
          refuse(command, 'NOTHING_IN_REACH');
          return;
        }
        finishing = { target: offer.foe, since: state.tick };
        events.emit({ type: 'FINISHER_STARTED', target: offer.foe });
        return;
      }
      case 'SPARE': {
        // Let go (Book 10 spareKey): one press; the shout follows at once (decision DG-4).
        if (fightCtx === null || fallen()) return;
        const offer = finishOffer(state, fightCtx, tileSize());
        const fw = fightWorld();
        if (offer === null || fw === null) {
          refuse(command, 'NOTHING_IN_REACH');
          return;
        }
        finishing = null;
        steererSpare(fw, offer);
        return;
      }
      case 'MOVE': {
        if (state.onFoot === null) return;
        const length = Math.hypot(command.x, command.y);
        const scale = length > 1 ? 1 / length : 1;
        state.onFoot.player.intent = {
          x: command.x * scale,
          y: command.y * scale,
          run: command.run,
          sneak: command.sneak,
        };
        return;
      }
      case 'INTERACT': {
        const onFoot = state.onFoot;
        const map = onFoot === null ? undefined : land?.maps.get(onFoot.zone);
        if (onFoot === null || map === undefined || land === null) {
          refuse(command, 'NOT_ON_FOOT');
          return;
        }
        if (busy()) return;
        // Combat v2: food offered to the scavengers at dusk while they warn (Book 10 foodBargain).
        const warner =
          fightCtx === null
            ? null
            : duskBargainAt(state, fightCtx, map.tile, land.rules.interactRadiusTiles);
        if (warner !== null) {
          const fw = fightWorld();
          if (fw !== null && !duskBargain(fw, warner))
            refuse(command, 'NO_FOOD', 'RES_SALTED_FISH');
          return;
        }
        const tideOpen = tideAt(state.calendar, b).tidalGroundOpen;
        const interaction = interactionNow(
          onFoot,
          map,
          land.rules,
          tideOpen,
          state.facts,
          interactFirst(state, wreckCtx),
        );
        const reach = land.rules.interactRadiusTiles * map.tile;
        const use = onFoot.carrying === null ? campUseNear(usesHere(), onFoot.player, reach) : null;
        // The nearer of a lift or pickup and a camp use (carrying, only setting down).
        if (use !== null && (interaction === null || nearer(use, interaction, onFoot, map))) {
          applyUse(command, use.use, use);
          return;
        }
        if (interaction === null) {
          refuse(command, 'NOTHING_IN_REACH');
          return;
        }
        carryOut(command, interaction);
        return;
      }
      case 'INTERACT_AT': {
        const onFoot = state.onFoot;
        const map = onFoot === null ? undefined : land?.maps.get(onFoot.zone);
        if (onFoot === null || map === undefined || land === null) {
          refuse(command, 'NOT_ON_FOOT');
          return;
        }
        // Out of reach does nothing but say so (Book 2 section 21).
        if (!inReach(map, onFoot.player, command.tile, land.controls.interactReach)) {
          refuse(command, 'OUT_OF_REACH');
          return;
        }
        if (busy()) return;
        const tideOpen = tideAt(state.calendar, b).tidalGroundOpen;
        const interaction = interactionAt(
          onFoot,
          map,
          land.rules,
          tideOpen,
          command.tile,
          state.facts,
        );
        if (interaction === null) {
          const use = onFoot.carrying === null ? campUseAt(usesHere(), map, command.tile) : null;
          if (use !== null) {
            applyUse(command, use.use, use);
            return;
          }
          // A door clicked opens (decision DE-26).
          const door = doorAt(doorsNow(map), map.tile, command.tile);
          const ds = door === null ? undefined : onFoot.doors?.find((d) => d.id === door.id);
          if (door !== null && ds !== undefined && land.doors != null) {
            if (!openDoor(ds, door, onFoot.player, map.tile, events.emit.bind(events)))
              refuse(command, 'NOTHING_THERE', 'barred');
            return;
          }
          refuse(command, 'NOTHING_THERE');
          return;
        }
        carryOut(command, interaction);
        return;
      }
      case 'SELECT_SLOT': {
        const slots = land?.controls.hotbarSlots ?? state.player.hotbar.slots.length;
        if (!Number.isInteger(command.slot) || command.slot < 0 || command.slot >= slots) {
          refuse(command, 'NO_SUCH_SLOT', String(command.slot));
          return;
        }
        if (state.player.hotbar.selected === command.slot) return;
        state.player.hotbar.selected = command.slot;
        // Changing what is in hand lets go of a drawn bow without loosing it.
        if (state.onFoot !== null) state.onFoot.player.aim = null;
        events.emit({
          type: 'SLOT_SELECTED',
          slot: command.slot,
          item: state.player.hotbar.slots[command.slot] ?? null,
        });
        return;
      }
      case 'USE_AT': {
        const onFoot = state.onFoot;
        const map = onFoot === null ? undefined : land?.maps.get(onFoot.zone);
        if (onFoot === null || map === undefined || land === null) {
          refuse(command, 'NOT_ON_FOOT');
          return;
        }
        const item = state.player.hotbar.slots[command.slot] ?? null;
        if (item === null) {
          refuse(command, 'EMPTY_SLOT', String(command.slot));
          return;
        }
        if (busy()) return;
        const rules = land.rules.items[item];
        const reach = rules?.cast === true ? land.controls.castReach : land.controls.toolReach;
        if (!inReach(map, onFoot.player, command.tile, reach)) {
          refuse(command, 'OUT_OF_REACH', item);
          return;
        }
        // A tool's task (Stage 7): the hand line cast into water deep enough to fish.
        const task =
          camp === null
            ? undefined
            : [...camp.tasks].find(([, t]) => t.def.tool === item && t.def.output !== undefined);
        if (task !== undefined) {
          const at = {
            x: (command.tile.tx + 0.5) * map.tile,
            y: (command.tile.ty + 0.5) * map.tile,
          };
          const elevation = land.elevations.get(map.zone);
          const level = stillWaterLevel(tideAt(state.calendar, b));
          const band =
            elevation === undefined ? null : bandAt(land.water, elevation, at.x, at.y, level);
          if (band === null || band.band === 'WET' || band.band === 'ANKLE') {
            refuse(command, 'NO_WATER', item);
            return;
          }
          startWork(task[0], `water:${command.tile.tx},${command.tile.ty}`, at);
          return;
        }
        // Nothing here can be cut, dug or struck yet (combat is Stage 9).
        refuse(command, 'NOTHING_TO_USE_ON', item);
        return;
      }
      case 'AIM': {
        const onFoot = state.onFoot;
        if (onFoot === null || land === null) return;
        const p = onFoot.player;
        const item = state.player.hotbar.slots[state.player.hotbar.selected] ?? null;
        const rules = item === null ? undefined : land.rules.items[item];
        const aims = rules?.use === 'AIM';
        if (command.dir === null || !aims || item === null || onFoot.carrying !== null) {
          if (p.aim !== null && item !== null && rules !== undefined) loose(item, rules, p.aim);
          p.aim = null;
          return;
        }
        // No arrows, no shot (Book 10 section 21): the draw is refused before it starts.
        if (p.aim === null && rules.ammo !== undefined && ammoOf(rules.ammo) <= 0) {
          refuse(command, 'NO_ARROWS', item);
          return;
        }
        const dir = ((Math.round(command.dir) % AIM_DIRECTIONS) + AIM_DIRECTIONS) % AIM_DIRECTIONS;
        const at = AIM_UNIT[dir] ?? [1, 0];
        const dist =
          command.dist == null
            ? null
            : Math.max(0, Math.round(command.dist * AIM_DIST_STEPS) / AIM_DIST_STEPS);
        if (p.aim === null) events.emit({ type: 'BOW_DRAWN', item });
        // Locked on, a bow or a thrown spear goes at the locked enemy (the user's decision DF-81).
        const locked = p.stance?.lockOn == null ? undefined : onFoot.actors[p.stance.lockOn];
        const map = land.maps.get(onFoot.zone);
        if (locked !== undefined && map !== undefined) {
          const lx = locked.x - p.x;
          const ly = locked.y - p.y;
          const ld = Math.hypot(lx, ly);
          if (ld > 1e-6) {
            p.aim = {
              x: lx / ld,
              y: ly / ld,
              since: p.aim?.since ?? state.tick,
              dist: ld / map.tile,
            };
            return;
          }
        }
        p.aim = { x: at[0], y: at[1], since: p.aim?.since ?? state.tick, dist };
        return;
      }
      case 'CANCEL_AIM': {
        const p = state.onFoot?.player;
        if (p?.aim == null) return;
        const item = state.player.hotbar.slots[state.player.hotbar.selected] ?? null;
        p.aim = null;
        if (item !== null) events.emit({ type: 'DRAW_CANCELLED', item, reason: 'CANCELLED' });
        return;
      }
      case 'TALK': {
        if (people === null || camp === null) return;
        if (busy()) return;
        // Runa asks where her tool chest is, the next time she is talked to (decision DE-21).
        if (wreckCtx !== null && searchCtx !== null && runaAsks(state, wreckCtx, command.person)) {
          startSearchTalk(state, searchCtx, wreckCtx.rw.runa.talk, emitSearch);
          return;
        }
        const why = startTalk(state, people, camp, command.person, emitPeople);
        if (why !== null) refuse(command, why, command.person);
        return;
      }
      case 'TALK_CHOOSE': {
        if (state.talk?.kind === 'SEARCH') {
          if (searchCtx !== null)
            chooseSearch(state, searchCtx, command.index, searchHooks, emitSearch);
          return;
        }
        if (people === null || camp === null || state.talk === null) return;
        if (state.talk.kind === 'SCENE')
          chooseScene(state, people, camp, command.index, tileSize(), emitPeople);
        else
          chooseTalk(state, people, camp, command.index, emitPeople, (id) => {
            tendPerson(id);
          });
        return;
      }
      case 'TALK_END': {
        // A scene waits for its judgement; a conversation can be left at any time.
        if (state.talk?.kind === 'SEARCH') {
          const with_ = state.talk.with;
          state.talk = null;
          events.emit({ type: 'TALK_ENDED', person: with_ });
          return;
        }
        if (people === null || state.talk?.kind !== 'TALK') return;
        endTalk(state, people, emitPeople);
        return;
      }
      case 'ASSIGN_JOB': {
        if (people === null || camp === null) return;
        assignJob(state, people, camp, command.person, command.job, emitPeople);
        return;
      }
      case 'SHOVE': {
        const onFoot = state.onFoot;
        const map = onFoot === null ? undefined : land?.maps.get(onFoot.zone);
        if (onFoot === null || map === undefined) {
          refuse(command, 'NOT_ON_FOOT');
          return;
        }
        const p = onFoot.player;
        if (onFoot.carrying !== null) {
          refuse(command, 'HANDS_FULL');
          return;
        }
        if (p.aim !== null) return;
        if (command.tile !== undefined) {
          const dx = (command.tile.tx + 0.5) * map.tile - p.x;
          const dy = (command.tile.ty + 0.5) * map.tile - p.y;
          p.facing = facingOf(dx, dy, p.facing);
        }
        // The shove's stamina, timing, reach and stagger (Book 10 section 06, Stage 9).
        if (fallen()) return;
        if (fightCtx !== null && !steererShove(state, fightCtx, p.facing, emitFight)) return;
        events.emit({ type: 'SHOVED', facing: p.facing });
        return;
      }
    }
  };

  /** The steerer is downed or dead: nothing but waiting (Second wind) or the game's end. */
  const fallen = (): boolean => {
    const f = state.onFoot?.player.fight;
    return state.gameOver !== null || f?.state === 'downed' || f?.state === 'dead';
  };
  /** The held finisher under way (Book 10 finisherHold). */
  let finishing: { target: Id; since: number } | null = null;
  const emitFight = (e: Parameters<FightWorld['emit']>[0]): void => {
    // A hit taken during the finisher's hold ends it (Book 10 finishKey).
    if (
      finishing !== null &&
      e.type === 'BLOW' &&
      e.defender === STEERER &&
      (e.outcome === 'HIT' || e.outcome === 'GUARD_BROKEN')
    )
      finishing = null;
    events.emit(e);
  };
  /** A search's events (Stage 10): onto the bus, and a resolved search is remembered. */
  const emitSearch = (e: SearchEvent): void => {
    events.emit(e);
    // An offering laid at the Hag's Stone: its effect plays (decision DE-28).
    if (e.type === 'OMEN_ANSWERED' && wreckCtx !== null) {
      startHagStone(state, wreckCtx);
      events.emit({
        type: 'WRECK',
        what: 'HAG_HUSH',
        key: wreckCtx.rw.hagStone.captions['hush'] ?? '',
      });
    }
  };
  /** The opening's and the aims' events (design addendum 2.4): onto the bus. */
  const emitWreck = (e: WreckEvent | AimEvent | EdgeEvent | DoorEvent): void => {
    // Hild's dusk aim, spoken in earshot, is followed by her word on the dune grass: the sneak
    // hint's cue (Book 8 section 05; decision DG-25), a few seconds later (src/sim/land/fight.ts).
    if (
      e.type === 'AIM_HINT' &&
      e.aim === 'scavengers' &&
      e.hint === 0 &&
      !e.called &&
      state.facts['ch1.dusk.sneakCueAt'] === undefined &&
      fightCtx !== null
    )
      state.facts['ch1.dusk.sneakCueAt'] =
        state.tick + Math.round(fightCtx.pt3.prompts.sneakCueSeconds * TICKS_PER_SECOND);
    events.emit(e);
  };
  /** The doors of the zone in view that exist now. */
  const doorsNow = (
    map: { readonly doors?: readonly import('./land/zoneMap.ts').DoorDef[] } & Parameters<
      typeof doorsHere
    >[0],
  ) =>
    doorsHere(map, camp === null ? null : (state.homes[camp.def.home]?.stage ?? null), state.facts);
  /** What the opening's uses and works do beyond it. */
  const wreckHooks: WreckHooks = {
    give: (item, count) => {
      if (carried(item)) return carry(item, count);
      if (land?.rules.items[item] === undefined) return 0;
      return give({ type: 'INTERACT' }, item, count);
    },
    advance: (minutes) => {
      advanceBy(minutes);
    },
    work: (task, site, at, ticks, target) => {
      const onFoot = state.onFoot;
      if (onFoot === null) return;
      const p = onFoot.player;
      p.aim = null;
      p.work = {
        task,
        site,
        since: state.tick,
        ticks,
        press: null,
        at,
        ...(target === undefined ? {} : { target }),
      };
      p.facing = facingOf(at.x - p.x, at.y - p.y, p.facing);
      events.emit({ type: 'WORK_STARTED', task, site, ticks, markTick: null });
    },
    spend: (stamina) => {
      const st = state.player.stamina;
      st.current = Math.max(Math.min(st.current, 1), st.current - stamina);
      st.spentTick = state.tick;
    },
  };
  /** The repairs' events (Stage 11): onto the bus. */
  const emitRepair = (e: RepairEvent): void => {
    events.emit(e);
  };
  /** The launch's events (Stage 12): onto the bus. */
  const emitLaunch = (e: LaunchEvent): void => {
    events.emit(e);
  };
  const launchHooks = {
    advance: (minutes: number): void => {
      advanceBy(minutes);
    },
    deed: (tag: string, witnesses: readonly Id[]): void => {
      if (people === null) return;
      const zone = state.onFoot?.zone ?? 'ISLE_SKARV';
      householdDeed(state, people, { tag, placeId: zone }, witnesses, emitPeople);
    },
  };
  /** What a search's choices do beyond the search (Stage 10). */
  const searchHooks = {
    giveUp: (item: Id): void => {
      const slots = state.player.hotbar.slots;
      const at = slots.indexOf(item);
      if (at >= 0) slots[at] = null;
      if (state.onFoot !== null) state.onFoot.player.aim = null;
    },
    fight: (): void => {
      const fw = fightWorld();
      if (fw !== null) startFight(fw);
    },
    bargain: (): void => {
      const fw = fightWorld();
      if (fw !== null) endInBargain(fw);
    },
    repair: (action: string): void => {
      if (repairCtx !== null) chooseRepair(state, repairCtx, action, repairHooks, emitRepair);
    },
    runa: (place: string): void => {
      if (wreckCtx !== null) runaAnswer(state, wreckCtx, place, emitWreck);
    },
  };
  /** What the repairs' choices do beyond them (Stage 11). */
  const repairHooks = {
    work: (site: string): void => {
      const onFoot = state.onFoot;
      const map = onFoot === null ? undefined : land?.maps.get(onFoot.zone);
      if (repairCtx === null || map === undefined) return;
      const w = repairCtx.def.boat.work;
      startWork('TASK_REPAIR_SHIP', site, { x: w.x * map.tile, y: w.y * map.tile });
    },
    fight: (): void => {
      searchHooks.fight();
    },
    bargain: (): void => {
      searchHooks.bargain();
    },
  };

  /** What a fight needs this tick (null with no fight content or no zone). */
  const fightWorld = (): FightWorld | null => {
    const onFoot = state.onFoot;
    const map = onFoot === null ? undefined : land?.maps.get(onFoot.zone);
    if (fightCtx === null || onFoot === null || map === undefined || land === null) return null;
    return {
      world: state,
      ctx: fightCtx,
      land,
      map,
      tidalGroundOpen: tideAt(state.calendar, b).tidalGroundOpen,
      wet: (x, y) => {
        const elevation = land.elevations.get(onFoot.zone);
        if (elevation === undefined) return false;
        return (
          bandAt(land.water, elevation, x, y, stillWaterLevel(tideAt(state.calendar, b))) !== null
        );
      },
      // Combat v2 (Book 10 avoid): deep water, and a lit fire within its distance. Cliff edges
      // are not modelled: no zone has ground that drops away (its banks and rock are walls; DF-42).
      avoid: (x, y) => {
        const elevation = land.elevations.get(onFoot.zone);
        const level = stillWaterLevel(tideAt(state.calendar, b));
        if (elevation !== undefined && isDeep(bandAt(land.water, elevation, x, y, level)))
          return true;
        const fire = camp?.def.sites.find((f) => f.kind === 'FIRE' && f.zone === onFoot.zone);
        const lit = camp === null ? false : homeOf(state, camp)?.fire.lit === true;
        return (
          fire !== undefined &&
          lit &&
          Math.hypot(x - fire.x * map.tile, y - fire.y * map.tile) <=
            fightCtx.ai.self.avoidFireTiles * map.tile
        );
      },
      // Design addendum 2.5 (DF-21; Book 10 sightInLight): inside a lit fire's light pool.
      lit: (x, y) => {
        const fire = camp?.def.sites.find((f) => f.kind === 'FIRE' && f.zone === onFoot.zone);
        const on = camp === null ? false : homeOf(state, camp)?.fire.lit === true;
        return (
          fire !== undefined &&
          on &&
          Math.hypot(x - fire.x * map.tile, y - fire.y * map.tile) <=
            fightCtx.ai.torchLightTiles * map.tile
        );
      },
      emit: emitFight,
      deed: (tag, victims, witnesses, context) => {
        const placeId = onFoot.zone;
        if (people === null) {
          // No people to judge it (a world without the household's content): the ledger only.
          const id = `DEED_${state.ledger.length + 1}`;
          state.ledger.push({
            id,
            tag,
            day: state.calendar.day,
            placeId,
            doer: 'HOUSEHOLD',
            context: { ...(context ?? {}) },
            victims: [...victims],
            witnesses: witnesses.map((person) => ({ person, escaped: false })),
            identification: 1,
            marksSeen: [],
          });
          return id;
        }
        return householdDeed(
          state,
          people,
          { tag, placeId, victims, ...(context === undefined ? {} : { context }) },
          witnesses,
          emitPeople,
        );
      },
      options: {
        secondWind: state.options.secondWind,
        ransMercy: state.options.ransMercy,
        parryWindow: Math.min(
          fightCtx.cb.parry.windowMax,
          state.options.parryWindow ?? fightCtx.cb.parry.window,
        ),
      },
    };
  };

  /** The zone's tile size in pixels. */
  const tileSize = (): number => {
    const onFoot = state.onFoot;
    return (onFoot === null ? undefined : land?.maps.get(onFoot.zone)?.tile) ?? 24;
  };

  /** Starts tending a resident's wound where they are (the wound topic's "Let me see to it"). */
  const tendPerson = (id: Id): void => {
    const actor = state.onFoot?.actors[id];
    if (actor === undefined) return;
    startWork('TASK_CARE', `person:${id}`, { x: actor.x, y: actor.y }, id);
  };

  /** How many of an inventory item the steerer carries. */
  const ammoOf = (item: Id): number => state.player.inventory[item] ?? 0;

  /**
   * Lets go of a draw: before Book 10's minDraw it is cancelled and spends nothing; otherwise one
   * missile flies (and one arrow is spent, or the thrown item leaves the hand).
   */
  const loose = (item: Id, rules: ItemRules, aim: Aim): void => {
    const onFoot = state.onFoot;
    const map = onFoot === null ? undefined : land?.maps.get(onFoot.zone);
    if (onFoot === null || map === undefined || land === null) return;
    const drawTicks = state.tick - aim.since;
    if (drawTicks < land.missiles.minDrawTicks) {
      events.emit({ type: 'DRAW_CANCELLED', item, reason: 'TOO_SOON' });
      return;
    }
    const kind = rules.missile ?? 'arrow';
    if (rules.ammo !== undefined) {
      if (ammoOf(rules.ammo) <= 0) {
        events.emit({
          type: 'COMMAND_REFUSED',
          command: 'AIM',
          reason: 'NO_ARROWS',
          detail: item,
        });
        return;
      }
      state.player.inventory[rules.ammo] = ammoOf(rules.ammo) - 1;
    } else {
      // A thrown item leaves the hand.
      const slot = state.player.hotbar.selected;
      if (state.player.hotbar.slots[slot] === item) state.player.hotbar.slots[slot] = null;
    }
    const p = onFoot.player;
    const shot = launch(onFoot, state.rng.combat, land, map.tile, STEERER, p, aim, kind, drawTicks);
    const fwl = fightWorld();
    if (fwl !== null) seeMissile(fwl, shot.n, STEERER, p, shot.ux, shot.uy, shot.length);
    events.emit({ type: 'BOW_LOOSED', item, drawTicks, n: shot.n });
    events.emit({ type: 'MISSILE_LOOSED', n: shot.n, kind, shooter: STEERER });
  };

  /** Puts `count` of `item` where the steerer carries it; returns how many it took. */
  const give = (command: Command, item: Id, count: number): number => {
    if (land === null) return 0;
    const rules = land.rules.items[item];
    if (rules === undefined) return 0;
    let took = 0;
    if (rules.use === 'AMMO') {
      const room = Math.max(0, land.arrows.quiverMax - ammoOf(item));
      took = Math.min(room, count);
      if (took === 0) {
        refuse(command, 'QUIVER_FULL', item);
        return 0;
      }
      state.player.inventory[item] = ammoOf(item) + took;
    } else {
      const slots = state.player.hotbar.slots;
      const size = land.controls.hotbarSlots;
      while (slots.length < size) slots.push(null);
      for (let i = 0; i < size && took < count; i++)
        if (slots[i] === null) {
          slots[i] = item;
          took++;
        }
      if (took === 0) {
        refuse(command, 'HOTBAR_FULL', item);
        return 0;
      }
    }
    const first = !state.player.tipsSeen.includes(item);
    if (first) state.player.tipsSeen.push(item);
    // Loot taken where a fight is held (Book 10 "The spared remembered", robbed).
    const battle = state.onFoot?.battle;
    if (battle != null) battle.looted = true;
    events.emit({ type: 'ITEM_PICKED_UP', item, count: took, first });
    return took;
  };

  /**
   * Combat v2's carried counts, bindings and rations, up to Book 10 healCarry: taken into the
   * inventory by number (they have no hotbar slot). Returns how many were taken.
   */
  const carry = (item: Id, count: number): number => {
    const h = fightCtx?.cb.heal;
    const max = item === BINDING ? h?.maxBindings : item === RATION ? h?.maxRations : undefined;
    if (max === undefined) return 0;
    const inv = state.player.inventory;
    const took = Math.max(0, Math.min(count, max - (inv[item] ?? 0)));
    if (took === 0) return 0;
    inv[item] = (inv[item] ?? 0) + took;
    events.emit({ type: 'ITEM_PICKED_UP', item, count: took, first: false });
    return took;
  };
  const carried = (item: Id): boolean => item === BINDING || item === RATION;

  /** Picks up what lies at `key`: an item from the zone, or a missile pulled free. */
  const pickUp = (command: Command, key: string): void => {
    const onFoot = state.onFoot;
    if (onFoot === null || land === null) return;
    if (key.startsWith('stuck:')) {
      const n = Number(key.slice(6));
      const at = onFoot.stuck.findIndex((s) => s.n === n && stuckRecoverable(s, onFoot));
      const stuck = onFoot.stuck[at];
      if (stuck === undefined) {
        refuse(command, 'NOTHING_THERE');
        return;
      }
      const item = stuck.kind === 'arrow' ? 'ITEM_ARROW' : 'ITEM_SPEAR';
      if (give(command, item, 1) > 0) onFoot.stuck.splice(at, 1);
      return;
    }
    const at = onFoot.items.findIndex((i) => i.key === key && itemShown(i, state.facts));
    const found = onFoot.items[at];
    if (found === undefined) {
      refuse(command, 'NOTHING_THERE');
      return;
    }
    if (
      wreckCtx !== null &&
      wreckPickUp(state, wreckCtx, camp, found.item, found.x, found.y, emitWreck)
    ) {
      onFoot.items.splice(at, 1);
      return;
    }
    if (carried(found.item)) {
      // Bindings in the camp's salvage (Book 10 bindingsAtCamp): what will not fit stays there.
      const took = carry(found.item, found.count);
      if (took === 0) refuse(command, 'HOTBAR_FULL', found.item);
      else if (took < found.count) onFoot.items[at] = { ...found, count: found.count - took };
      else onFoot.items.splice(at, 1);
      return;
    }
    const took = give(command, found.item, found.count);
    if (took === 0) return;
    onFoot.items.splice(at, 1);
    const arrows = found.arrows ?? 0;
    if (arrows > 0) {
      const kept = give(command, 'ITEM_ARROW', arrows);
      // A quiver too full to take them all leaves the rest lying there.
      if (kept < arrows)
        onFoot.items.push({
          key: `${found.key}:arrows`,
          item: 'ITEM_ARROW',
          count: arrows - kept,
          x: found.x,
          y: found.y,
        });
    }
  };

  /** The camp's uses in the zone in view (its sites, and anyone to tend). */
  const usesHere = (): PlacedUse[] => {
    const onFoot = state.onFoot;
    const map = onFoot === null ? undefined : land?.maps.get(onFoot.zone);
    if (onFoot === null || map === undefined) return [];
    const uses = camp === null ? [] : campUses(state, camp, map, onFoot.actors);
    // Design addendum 2.4: Thorkel's key and chest, and the sail to raise (before others on a tile).
    if (wreckCtx !== null) uses.unshift(...wreckPlacedUses(state, wreckCtx, map, camp));
    // Stage 10: a search's words to open (Bran, Ketill, Runa, the stone).
    if (searchCtx !== null) uses.push(...searchPlacedUses(state, searchCtx, map));
    // Stage 11: the boat, the wreck's rigging, the skiff's oar, the words at the cave and the bier.
    if (repairCtx !== null) uses.push(...repairPlacedUses(state, repairCtx, map));
    return uses;
  };

  /** Whether a camp use is nearer the steerer than a lift or pickup. */
  const nearer = (
    use: { x: number; y: number },
    interaction: Interaction,
    onFoot: NonNullable<SimState['onFoot']>,
    map: { tile: number },
  ): boolean => {
    if (interaction.kind === 'SET_DOWN') return false;
    const p = onFoot.player;
    const there =
      interaction.kind === 'LIFT'
        ? onFoot.actors[interaction.target]
        : ((): { x: number; y: number } | undefined => {
            const item = onFoot.items.find((i) => i.key === interaction.key);
            if (item !== undefined) return { x: item.x * map.tile, y: item.y * map.tile };
            const stuck = onFoot.stuck.find((s) => `stuck:${s.n}` === interaction.key);
            return stuck;
          })();
    if (there === undefined) return true;
    return Math.hypot(use.x - p.x, use.y - p.y) < Math.hypot(there.x - p.x, there.y - p.y);
  };

  /** Hands busy with a task or lying down: other actions wait (the press is WORK_PRESS). */
  const busy = (): boolean => {
    const p = state.onFoot?.player;
    return p?.work != null || p?.sleep != null || state.talk !== null || fallen();
  };

  /** Begins a hands-on action: the feet planted, the work loop playing (Book 2 section 07). */
  const startWork = (task: Id, site: string, at: { x: number; y: number }, target?: Id): void => {
    const onFoot = state.onFoot;
    if (onFoot === null || camp === null) return;
    const p = onFoot.player;
    p.aim = null;
    // A pick-up is a short stoop; other work plays for actionSeconds (decisions PT-1, PT-2).
    const ticks = workTicks(camp, task);
    p.work = {
      task,
      site,
      since: state.tick,
      ticks,
      press: null,
      at,
      ...(target === undefined ? {} : { target }),
    };
    // Face the work.
    p.facing = facingOf(at.x - p.x, at.y - p.y, p.facing);
    events.emit({
      type: 'WORK_STARTED',
      task,
      site,
      ticks,
      // Only a timed task shows its ring closing on the mark (decision PT-1).
      markTick: isTimed(camp, task) ? markTick(state.tick, camp.action) : null,
    });
  };

  /** What a camp use does: a task's action, feeding the fire, eating, lying down to sleep. */
  const applyUse = (command: Command, use: SiteUse, at: { x: number; y: number }): void => {
    const onFoot = state.onFoot;
    if (onFoot === null) return;
    if (use.kind === 'SEARCH') {
      if (searchCtx !== null) startSearchTalk(state, searchCtx, use.site, emitSearch);
      if (use.site === 'boat.look' && repairCtx !== null) boatLooked(state, repairCtx);
      return;
    }
    if (use.kind === 'OPENING') {
      if (wreckCtx !== null) wreckUse(state, wreckCtx, use.site, wreckHooks, emitWreck);
      return;
    }
    if (use.kind === 'REPAIR') {
      if (repairCtx !== null && use.site === 'take_oar')
        takeOar(state, repairCtx, repairHooks, emitRepair);
      return;
    }
    if (camp === null) return;
    switch (use.kind) {
      case 'REFUSE':
        refuse(
          command,
          use.reason,
          use.reason === 'TOO_EARLY_TO_SLEEP' ? clockText(b.sleepAfter) : '',
        );
        return;
      case 'SLEEP':
        if (!sleepAllowed(state, b)) {
          refuse(command, 'TOO_EARLY_TO_SLEEP', clockText(b.sleepAfter));
          return;
        }
        onFoot.player.aim = null;
        onFoot.player.work = null;
        onFoot.player.sleep = { since: state.tick, site: use.site };
        events.emit({ type: 'FELL_ASLEEP', site: use.site });
        return;
      case 'EAT':
        eat(state, camp, false, emitCamp);
        return;
      case 'FEED_FIRE':
        feedFire(state, camp, emitCamp);
        return;
      case 'TASK':
        startWork(use.task, use.site, at, use.target);
        return;
      case 'TALK': {
        if (people === null) return;
        // Runa asks where her tool chest is, the next time she is talked to (decision DE-21).
        if (wreckCtx !== null && searchCtx !== null && runaAsks(state, wreckCtx, use.target)) {
          startSearchTalk(state, searchCtx, wreckCtx.rw.runa.talk, emitSearch);
          return;
        }
        const why = startTalk(state, people, camp, use.target, emitPeople);
        if (why !== null) refuse(command, why, use.target);
        return;
      }
    }
  };

  const refuse = (command: Command, reason: RefusalReason, detail = ''): void => {
    events.emit({ type: 'COMMAND_REFUSED', command: command.type, reason, detail });
  };

  /**
   * What follows a person or a load set down above the tide line: by the steerer, or dropped by a
   * winded steerer carrying someone rescued (decision DE-85).
   */
  const afterSetDown = (target: Id): void => {
    const onFoot = state.onFoot;
    if (onFoot === null || land === null) return;
    const emit = events.emit.bind(events);
    // A downed ally set down: safe at the camp, or downed again where they lie (Stage 9).
    const fw = fightWorld();
    const setDown = onFoot.actors[target];
    if (fw !== null && setDown !== undefined) broughtTo(fw, target, setDown);
    if (land.opening !== null) onSetDown(state, land.opening, target, emit);
    // Design addendum 2.4: a thing at its home, the stores at the camp, Runa's chest, a rescue.
    const there = land.maps.get(onFoot.zone);
    if (wreckCtx !== null && there !== undefined)
      wreckSetDown(state, wreckCtx, camp, target, there, emitWreck);
    // Stage 10: Oddi safe (he joins), Thorkel's chest saved, Runa's tools past the neck.
    const zoneMap = land.maps.get(onFoot.zone);
    if (searchCtx !== null && zoneMap !== undefined)
      searchSetDown(state, searchCtx, target, zoneMap, emitSearch);
    // Stage 11: the boards, the rigging or the steering oar laid by the boat.
    if (repairCtx !== null && zoneMap !== undefined)
      repairSetDown(state, repairCtx, target, zoneMap, emitRepair);
    // Rescued by this set-down (of the household, not downed): the get-up clock (DE-22, DE-82).
    if (wreckCtx !== null) rescueSetDown(state, wreckCtx, target);
    // Carried out of the sea above the tide line: a rescue, and the rescued remember it.
    if (
      people !== null &&
      state.household.residents.includes(target) &&
      !state.ledger.some((d) => d.tag === 'RESCUE' && d.victims.includes(target))
    ) {
      joinNew(state, people, state.tick, emitPeople);
      householdDeed(
        state,
        people,
        { tag: 'RESCUE', placeId: onFoot.zone, victims: [target] },
        [target],
        emitPeople,
      );
    }
  };

  /** Applies an allowed lift or set-down, or refuses a set-down below the tide line. */
  const carryOut = (command: Command, interaction: Interaction): void => {
    const onFoot = state.onFoot;
    if (onFoot === null || land === null) return;
    if (interaction.kind === 'PICK_UP') {
      pickUp(command, interaction.key);
      return;
    }
    if (interaction.kind === 'SET_DOWN' && interaction.refusal !== null) {
      refuse(command, interaction.refusal, interaction.target);
      if (interaction.refusal === 'BELOW_TIDE_LINE' && land.opening !== null)
        onTideRefusal(land.opening, interaction.target, events.emit.bind(events));
      return;
    }
    // A bar run empty carrying: no lifting until it recovers (Book 10 heavyCarryEmpty).
    if (interaction.kind === 'LIFT' && onFoot.player.winded?.carry === true) {
      refuse(command, 'TOO_TIRED', interaction.target);
      return;
    }
    // Hild in the net: the hold-to-cut, or her word that she needs a blade (decision DE-16).
    if (
      interaction.kind === 'LIFT' &&
      wreckCtx !== null &&
      (netInteract(state, wreckCtx, interaction.target, wreckHooks, emitWreck) ||
        chestInteract(state, wreckCtx, interaction.target, wreckHooks, emitWreck))
    )
      return;
    // Lifting someone puts a drawn bow away.
    onFoot.player.aim = null;
    applyInteraction(onFoot, interaction);
    const emit = events.emit.bind(events);
    if (interaction.kind === 'LIFT') {
      events.emit({ type: 'PERSON_LIFTED', person: interaction.target });
      if (land.opening !== null) onLifted(state, land.opening, interaction.target, emit);
      if (searchCtx !== null) searchLifted(state, searchCtx, interaction.target, emitSearch);
      if (wreckCtx !== null) wreckLifted(state, wreckCtx, interaction.target, emitWreck);
    } else {
      events.emit({ type: 'PERSON_SET_DOWN', person: interaction.target, aboveTideLine: true });
      afterSetDown(interaction.target);
    }
  };

  const stepLand = (): void => {
    const onFoot = state.onFoot;
    if (land === null || onFoot === null) return;
    const map = land.maps.get(onFoot.zone);
    if (map === undefined) return;
    const tide = tideAt(state.calendar, b);
    const level = stillWaterLevel(tide);
    const p = onFoot.player;
    // The opening's own hands-on actions (the cut, the sail raised) end (design addendum 2.4).
    if (
      p.work != null &&
      wreckCtx !== null &&
      isWreckWork(p.work.task) &&
      state.tick - p.work.since >= p.work.ticks
    ) {
      const task = p.work.task;
      p.work = null;
      events.emit({
        type: 'WORK_DONE',
        task,
        site: 'opening',
        minutes: 0,
        stamina: 0,
        bonus: 0,
        output: 1,
      });
      finishWreckWork(state, wreckCtx, camp, task, wreckHooks, emitWreck);
    }
    // A hands-on action ends: its work counts and its game time passes (Book 2 section 07).
    if (p.work != null && camp !== null && state.tick - p.work.since >= p.work.ticks) {
      const work = p.work;
      p.work = null;
      finishWork(
        state,
        camp,
        work,
        state.tick,
        emitCamp,
        (m) => {
          advanceBy(m);
        },
        sayHild,
        (site, workerMinutes) => {
          if (repairCtx !== null)
            repairActionDone(state, repairCtx, site, workerMinutes, emitRepair);
        },
      );
    }
    // Lying down: after a few seconds the night passes.
    if (p.sleep != null && camp !== null && state.tick - p.sleep.since >= camp.sleepTicks) {
      nightPasses();
      return;
    }
    // The game is over: nothing moves until a save is loaded.
    if (state.gameOver !== null) return;
    const fw = fightWorld();
    if (fw !== null) spawnEncounters(state, fw.ctx, map, emitFight);
    // Where everyone stood as the tick began (the missiles' swept test, Book 10 sweptHits).
    const starts = new Map<Id, { x: number; y: number }>([[STEERER, { x: p.x, y: p.y }]]);
    for (const [id, a] of Object.entries(onFoot.actors)) starts.set(id, { x: a.x, y: a.y });
    if (fw !== null) stepStance(state, fw.ctx, map.tile, emitFight);
    if (fallen()) {
      p.intent = { x: 0, y: 0, run: false, sneak: false };
      p.aim = null;
    }
    // The gale on the Hag's neck holds anyone carrying while the stone weeps (Stage 10).
    const wanted = p.intent;
    let held = false;
    if (searchCtx !== null && (wanted.x !== 0 || wanted.y !== 0)) {
      held = galeHolds(state, searchCtx, map, p.x + wanted.x * 6, p.y + wanted.y * 6);
      if (held) {
        p.intent = { ...wanted, x: 0, y: 0 };
        galeRefused(state, emitSearch, searchCtx);
      }
    }
    // Design addendum 2.4: the zone's doors swing for whoever walks at them (decision DE-26).
    if (land.doors != null)
      stepDoors(onFoot, map, doorsNow(map), state.tick, land.doors, emitWreck);
    // Waking in the surf, the steerer lies until up (decision DE-30).
    const waking = wreckCtx !== null && wreckPhase(state) !== 'PLAY';
    if (waking) p.intent = { ...p.intent, x: 0, y: 0 };
    // The launch scene moves the steerer itself (Stage 12).
    const press =
      launchActive(state) || seaBurialActive(state)
        ? null
        : stepMovement(onFoot, map, land, { open: tide.tidalGroundOpen, level }, state.tick);
    if (held || waking) p.intent = wanted;
    // "Nothing that way" (decision DE-25): pressing against an edge gives its caption.
    if (land.edgeCaption != null) {
      const kind = press === null ? null : edgeKindAt(map, press, land.maps, tide.tidalGroundOpen);
      stepEdges(state, kind === null || kind === 'LINK' ? null : kind, land.edgeCaption, emitWreck);
    }
    if (fw !== null) {
      stepFight(fw);
      stepDuskAway(fw);
      // Combat v2 (decision DE-12): reaching camp the first time in a day calls for a checkpoint.
      if (campReached(state, fw.ctx, map.tile))
        events.emit({ type: 'CAMP_REACHED', day: state.calendar.day });
      // The held finisher (Book 10 finisherHold): the hold done, the finisher plays its ticks
      // under "Commitment" (decisions DG-2 and DG-3), on the foe still offered.
      if (finishing !== null && state.tick - finishing.since >= fw.ctx.cb.finisherHold) {
        const offer = finishOffer(state, fw.ctx, map.tile);
        if (offer !== null && offer.foe === finishing.target) startFinisher(fw, offer);
        finishing = null;
      }
    }
    const emit = events.emit.bind(events);
    // Stamina in traversal (Book 10 section 06): sprinting, carrying a person, wading waist deep.
    if (sb !== null) {
      const elevation = land.elevations.get(map.zone);
      const band = elevation === undefined ? null : bandAt(land.water, elevation, p.x, p.y, level);
      const waist = band?.band === 'WAIST' || band?.band === 'DEEP';
      const st = state.player.stamina;
      updateMax(st, sb);
      p.winded ??= {};
      const emptied = traversalTick(
        st,
        sb,
        {
          running: p.moving && p.gait === 'run',
          carrying: onFoot.carrying !== null,
          wadingWaist: waist && p.moving,
          inWaist: waist,
          inCombat: hostilesAware(onFoot) > 0,
          blocking: p.blocking === true,
          // Design addendum 2.5 (Book 10 "Exhausted"): the longer pause and slower refill.
          ...(fightCtx !== null && p.fight?.exhausted === true
            ? {
                exhausted: {
                  delay: fightCtx.cb.exhausted.exhaustedRegenDelay,
                  rate: fightCtx.cb.exhausted.exhaustedRegenPerSecond,
                },
              }
            : {}),
        },
        state.tick,
        p.winded,
      );
      if (Object.keys(p.winded).length === 0) delete p.winded;
      // Any cost that empties the bar exhausts (Book 10 "Exhausted", DF-3): running included.
      if (st.current <= 0 && fightCtx !== null) {
        const sf = steererFighter(state, fightCtx);
        if (sf !== null) updateExhausted(sf, st, fightCtx.cb, state.tick);
      }
      // Empty while carrying: the load is set down where the steerer stands.
      if (emptied.carry === true && onFoot.carrying !== null) {
        const person = onFoot.carrying;
        const actor = onFoot.actors[person];
        onFoot.carrying = null;
        if (actor !== undefined) {
          actor.pose = 'down';
          actor.x = p.x;
          actor.y = p.y;
        }
        events.emit({ type: 'LOAD_DROPPED', person });
        // Someone rescued dropped above the tide line is set down safe all the same (DE-85).
        const feet = tileOf(map, p.x, p.y);
        const ground = terrainAt(map, feet.tx, feet.ty);
        if (wreckCtx?.rw.rescue.people.includes(person) === true && aboveTideLine(ground))
          afterSetDown(person);
      }
      // Wet through outside summer: cold until warmed by a fire or a hot meal.
      const deep = band !== null && band.band !== 'WET' && band.band !== 'ANKLE';
      if (deep && seasonOf(state.calendar.day) !== 'Summer') addReason('COLD', 'wet');
    }
    // Design addendum 2.4: the opening's beats and Chapter 1's aims.
    if (wreckCtx !== null) stepWreck(state, wreckCtx, land, tide.tidalGroundOpen, emitWreck);
    if (aimsCtx !== null) stepAims(state, aimsCtx, land.maps, emitWreck);
    if (land.opening !== null) {
      stepOpening(state, land.opening, map, land, level, emit);
      if (camp !== null) stepBroch(state, camp, land.opening, land, tide.tidalGroundOpen, emit);
    }
    // Chapter 1 beat 3, the three searches (Stage 10).
    if (searchCtx !== null)
      stepSearches(
        state,
        searchCtx,
        land,
        tide.tidalGroundOpen,
        land.opening?.caller ?? null,
        emitSearch,
      );
    // Chapter 1 beats 4 to 6: the repairs, the fitting and Thorkel's rites (Stage 11).
    if (repairCtx !== null)
      stepRepairs(state, repairCtx, land, tide.tidalGroundOpen, emitRepair, (zone, x, y) => {
        // The sea burial's water's edge (DG-14): ground awash at the tide now.
        const el = land.elevations.get(zone);
        const t = land.maps.get(zone)?.tile ?? 24;
        return el !== undefined && bandAt(land.water, el, x * t, y * t, level) !== null;
      });
    // Chapter 1 beat 8, the launch and its gate (Stage 12).
    if (launchCtx !== null) stepLaunch(state, launchCtx, emitLaunch);
    // The household's day (Stage 8): new residents join it; each walks to what they are doing;
    // a conversation's lines play; residents in earshot bark.
    if (people !== null && camp !== null) {
      joinNew(state, people, state.tick, emitPeople);
      stepPeopleTick(
        state,
        people,
        camp,
        land,
        tide.tidalGroundOpen,
        land.opening?.caller ?? null,
        (id) =>
          searchHolds(state, searchCtx, id) ||
          repairsHold(state, repairCtx, id) ||
          launchHolds(state, id) ||
          (wreckCtx !== null && wreckHolds(state, wreckCtx, id)),
        wreckCtx?.limp,
      );
      talkTick(state, people, map.tile, land.rules.interactRadiusTiles, emitPeople);
      if (!launchActive(state) && !seaBurialActive(state))
        barkTick(state, people, camp, map.tile, residents(state), emitPeople);
    }
    // Other people: an archer's stop, draw, loose and move, then their own walk.
    for (const [id, actor] of Object.entries(onFoot.actors).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (actor.archer !== undefined) {
        const kind = actor.archer.kind ?? 'arrow';
        const weapon = kind === 'arrow' ? land.missiles.bow : land.missiles.spear;
        stepArcher(actor, state.tick, weapon.drawTicks, map.tile, (aim) => {
          const shot = launch(
            onFoot,
            state.rng.combat,
            land,
            map.tile,
            id,
            actor,
            aim,
            kind,
            state.tick - aim.since,
          );
          emit({ type: 'MISSILE_LOOSED', n: shot.n, kind, shooter: id });
          if (fw !== null) seeMissile(fw, shot.n, id, actor, shot.ux, shot.uy, shot.length);
        });
      }
      stepActor(actor, map, land, tide.tidalGroundOpen);
    }
    const now = gameMinute(state.calendar);
    // Combat v2 (decision DE-10): only a sidestep that read a missile lets it pass; every
    // missile's path is swept against where each body stood and stands this tick.
    const passes = (id: Id, n: number): boolean => {
      const f = id === STEERER ? onFoot.player.fight : onFoot.actors[id]?.fight?.f;
      return sidestepsMissile(f, n, state.tick);
    };
    const before = (id: Id): { x: number; y: number } | undefined => starts.get(id);
    const shieldAngle = (id: Id): number | undefined =>
      (id === STEERER ? onFoot.player.fight : onFoot.actors[id]?.fight?.f)?.angle;
    // The stores' lashing on the broken mast: a missile through it cuts it (decision DE-19).
    if (wreckCtx !== null) stepMast(state, wreckCtx, map, land.rules.releaseHeightPx, emitWreck);
    stepProjectiles(
      onFoot,
      state.rng.combat,
      map,
      { ...land, passes, before, shieldAngle },
      level,
      now,
      (e) => {
        emit(e);
        // A missile in a body hurts; on a shield it costs the block (Book 10 "Fight rules").
        if (fw !== null) missileStruck(fw, e);
      },
    );
    expireStuck(onFoot, land, now);
    // Walking off an edge that leads on: into the next zone (Book 2 section 10, FootLink).
    if (p.work == null && p.sleep == null) {
      const edge = edgeAt(map, p.x, p.y, land.rules.footprint, p.intent);
      const to = edge === null ? null : linkOf(map, edge, p, land.maps);
      const toMap = to === null ? undefined : land.maps.get(to);
      if (to !== null && toMap !== undefined) {
        const at = entryPoint(map, toMap, p.x, p.y, land, tide.tidalGroundOpen);
        if (at !== null) {
          const from = onFoot.zone;
          if (fw !== null) leaveZone(fw);
          switchZone(onFoot, to, at);
          events.emit({ type: 'ZONE_ENTERED', zone: to, from });
        }
      }
    }
  };

  /**
   * One game minute (Book 2 section 03): the calendar, then the home step. `quiet` while time is
   * skipped (a task's minutes, a night): no watch or tide events then.
   */
  const advanceOneMinute = (quiet = false): void => {
    const before = state.calendar;
    const after = advanceMinutes(before, 1, b);
    state.calendar = after;
    if (!quiet && watchOf(after, b) !== watchOf(before, b)) {
      events.emit({ type: 'WATCH_STARTED', day: after.day, watch: watchOf(after, b) });
      const tide = tideAt(after, b).phase;
      if (tide !== tideAt(before, b).phase)
        events.emit({ type: 'TIDE_TURNED', day: after.day, phase: tide });
    }
    if (camp !== null) homeMinute(state, camp, steererAt(), emitCamp);
    if (camp !== null && people !== null) {
      const at = steererAt();
      peopleMinute(
        state,
        people,
        camp,
        at,
        land?.opening?.caller ?? null,
        emitPeople,
        sayAs,
        (id, workerMinutes) => {
          if (repairCtx !== null) addShipWork(state, repairCtx, workerMinutes, id, emitRepair);
        },
      );
      sceneMinute(state, people, camp, at?.tile ?? 24, emitPeople);
    }
    if (state.player.awake && minutesIntoDay(after, b) === collapseAt) {
      events.emit({ type: 'COLLAPSED', day: after.day, at: clockText(after.minuteOfDay) });
      // Asleep where they stood until Book 10's wake time, through the home step.
      state.player.awake = false;
      if (state.onFoot !== null) {
        state.onFoot.player.work = null;
        state.onFoot.player.sleep = null;
      }
      const until = (b.collapse.wakeAt - b.dayStart + 1440) % 1440;
      const minutes = 1440 - minutesIntoDay(state.calendar, b) + until;
      advanceBy(minutes);
      wake('collapsed', { slept: minutes, cold: false, collapsed: true });
    }
  };

  return {
    state,
    events,
    submit(command) {
      queue.push(command);
    },
    restore(world) {
      if (world.version !== SIM_STATE_VERSION)
        throw new Error(`Simulation state version ${world.version} is not ${SIM_STATE_VERSION}`);
      const target = state as unknown as Record<string, unknown>;
      for (const key of Object.keys(target)) Reflect.deleteProperty(target, key);
      Object.assign(target, world);
      queue = [];
      finishing = null;
    },
    step() {
      const pending = queue;
      queue = [];
      for (const command of pending) apply(command);
      // The played cold open (decision DE-30): the land waits and the calendar does not run.
      if (wreckCtx !== null && stepWreckPhase(state, wreckCtx, emitWreck) === 'COLD') {
        stepTelemetry(state);
        state.tick++;
        return;
      }
      stepLand();
      stepTelemetry(state);
      state.clock.subMinute += TICK_UNITS;
      const threshold = unitsPerMinute(b, state.clock.dayLengthPercent);
      while (state.clock.subMinute >= threshold) {
        state.clock.subMinute -= threshold;
        advanceOneMinute();
      }
      state.tick++;
    },
  };
}
