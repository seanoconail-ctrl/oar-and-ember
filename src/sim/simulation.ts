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
  crewOrder,
  finisherTarget,
  hostilesAware,
  hurt,
  inDodge,
  leaveZone,
  meleePress,
  meleeRelease,
  endInBargain,
  spawnEncounters,
  startFight,
  steererBlock,
  steererDodge,
  steererParry,
  steererShove,
  stepFight,
} from './land/fight.ts';
import type { FightContext, FightEvent, FightWorld } from './land/fight.ts';
import { damageOf } from './combat/fighter.ts';
import { expireStuck, gameMinute, launch, STEERER, stepProjectiles } from './land/missiles.ts';
import type { MissileEvent } from './land/missiles.ts';
import { bandAt, stillWaterLevel } from './land/water.ts';
import {
  byTheFire,
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
  onLifted,
  onSetDown,
  onTideRefusal,
  stepOpening,
  stepOpeningAfter,
} from './narrative/opening.ts';
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
  /** The difficulty options that change the simulation (Book 1 section 15), from the menu. */
  | { readonly type: 'SET_OPTIONS'; readonly secondWind?: boolean; readonly ransMercy?: boolean }
  /** Stage 8: talk to a resident; choose an option in the conversation or scene; leave it. */
  | { readonly type: 'TALK'; readonly person: Id }
  | { readonly type: 'TALK_CHOOSE'; readonly index: number }
  | { readonly type: 'TALK_END' }
  /** Delegation (Book 1 section 10): give a resident a job. */
  | { readonly type: 'ASSIGN_JOB'; readonly person: Id; readonly job: JobKind };

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
  /** The held finisher has begun on someone (Book 10 finisherHold). */
  | { readonly type: 'FINISHER_STARTED'; readonly target: Id }
  /** The steerer walked on into another zone. */
  | { readonly type: 'ZONE_ENTERED'; readonly zone: Id; readonly from: Id }
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
    if (who !== undefined) events.emit({ type: 'PERSON_SPOKE', person: who, lineKey });
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
    switch (command.type) {
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
        meleePress(state, fightCtx, command.facing, emitFight);
        return;
      case 'MELEE_RELEASE':
        if (fightCtx === null || fallen()) return;
        meleeRelease(state, fightCtx, emitFight);
        return;
      case 'PARRY':
        if (fightCtx === null || fallen() || busy()) return;
        steererParry(state, fightCtx, emitFight);
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
        const p = state.onFoot?.player;
        if (fightCtx === null || p == null || fallen()) return;
        if (!command.on) {
          finishing = null;
          return;
        }
        const target = finisherTarget(state, fightCtx, tileSize());
        if (target === null) {
          refuse(command, 'NOTHING_IN_REACH');
          return;
        }
        finishing = { target, since: state.tick };
        events.emit({ type: 'FINISHER_STARTED', target });
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
        const tideOpen = tideAt(state.calendar, b).tidalGroundOpen;
        const interaction = interactionNow(onFoot, map, land.rules, tideOpen, state.facts);
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
    events.emit(e);
  };
  /** A search's events (Stage 10): onto the bus, and a resolved search is remembered. */
  const emitSearch = (e: SearchEvent): void => {
    events.emit(e);
  };
  /** The repairs' events (Stage 11): onto the bus. */
  const emitRepair = (e: RepairEvent): void => {
    events.emit(e);
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
      emit: emitFight,
      deed: (tag, victims, witnesses) => {
        if (people === null) return;
        householdDeed(state, people, { tag, placeId: onFoot.zone, victims }, witnesses, emitPeople);
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
    events.emit({ type: 'ITEM_PICKED_UP', item, count: took, first });
    return took;
  };

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
        const why = startTalk(state, people, camp, use.target, emitPeople);
        if (why !== null) refuse(command, why, use.target);
        return;
      }
    }
  };

  const refuse = (command: Command, reason: RefusalReason, detail = ''): void => {
    events.emit({ type: 'COMMAND_REFUSED', command: command.type, reason, detail });
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
    // Lifting someone puts a drawn bow away.
    onFoot.player.aim = null;
    applyInteraction(onFoot, interaction);
    const emit = events.emit.bind(events);
    if (interaction.kind === 'LIFT') {
      events.emit({ type: 'PERSON_LIFTED', person: interaction.target });
      if (land.opening !== null) onLifted(state, land.opening, interaction.target, emit);
      if (searchCtx !== null) searchLifted(state, searchCtx, interaction.target, emitSearch);
    } else {
      events.emit({ type: 'PERSON_SET_DOWN', person: interaction.target, aboveTideLine: true });
      // A downed ally set down: safe at the camp, or downed again where they lie (Stage 9).
      const fw = fightWorld();
      const setDown = onFoot.actors[interaction.target];
      if (fw !== null && setDown !== undefined) broughtTo(fw, interaction.target, setDown);
      if (land.opening !== null) onSetDown(state, land.opening, interaction.target, emit);
      // Stage 10: Oddi safe (he joins), Thorkel's chest saved, Runa's tools past the neck.
      const zoneMap = land.maps.get(onFoot.zone);
      if (searchCtx !== null && zoneMap !== undefined)
        searchSetDown(state, searchCtx, interaction.target, zoneMap, emitSearch);
      // Stage 11: the boards, the rigging or the steering oar laid by the boat.
      if (repairCtx !== null && zoneMap !== undefined)
        repairSetDown(state, repairCtx, interaction.target, zoneMap, emitRepair);
      // Carried out of the sea above the tide line: a rescue, and the rescued remember it.
      if (
        people !== null &&
        state.household.residents.includes(interaction.target) &&
        !state.ledger.some((d) => d.tag === 'RESCUE' && d.victims.includes(interaction.target))
      ) {
        joinNew(state, people, state.tick, emitPeople);
        householdDeed(
          state,
          people,
          { tag: 'RESCUE', placeId: onFoot.zone, victims: [interaction.target] },
          [interaction.target],
          emitPeople,
        );
      }
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
    stepMovement(onFoot, map, land, { open: tide.tidalGroundOpen, level });
    if (held) p.intent = wanted;
    if (fw !== null) {
      stepFight(fw);
      // The held finisher (Book 10 finisherHold): a kill, and a deed.
      if (finishing !== null) {
        const t = onFoot.actors[finishing.target];
        if (t?.fight?.dead !== null) finishing = null;
        else if (state.tick - finishing.since >= fw.ctx.cb.finisherHold) {
          hurt(fw, finishing.target, 9999, STEERER, {
            heavyKill: true,
            weapon: p.fight?.weapon ?? null,
            dx: t.x - p.x,
            dy: t.y - p.y,
          });
          finishing = null;
        }
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
        },
        state.tick,
        p.winded,
      );
      if (Object.keys(p.winded).length === 0) delete p.winded;
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
      }
      // Wet through outside summer: cold until warmed by a fire or a hot meal.
      const deep = band !== null && band.band !== 'WET' && band.band !== 'ANKLE';
      if (deep && seasonOf(state.calendar.day) !== 'Summer') addReason('COLD', 'wet');
    }
    if (land.opening !== null) {
      stepOpening(state, land.opening, map, land, level, emit);
      stepOpeningAfter(state, land.opening, emit);
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
    if (repairCtx !== null) stepRepairs(state, repairCtx, land, tide.tidalGroundOpen, emitRepair);
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
        (id) => searchHolds(state, searchCtx, id) || repairsHold(state, repairCtx, id),
      );
      talkTick(state, people, map.tile, land.rules.interactRadiusTiles, emitPeople);
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
        });
      }
      stepActor(actor, map, land, tide.tidalGroundOpen);
    }
    const now = gameMinute(state.calendar);
    // A dodge's invulnerable ticks let a missile pass (Book 10 dodge; decision S9-29).
    const passes = (id: Id): boolean => {
      const f = id === STEERER ? onFoot.player.fight : onFoot.actors[id]?.fight?.f;
      return fightCtx !== null && f != null && inDodge(f, state.tick, fightCtx);
    };
    stepProjectiles(onFoot, state.rng.combat, map, { ...land, passes }, level, now, (e) => {
      emit(e);
      // Stage 9: a missile in a body hurts; on a shield it costs the block (Book 10 "Fight rules").
      if (fw === null || e.target === undefined) return;
      const cb = fw.ctx.cb;
      const dmg = e.kind === 'arrow' ? cb.arrow : cb.thrownSpear;
      const from =
        e.shooter === undefined ? null : e.shooter === STEERER ? p : onFoot.actors[e.shooter];
      if (e.strike === 'body') {
        const target = e.target === STEERER ? null : onFoot.actors[e.target]?.fight;
        const f = e.target === STEERER ? p.fight : target?.f;
        const armour = f?.armour ?? 'NONE';
        const damage = damageOf({ damage: dmg.damage, cut: false }, armour, cb);
        hurt(fw, e.target, damage, e.shooter ?? STEERER, {
          heavyKill: false,
          weapon: null,
          dx: e.x - (from?.x ?? e.x),
          dy: e.y - (from?.y ?? e.y),
          missile: true,
        });
        emitFight({
          type: 'BLOW',
          attacker: e.shooter ?? STEERER,
          defender: e.target,
          outcome: 'HIT',
          damage,
          heavy: false,
          x: e.x,
          y: e.y,
          dx: e.x - (from?.x ?? e.x),
          dy: e.y - (from?.y ?? e.y),
          material: 'FLESH',
        });
      } else if (e.strike === 'shield') {
        const pool =
          e.target === STEERER ? state.player.stamina : onFoot.actors[e.target]?.fight?.stamina;
        if (pool !== undefined) {
          pool.current = Math.max(0, pool.current - cb.block.costFactor * dmg.vsShield);
          pool.spentTick = state.tick;
        }
      }
    });
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
      stepLand();
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
