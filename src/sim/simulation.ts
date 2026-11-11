/**
 * The simulation root (Book 2 sections 02 and 03): one serialisable state, advanced by a fixed
 * 60 Hz tick. All changes arrive as commands, applied at the start of a tick in the order they
 * were submitted; systems report what happened as events. No wall-clock time or Math.random here.
 *
 * Systems so far: the calendar and the on-foot clock with sleep and collapse (Stage 2); the
 * on-foot controller, interaction and carrying, and Chapter 1 beat 1 on Wreck Strand (Stage 6).
 */
import type { TimeBalance } from '../content/balance.ts';
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
  inReach,
  interactionAt,
  interactionNow,
  stepMovement,
} from './land/onFoot.ts';
import type {
  Interaction,
  LandContext,
  RefusalReason as OnFootRefusal,
  TilePos,
} from './land/onFoot.ts';
import { stillWaterLevel } from './land/water.ts';
import { onLifted, onSetDown, onTideRefusal, stepOpening } from './narrative/opening.ts';
import type { OpeningEvent } from './narrative/opening.ts';

/** The simulation runs on the world state of Book 2 section 05 (src/sim/world.ts). */
export type SimState = WorldState;
export const SIM_STATE_VERSION = WORLD_STATE_VERSION;

/** Crew orders (Book 2 section 12); the crew who carry them out arrive with Stages 8 and 9. */
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
  /** Drawing a bow towards one of AIM_DIRECTIONS (0 east, clockwise), or null to loose. */
  | { readonly type: 'AIM'; readonly dir: number | null };

/** Aim vectors are quantised to this many directions, so replays are exact. */
export const AIM_DIRECTIONS = 64;

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
  | { readonly type: 'BOW_LOOSED'; readonly item: Id; readonly drawTicks: number }
  | OpeningEvent
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
}

/** What the on-foot systems need: zone maps, Book 10 speeds and the controller rules. */
export interface SimWorldContext extends LandContext {
  readonly opening: OpeningDef | null;
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

  const wake = (day: number, minuteOfDay: number, cause: 'slept' | 'collapsed'): void => {
    state.calendar = { day, minuteOfDay };
    state.clock.subMinute = 0;
    state.player.awake = true;
    state.player.staminaMaxChange = cause === 'collapsed' ? b.collapse.staminaMaxChange : 0;
    events.emit({ type: 'WOKE', day, at: clockText(minuteOfDay), cause });
    if (seasonDay(day) === 1) {
      events.emit({ type: 'SEASON_STARTED', day, season: seasonOf(day), year: yearOf(day) });
    }
    events.emit({ type: 'MORNING_REPORT_DUE', day });
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
        events.emit({
          type: 'SLEPT',
          day: state.calendar.day,
          at: clockText(state.calendar.minuteOfDay),
        });
        wake(state.calendar.day + 1, b.dayStart, 'slept');
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
        return;
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
        const tideOpen = tideAt(state.calendar, b).tidalGroundOpen;
        const interaction = interactionNow(onFoot, map, land.rules, tideOpen);
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
        const tideOpen = tideAt(state.calendar, b).tidalGroundOpen;
        const interaction = interactionAt(onFoot, map, land.rules, tideOpen, command.tile);
        if (interaction === null) {
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
        if (!inReach(map, onFoot.player, command.tile, land.controls.toolReach)) {
          refuse(command, 'OUT_OF_REACH', item);
          return;
        }
        // Nothing on the strand can be cut, dug or struck yet (tasks from Stage 7, combat Stage 9).
        refuse(command, 'NOTHING_TO_USE_ON', item);
        return;
      }
      case 'AIM': {
        const onFoot = state.onFoot;
        if (onFoot === null) return;
        const p = onFoot.player;
        const item = state.player.hotbar.slots[state.player.hotbar.selected] ?? null;
        const aims = item !== null && land?.rules.items[item]?.use === 'AIM';
        if (command.dir === null || !aims || state.onFoot?.carrying != null) {
          if (p.aim !== null && item !== null)
            events.emit({ type: 'BOW_LOOSED', item, drawTicks: state.tick - p.aim.since });
          p.aim = null;
          return;
        }
        const dir = ((Math.round(command.dir) % AIM_DIRECTIONS) + AIM_DIRECTIONS) % AIM_DIRECTIONS;
        const at = AIM_UNIT[dir] ?? [1, 0];
        if (p.aim === null) events.emit({ type: 'BOW_DRAWN', item });
        p.aim = { x: at[0], y: at[1], since: p.aim?.since ?? state.tick };
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
    if (interaction.kind === 'SET_DOWN' && interaction.refusal !== null) {
      refuse(command, interaction.refusal, interaction.target);
      if (interaction.refusal === 'BELOW_TIDE_LINE' && land.opening !== null)
        onTideRefusal(land.opening, interaction.target, events.emit.bind(events));
      return;
    }
    // Lifting someone puts a drawn bow away.
    onFoot.player.aim = null;
    applyInteraction(onFoot, interaction);
    const emit = events.emit.bind(events);
    if (interaction.kind === 'LIFT') {
      events.emit({ type: 'PERSON_LIFTED', person: interaction.target });
      if (land.opening !== null) onLifted(state, land.opening, interaction.target, emit);
    } else {
      events.emit({ type: 'PERSON_SET_DOWN', person: interaction.target, aboveTideLine: true });
      if (land.opening !== null) onSetDown(state, land.opening, interaction.target, emit);
    }
  };

  const stepLand = (): void => {
    const onFoot = state.onFoot;
    if (land === null || onFoot === null) return;
    const map = land.maps.get(onFoot.zone);
    if (map === undefined) return;
    const tide = tideAt(state.calendar, b);
    stepMovement(onFoot, map, land, { open: tide.tidalGroundOpen, level: stillWaterLevel(tide) });
    if (land.opening !== null) stepOpening(state, land.opening, map.tile, events.emit.bind(events));
  };

  const advanceOneMinute = (): void => {
    const before = state.calendar;
    const after = advanceMinutes(before, 1, b);
    state.calendar = after;
    if (watchOf(after, b) !== watchOf(before, b)) {
      events.emit({ type: 'WATCH_STARTED', day: after.day, watch: watchOf(after, b) });
      const tide = tideAt(after, b).phase;
      if (tide !== tideAt(before, b).phase)
        events.emit({ type: 'TIDE_TURNED', day: after.day, phase: tide });
    }
    if (state.player.awake && minutesIntoDay(after, b) === collapseAt) {
      events.emit({ type: 'COLLAPSED', day: after.day, at: clockText(after.minuteOfDay) });
      wake(after.day + 1, b.collapse.wakeAt, 'collapsed');
    }
  };

  return {
    state,
    events,
    submit(command) {
      queue.push(command);
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
