/** Stage 2 acceptance check 2: the day, sleep, collapse and tide rules against Book 10. */
import { describe, expect, it } from 'vitest';
import { parseTimeBalance } from '../../src/content/balance.ts';
import {
  advanceMinutes,
  isDaylight,
  seasonDay,
  seasonOf,
  tideAt,
  watchOf,
  yearOf,
} from '../../src/sim/calendar/calendar.ts';
import { createSimulation, initialState } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { loadBalanceJson, loadTimeBalance } from '../../src/tools/content/loadBalance.ts';

const b = loadTimeBalance();
const at = (day: number, hh: number, mm = 0) => ({ day, minuteOfDay: hh * 60 + mm });

function newSim(): { sim: Simulation; events: SimEvent[] } {
  const sim = createSimulation(b, initialState('calendar-test', b));
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  return { sim, events };
}

/** Steps until an event of `type` appears; returns the ticks taken. */
function runUntil(
  sim: Simulation,
  events: SimEvent[],
  type: SimEvent['type'],
  limit = 200_000,
): number {
  const start = sim.state.tick;
  const seen = events.length;
  while (!events.slice(seen).some((e) => e.type === type)) {
    if (sim.state.tick - start > limit) throw new Error(`no ${type} within ${limit} ticks`);
    sim.step();
  }
  return sim.state.tick - start;
}

/** Steps until the clock shows hh:mm. */
function runTo(sim: Simulation, hh: number, mm = 0): void {
  while (sim.state.calendar.minuteOfDay !== hh * 60 + mm) sim.step();
}

describe('Book 10 section 02 values from balance.json', () => {
  it('reads the clock, daylight and tide', () => {
    expect(b.secondsPerHour).toBe(50);
    expect([b.dayStart, b.dayEnd, b.sleepAfter]).toEqual([6 * 60, 2 * 60, 18 * 60]);
    expect(b.collapse).toEqual({ wakeAt: 8 * 60, staminaMaxChange: -30 });
    expect(b.dayLength).toEqual({ min: 0.75, max: 1.5 });
    expect(b.watchHours).toBe(6);
    expect(b.daylight.Winter).toEqual({ lightFrom: 8 * 60 + 30, darkFrom: 16 * 60 });
    expect(b.tide).toEqual({
      phaseShiftDays: 3,
      springTideDays: [1, 2, 3, 16, 17, 18],
      tidalGroundWindowMinutes: 180,
    });
  });

  it('refuses a balance file whose wording it cannot read', () => {
    const json = loadBalanceJson() as {
      tables: { timeAndTravel: { tide: { Key: string; Value: string }[] } };
    };
    const broken = structuredClone(json);
    const row = broken.tables.timeAndTravel.tide.find((r) => r.Key === 'phaseShift');
    if (row !== undefined) row.Value = 'often';
    expect(() => parseTimeBalance(broken)).toThrow(/tide\.phaseShift is "often"/);
  });
});

describe('the year', () => {
  it.each([
    [1, 'Spring', 1, 1],
    [30, 'Spring', 30, 1],
    [31, 'Summer', 1, 1],
    [61, 'Autumn', 1, 1],
    [91, 'Winter', 1, 1],
    [120, 'Winter', 30, 1],
    [121, 'Spring', 1, 2],
    // Book 1 section 04: the campaign ends in the spring of a third year.
    [270, 'Spring', 30, 3],
  ])('day %i is %s, day %i of the season, year %i', (day, season, sd, year) => {
    expect([seasonOf(day), seasonDay(day), yearOf(day)]).toEqual([season, sd, year]);
  });

  it('turns the day at 06:00 and names the four watches', () => {
    expect(advanceMinutes(at(1, 5, 59), 1, b)).toEqual(at(2, 6));
    expect(advanceMinutes(at(1, 23, 0), 120, b)).toEqual(at(1, 1));
    expect([at(1, 6), at(1, 12), at(1, 18), at(1, 0)].map((c) => watchOf(c, b))).toEqual([
      'Morning',
      'Day',
      'Evening',
      'Night',
    ]);
  });

  it('follows the Book 10 daylight table', () => {
    expect(isDaylight(at(1, 6, 29), b)).toBe(false);
    expect(isDaylight(at(1, 6, 30), b)).toBe(true);
    expect(isDaylight(at(1, 20, 0), b)).toBe(false);
    expect(isDaylight(at(31, 4, 30), b)).toBe(true);
    expect(isDaylight(at(91, 16, 0), b)).toBe(false);
  });
});

describe('the on-foot day (06:00 to 02:00 at Book 10 rate)', () => {
  it('runs 20 game hours, about 16.7 real minutes, then collapses at 02:00', () => {
    const { sim, events } = newSim();
    const ticks = runUntil(sim, events, 'COLLAPSED');
    expect(ticks).toBe(20 * 60 * b.secondsPerHour);
    expect(ticks / 60 / 60).toBeCloseTo(b.activeDayMinutes, 1);
    expect(events.find((e) => e.type === 'COLLAPSED')).toMatchObject({ day: 1, at: '02:00' });
  });

  it('spends secondsPerHour real seconds per game hour', () => {
    const { sim } = newSim();
    for (let i = 0; i < 60 * b.secondsPerHour; i++) sim.step();
    expect(sim.state.calendar).toEqual(at(1, 7));
  });

  it.each([
    [0.75, 45_000],
    [1.5, 90_000],
  ])('scales with the day-length option (%f)', (multiplier, ticks) => {
    const { sim, events } = newSim();
    sim.submit({ type: 'SET_DAY_LENGTH', multiplier });
    expect(runUntil(sim, events, 'COLLAPSED')).toBe(ticks);
  });

  it('refuses a day length outside Book 10 range, with the range', () => {
    const { sim, events } = newSim();
    sim.submit({ type: 'SET_DAY_LENGTH', multiplier: 2 });
    sim.step();
    expect(events).toContainEqual({
      type: 'COMMAND_REFUSED',
      command: 'SET_DAY_LENGTH',
      reason: 'DAY_LENGTH_OUT_OF_RANGE',
      detail: '0.75 to 1.5',
    });
    expect(sim.state.clock.dayLengthPercent).toBe(100);
  });
});

describe('sleep and collapse', () => {
  it('refuses a bed before 18:00 and says when it will work', () => {
    const { sim, events } = newSim();
    runTo(sim, 17, 59);
    sim.submit({ type: 'SLEEP' });
    sim.step();
    expect(events).toContainEqual({
      type: 'COMMAND_REFUSED',
      command: 'SLEEP',
      reason: 'TOO_EARLY_TO_SLEEP',
      detail: '18:00',
    });
    expect(sim.state.calendar.day).toBe(1);
  });

  it.each([
    [18, 0],
    [23, 30],
    [1, 59],
  ])(
    'sleeping at %i:%i advances to 06:00 the next day and asks for the morning report',
    (hh, mm) => {
      const { sim, events } = newSim();
      runTo(sim, hh, mm);
      sim.submit({ type: 'SLEEP' });
      sim.step();
      expect(sim.state.calendar.day).toBe(2);
      expect(sim.state.calendar.minuteOfDay).toBe(6 * 60);
      const after = events.slice(events.findIndex((e) => e.type === 'SLEPT'));
      expect(after.map((e) => e.type)).toEqual(['SLEPT', 'WOKE', 'MORNING_REPORT_DUE']);
      expect(after[1]).toMatchObject({ cause: 'slept', day: 2, at: '06:00' });
    },
  );

  it('a collapse wakes the steerer at 08:00 next day with stamina max -30 for that day only', () => {
    const { sim, events } = newSim();
    runUntil(sim, events, 'COLLAPSED');
    expect(sim.state.calendar).toEqual(at(2, 8));
    // Book 10: the collapse's penalty is the Exhausted reason (No sleep, -30) until a full rest.
    expect(sim.state.player.stamina.reductions).toEqual([
      expect.objectContaining({ reason: 'EXHAUSTED', amount: 30 }),
    ]);
    expect(sim.state.player.stamina.max).toBe(sim.state.player.stamina.base - 30);
    expect(events.filter((e) => e.type === 'WOKE').at(-1)).toMatchObject({
      cause: 'collapsed',
      at: '08:00',
    });
    expect(events.at(-1)).toEqual({ type: 'MORNING_REPORT_DUE', day: 2 });
    runTo(sim, 18);
    sim.submit({ type: 'SLEEP' });
    sim.step();
    expect(sim.state.player.stamina.reductions).toEqual([]);
  });
});

describe('the tide', () => {
  it('floods and ebbs on alternate watches, starting with a flood', () => {
    const phases = [6, 12, 18, 0].map((h) => tideAt(at(1, h), b).phase);
    expect(phases).toEqual(['FLOOD', 'EBB', 'FLOOD', 'EBB']);
    expect(tideAt(at(2, 6), b).phase).toBe('FLOOD');
  });

  it('puts low water at the end of each ebb watch', () => {
    // Day 1: the ebb from 12:00 ends in low water at 18:00.
    expect(tideAt(at(1, 12), b).minutesToLowWater).toBe(360);
    expect(tideAt(at(1, 17, 30), b).minutesToLowWater).toBe(30);
    expect(tideAt(at(1, 18), b).minutesSinceLowWater).toBe(0);
    expect(tideAt(at(1, 18), b).minutesToLowWater).toBe(720);
  });

  it('shifts one watch every three days', () => {
    expect([1, 2, 3].map((d) => tideAt(at(d, 6), b).phase)).toEqual(['FLOOD', 'FLOOD', 'FLOOD']);
    expect([4, 5, 6].map((d) => tideAt(at(d, 6), b).phase)).toEqual(['EBB', 'EBB', 'EBB']);
    expect(tideAt(at(7, 6), b).phase).toBe('FLOOD');
    // The shift makes one long ebb (day 3 night and day 4 morning) with one low water at its end.
    expect(tideAt(at(3, 0), b)).toMatchObject({ phase: 'EBB', minutesToLowWater: 360 + 360 });
    expect(tideAt(at(4, 11, 0), b).minutesToLowWater).toBe(60);
  });

  it('opens tidal ground for the 3 game hours around low water', () => {
    expect(tideAt(at(1, 16, 29), b).tidalGroundOpen).toBe(false);
    expect(tideAt(at(1, 16, 30), b).tidalGroundOpen).toBe(true);
    expect(tideAt(at(1, 19, 29), b).tidalGroundOpen).toBe(true);
    expect(tideAt(at(1, 19, 30), b).tidalGroundOpen).toBe(false);
  });

  it('has spring tides on days 1, 2, 3 and 16, 17, 18 of each season', () => {
    const spring = Array.from({ length: 120 }, (_, i) => i + 1).filter(
      (d) => tideAt(at(d, 12), b).springTide,
    );
    const expected = [0, 30, 60, 90].flatMap((s) => [1, 2, 3, 16, 17, 18].map((d) => s + d));
    expect(spring).toEqual(expected);
  });

  it('reports watch changes and tide turns as events', () => {
    const { sim, events } = newSim();
    runUntil(sim, events, 'COLLAPSED');
    expect(
      events.filter((e) => e.type === 'WATCH_STARTED').map((e) => 'watch' in e && e.watch),
    ).toEqual(['Day', 'Evening', 'Night']);
    expect(events.filter((e) => e.type === 'TIDE_TURNED')).toHaveLength(3);
  });
});
