/**
 * The simulation root (Book 2 sections 02 and 03): one serialisable state, advanced by a fixed
 * 60 Hz tick. All changes arrive as commands, applied at the start of a tick in the order they
 * were submitted; systems report what happened as events. No wall-clock time or Math.random here.
 *
 * Systems so far: the calendar and the on-foot clock with sleep and collapse (Stage 2).
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

/** The simulation runs on the world state of Book 2 section 05 (src/sim/world.ts). */
export type SimState = WorldState;
export const SIM_STATE_VERSION = WORLD_STATE_VERSION;

/** Crew orders (Book 2 section 12); the crew who carry them out arrive with Stages 8 and 9. */
export type CrewOrder = 'FOLLOW' | 'HOLD' | 'ATTACK' | 'PROTECT' | 'CARRY' | 'WITHDRAW';

export type Command =
  | { readonly type: 'SLEEP' }
  | { readonly type: 'SET_DAY_LENGTH'; readonly multiplier: number }
  | { readonly type: 'CREW_ORDER'; readonly order: CrewOrder };

export type RefusalReason = 'TOO_EARLY_TO_SLEEP' | 'DAY_LENGTH_OUT_OF_RANGE';

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
  | {
      readonly type: 'COMMAND_REFUSED';
      readonly command: Command['type'];
      readonly reason: RefusalReason;
      readonly detail: string;
    };

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

export function createSimulation(b: TimeBalance, state: SimState): Simulation {
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
    }
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
