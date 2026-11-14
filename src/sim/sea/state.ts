/**
 * The sea's world state at rest (version 15, decision S13-16): no weather drawn yet, a fresh
 * governor, no course and no voyage. Kept apart from the rest of sim/sea so world.ts can make a new
 * campaign's sea without importing the sea's systems.
 */
import type { CalendarState } from '../calendar/calendar.ts';
import { advanceMinutes, minutesIntoDay } from '../calendar/calendar.ts';
import type { TimeBalance } from '../../content/balance.ts';
import type { SeaGovernor, SeaState } from './types.ts';

export function newGovernor(): SeaGovernor {
  return { legs: 0, eventful: 0, credit: 0, voyages: 0, supernatural: 0, superCredit: 0 };
}

export function newSeaState(): SeaState {
  return {
    weather: { rolledTo: 0, days: {}, forecasts: {}, years: {}, calmLeft: 0 },
    governor: newGovernor(),
    plan: null,
    voyage: null,
    stash: null,
    once: {},
  };
}

/** Game minutes since the campaign began (day 1, at dayStart, is 0). */
export function minuteOf(cal: CalendarState, b: TimeBalance): number {
  return (cal.day - 1) * 1440 + minutesIntoDay(cal, b);
}

/** The calendar at a campaign minute. */
export function calendarAt(minute: number, b: TimeBalance): CalendarState {
  return advanceMinutes({ day: 1, minuteOfDay: b.dayStart }, Math.max(0, Math.round(minute)), b);
}

/** The day of a campaign minute. */
export function dayAt(minute: number): number {
  return Math.floor(minute / 1440) + 1;
}
