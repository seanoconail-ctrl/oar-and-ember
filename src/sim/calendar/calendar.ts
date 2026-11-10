/**
 * The calendar (Book 2 section 03; numbers from Book 10 section 02 via TimeBalance).
 *
 * - The year has 120 days in four 30-day seasons (Book 1 section 12, a locked requirement).
 * - `day` counts from 1. A day runs from waking at dayStart (06:00) to the next dayStart, so its
 *   four watches are Morning 06-12, Day 12-18, Evening 18-24 and Night 00-06 (Book 10 watchHours).
 * - `minuteOfDay` is the clock time in minutes after midnight (0 to 1439).
 * - The tide floods and ebbs on alternate watches, shifting one watch every phaseShiftDays days.
 *   Low water falls where an ebb turns to flood; spring tides fall on Book 10's days.
 */
import { SEASONS } from '../../content/balance.ts';
import type { Season, TimeBalance } from '../../content/balance.ts';

export const DAYS_PER_SEASON = 30;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;
export const MINUTES_PER_DAY = 1440;

export const WATCHES = ['Morning', 'Day', 'Evening', 'Night'] as const;
export type Watch = (typeof WATCHES)[number];

export interface CalendarState {
  readonly day: number;
  readonly minuteOfDay: number;
}

export type TidePhase = 'FLOOD' | 'EBB';

export interface TideState {
  readonly phase: TidePhase;
  readonly springTide: boolean;
  /** Game minutes until the next low water. */
  readonly minutesToLowWater: number;
  /** Game minutes since the last low water. */
  readonly minutesSinceLowWater: number;
  /** Tidal ground is passable within half the Book 10 window either side of low water. */
  readonly tidalGroundOpen: boolean;
}

export function yearOf(day: number): number {
  return Math.ceil(day / DAYS_PER_YEAR);
}

export function seasonOf(day: number): Season {
  const index = Math.floor(((day - 1) % DAYS_PER_YEAR) / DAYS_PER_SEASON);
  return SEASONS[index] ?? 'Spring';
}

/** Day of the season, 1 to 30. */
export function seasonDay(day: number): number {
  return ((day - 1) % DAYS_PER_SEASON) + 1;
}

function watchMinutes(b: TimeBalance): number {
  return b.watchHours * 60;
}

/** Minutes since the day began at dayStart (0 to 1439). */
export function minutesIntoDay(cal: CalendarState, b: TimeBalance): number {
  return (cal.minuteOfDay - b.dayStart + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function watchIndex(cal: CalendarState, b: TimeBalance): number {
  return Math.floor(minutesIntoDay(cal, b) / watchMinutes(b));
}

export function watchOf(cal: CalendarState, b: TimeBalance): Watch {
  return WATCHES[watchIndex(cal, b)] ?? 'Night';
}

/** Moves the calendar forward by `minutes`; the day turns at dayStart. */
export function advanceMinutes(cal: CalendarState, minutes: number, b: TimeBalance): CalendarState {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error(`advanceMinutes needs a whole, non-negative number, got ${minutes}`);
  }
  const total = minutesIntoDay(cal, b) + minutes;
  return {
    day: cal.day + Math.floor(total / MINUTES_PER_DAY),
    minuteOfDay: ((total % MINUTES_PER_DAY) + b.dayStart) % MINUTES_PER_DAY,
  };
}

/** The clock time `minutes` after midnight as HH:MM. */
export function clockText(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The tide phase of global watch `g` (0 is day 1, Morning). */
function phaseOfWatch(g: number, b: TimeBalance): TidePhase {
  const day = Math.floor(g / WATCHES.length) + 1;
  const shift = Math.floor((day - 1) / b.tide.phaseShiftDays);
  return (g + shift) % 2 === 0 ? 'FLOOD' : 'EBB';
}

/** Whether low water falls at the end of global watch `g`: an ebb that turns to flood. */
function lowWaterEnds(g: number, b: TimeBalance): boolean {
  return phaseOfWatch(g, b) === 'EBB' && phaseOfWatch(g + 1, b) === 'FLOOD';
}

export function tideAt(cal: CalendarState, b: TimeBalance): TideState {
  const span = watchMinutes(b);
  const g = (cal.day - 1) * WATCHES.length + watchIndex(cal, b);
  const intoWatch = minutesIntoDay(cal, b) % span;

  let toLow = span - intoWatch;
  let next = g;
  while (!lowWaterEnds(next, b)) {
    next++;
    toLow += span;
  }
  let sinceLow = intoWatch;
  let prev = g - 1;
  while (prev >= 0 && !lowWaterEnds(prev, b)) {
    prev--;
    sinceLow += span;
  }
  if (prev < 0) sinceLow = Number.POSITIVE_INFINITY;

  const half = b.tide.tidalGroundWindowMinutes / 2;
  return {
    phase: phaseOfWatch(g, b),
    springTide: b.tide.springTideDays.includes(seasonDay(cal.day)),
    minutesToLowWater: toLow,
    minutesSinceLowWater: sinceLow,
    tidalGroundOpen: toLow <= half || sinceLow < half,
  };
}

/** Whether it is light at this time and season (Book 10 daylight table). */
export function isDaylight(cal: CalendarState, b: TimeBalance): boolean {
  const { lightFrom, darkFrom } = b.daylight[seasonOf(cal.day)];
  return cal.minuteOfDay >= lightFrom && cal.minuteOfDay < darkFrom;
}
