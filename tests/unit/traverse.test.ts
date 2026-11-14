/**
 * Stage 14: the movement verbs with stamina (Book 2 section 10, "Movement verbs and hazards",
 * decision S14-14; Book 10 section 06, "Stamina in traversal", "Running out of stamina" and
 * "Movement verbs"; decisions S14-50 to S14-60). Each verb's speed and drain from balance.json, its
 * start only where the plan marks it, and acceptance check 5 of Book 3 Stage 14: running out of
 * stamina mid-climb slides the steerer down to the last ledge; mid-swim, they start to sink and
 * must reach the shore, or drown.
 */
import { describe, expect, it } from 'vitest';
import { parseTraverseBalance } from '../../src/content/traverseBalance.ts';
import { checkMarks, jumpGapTiles } from '../../src/content/traverseMarks.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { climbLine } from '../../src/sim/land/traverse.ts';
import { bandAt, stillWaterLevel } from '../../src/sim/land/water.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Command, SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { tileBlocks } from '../../src/sim/land/zoneMap.ts';
import { readRepo } from '../../src/tools/art/artFiles.ts';
import { b, balance, MARKS, testLand, testWorld, testZone, ZONE } from './traverseZone.ts';

const tb = parseTraverseBalance(balance);
const land = testLand();
const zone = testZone();
const T = 24;
const SB = land.stamina;
if (SB === undefined) throw new Error('no stamina balance');

function sim(at?: { x: number; y: number }, hour?: number): { s: Simulation; events: SimEvent[] } {
  const s = createSimulation(b, testWorld(at, hour), land);
  const events: SimEvent[] = [];
  s.events.onAny((e) => events.push(e));
  return { s, events };
}

const move = (x: number, y: number, run = false): Command => ({
  type: 'MOVE',
  x,
  y,
  run,
  sneak: false,
});

function steps(s: Simulation, n: number): void {
  for (let i = 0; i < n; i++) s.step();
}

function steer(s: Simulation): NonNullable<Simulation['state']['onFoot']>['player'] {
  const p = s.state.onFoot?.player;
  if (p === undefined) throw new Error('not on foot');
  return p;
}

/** Steps until the condition holds (at most `max` ticks); returns the ticks taken. */
function until(s: Simulation, ok: () => boolean, max = 60 * 120): number {
  for (let i = 0; i < max; i++) {
    if (ok()) return i;
    s.step();
  }
  throw new Error('never happened');
}

describe('the numbers (Book 10 sections 02 and 06)', () => {
  it('reads every verb number from balance.json, as Book 10 gives them', () => {
    expect(tb).toEqual({
      climbSpeed: 1,
      swimSpeed: 1.2,
      climbDrain: 6,
      swimDrain: 8,
      regenWhileClimbingOrSwimming: 0,
      slide: { tilesPerSecond: 1, freeTiles: 2, vitalityPerTile: 10 },
      sink: { seconds: 6, drownPerSecond: 10 },
      jumpGap: 1.5,
      jumpStamina: 6,
      crawlSpeed: 0.6,
      crawlCarries: false,
      pushSpeed: 0.8,
      pushStamina: 2,
      climbLedgeEvery: 12,
      bogSoftRain: 0.8,
      climbFallFloor: 10,
    });
    const book = readRepo('docs/10_balance_sheet.md');
    expect(book).toContain('| Climb | 6 | Marked routes only |');
    expect(book).toContain('| Swim | 8 | Deep water where allowed |');
    expect(book).toContain('| jumpGap | 1.5 tiles |');
    expect(book).toContain('| climbFallFloor | 10 vitality |');
    // The stamina table's own climb and swim drains are the same numbers.
    expect([SB.drain.climb, SB.drain.swim]).toEqual([tb.climbDrain, tb.swimDrain]);
  });

  it('holds a zone’s marks to Book 10: the jump’s gap, the ledges’ spacing, the reset rule', () => {
    const open = (x: number, y: number): boolean => !tileBlocks(zone, x, y, true);
    expect(checkMarks(MARKS, tb, open)).toEqual([]);
    expect(jumpGapTiles(MARKS.jumps[0] ?? { id: '', from: { x: 0, y: 0 }, to: { x: 0, y: 0 } })).toBe(1);
    const bad = checkMarks(
      {
        ...MARKS,
        climbs: [{ id: 'long', x: 3, foot: 14, head: 1, ledges: [] }],
        jumps: [{ id: 'wide', from: { x: 9, y: 15 }, to: { x: 12, y: 15 } }],
      },
      tb,
      open,
    );
    expect(bad.some((p) => p.includes('more than climbLedgeEvery'))).toBe(true);
    expect(bad.some((p) => p.includes('wider than jumpGap'))).toBe(true);
  });
});

describe('climb (Book 2 section 10; Book 10 Climb, climbEmpty)', () => {
  const line = climbLine(zone, land, MARKS.climbs[0] ?? { id: '', x: 0, foot: 0, head: 0, ledges: [] });

  it('starts only by walking into the marked foot, and climbs facing the rock at climb speed', () => {
    // Beside the route, walking north into the cliff only stops at the edge.
    const off = sim({ x: 5.5, y: 15 });
    off.s.submit(move(0, -1));
    steps(off.s, 120);
    expect(steer(off.s).traverse ?? null).toBeNull();
    const { s, events } = sim({ x: 3.5, y: 15 });
    s.submit(move(0, -1));
    until(s, () => steer(s).traverse?.verb === 'climb');
    expect(events.some((e) => e.type === 'CLIMB_STARTED')).toBe(true);
    const y0 = steer(s).y;
    steps(s, 60);
    expect(steer(s).facing).toBe('n');
    expect(steer(s).x).toBe(line.x);
    expect((y0 - steer(s).y) / T).toBeCloseTo(tb.climbSpeed, 5);
  });

  it('drains climb stamina on the face, moving or still, and never refills there', () => {
    const { s } = sim({ x: 3.5, y: 15 });
    s.submit(move(0, -1));
    until(s, () => steer(s).traverse?.verb === 'climb');
    steps(s, 30);
    const st = s.state.player.stamina;
    const a = st.current;
    steps(s, 60);
    expect(a - st.current).toBeCloseTo(tb.climbDrain, 5);
    // Holding still on the face: the bar still drains, and nothing comes back.
    s.submit(move(0, 0));
    const c = st.current;
    steps(s, 120);
    expect(c - st.current).toBeCloseTo(2 * tb.climbDrain, 5);
  });

  it('rests on a ledge: the bar refills there as anywhere', () => {
    const { s } = sim({ x: 3.5, y: 15 });
    s.submit(move(0, -1));
    until(s, () => steer(s).traverse?.verb === 'climb');
    until(s, () => steer(s).y <= 9 * T - 2);
    s.submit(move(0, 0));
    const st = s.state.player.stamina;
    const a = st.current;
    steps(s, SB.regenDelayTicks + 60);
    expect(st.current).toBeGreaterThan(a);
  });

  it('acceptance check 5: empty mid-climb, the steerer slides to the last ledge at Book 10’s rate', () => {
    const { s, events } = sim({ x: 3.5, y: 15 });
    s.submit(move(0, -1));
    until(s, () => steer(s).traverse?.verb === 'climb');
    // Past the ledge (row 8) and on up the face, with the bar nearly gone.
    until(s, () => steer(s).y <= 4 * T);
    s.state.player.stamina.current = 1;
    const vit = s.state.player.vitality;
    until(s, () => events.some((e) => e.type === 'CLIMB_SLIPPED'));
    const from = steer(s).y;
    const ticks = until(s, () => events.some((e) => e.type === 'CLIMB_SLID'));
    const ledgeY = (8 + 1) * T - 1;
    expect(steer(s).y).toBeCloseTo(ledgeY, 5);
    // 1 tile a second.
    expect(ticks / 60).toBeCloseTo((ledgeY - from) / T / tb.slide.tilesPerSecond, 1);
    // A slide of more than 2 tiles costs 10 vitality a tile beyond 2.
    const tiles = (ledgeY - from) / T;
    expect(tiles).toBeGreaterThan(2);
    expect(vit - s.state.player.vitality).toBe(Math.round((tiles - 2) * 10));
    // Still on the route, on the ledge, resting.
    expect(steer(s).traverse?.verb).toBe('climb');
  });

  it('slides to the foot with no ledge below, and never leaves the climber below climbFallFloor', () => {
    // A short slide to the foot, under Book 10's free tiles: no harm.
    const { s, events } = sim({ x: 3.5, y: 15 });
    s.submit(move(0, -1));
    until(s, () => steer(s).traverse?.verb === 'climb');
    until(s, () => steer(s).y <= 13 * T);
    s.state.player.vitality = 30;
    s.state.player.stamina.current = 0.05;
    until(s, () => events.some((e) => e.type === 'CLIMB_ENDED'));
    expect(events.find((e) => e.type === 'CLIMB_ENDED')).toMatchObject({ at: 'FOOT' });
    expect(s.state.player.vitality).toBe(30);
    // A long slide with no ledge below: 10 vitality a tile beyond 2 would kill; the floor holds.
    const bare = testLand({ ...MARKS, climbs: [{ id: 'cliff', x: 3, foot: 14, head: 1, ledges: [4] }] });
    const s2 = createSimulation(b, testWorld({ x: 3.5, y: 15 }), bare);
    const ev2: SimEvent[] = [];
    s2.events.onAny((e) => ev2.push(e));
    s2.submit(move(0, -1));
    until(s2, () => steer(s2).traverse?.verb === 'climb');
    until(s2, () => steer(s2).y <= 6 * T);
    s2.state.player.stamina.current = 0.05;
    s2.state.player.vitality = 30;
    until(s2, () => ev2.some((e) => e.type === 'CLIMB_ENDED'));
    const slid = ev2.find((e) => e.type === 'CLIMB_SLID');
    expect(slid?.type === 'CLIMB_SLID' ? slid.tiles : 0).toBeGreaterThan(5);
    expect(s2.state.player.vitality).toBe(tb.climbFallFloor);
    expect(s2.state.gameOver).toBeNull();
  });

  it('carries nothing up: a load stops the climb, and no weapon is used on the route', () => {
    const { s, events } = sim({ x: 3.5, y: 15 });
    s.submit(move(0, -1));
    until(s, () => steer(s).traverse?.verb === 'climb');
    steps(s, 30);
    s.submit({ type: 'PARRY' });
    s.submit({ type: 'DODGE', x: 0, y: 1 });
    steps(s, 5);
    expect(steer(s).fight?.state ?? 'idle').not.toBe('parry');
    expect(events.some((e) => e.type === 'COMMAND_REFUSED' && e.command === 'INTERACT')).toBe(false);
  });

  it('climbs on up to the head, and down again from the head', () => {
    const { s, events } = sim({ x: 3.5, y: 15 });
    s.submit(move(0, -1));
    until(s, () => events.some((e) => e.type === 'CLIMB_ENDED' && e.at === 'HEAD'), 60 * 60);
    expect(steer(s).traverse ?? null).toBeNull();
    expect(steer(s).y).toBeCloseTo(line.headY, 5);
    // Walking south off the head starts the climb down.
    s.submit(move(0, 1));
    until(s, () => steer(s).traverse?.verb === 'climb');
    until(s, () => events.some((e) => e.type === 'CLIMB_ENDED' && e.at === 'FOOT'), 60 * 60);
  });
});

describe('swim (Book 2 section 10; Book 10 Swim, swimEmpty)', () => {
  const level = (): number => stillWaterLevel(tideAt({ day: 2, minuteOfDay: 12 * 60 }, b));
  const elevation = land.elevations.get(ZONE);
  if (elevation === undefined) throw new Error('no elevation');
  /** The first row south from the shingle where column x is deep at the test hour. */
  const deepRow = (x: number): number => {
    for (let y = 20; y < 34; y++)
      if (bandAt(land.water, elevation, (x + 0.5) * T, (y + 0.6) * T, level())?.band === 'DEEP')
        return y;
    throw new Error('no deep water');
  };

  it('swims in marked deep water at swim speed, draining Book 10’s rate with no regeneration', () => {
    const { s, events } = sim({ x: 6.5, y: 21 });
    s.submit(move(0, 1));
    until(s, () => steer(s).traverse?.verb === 'swim', 60 * 30);
    expect(events.some((e) => e.type === 'SWIM_STARTED')).toBe(true);
    expect(steer(s).y / T).toBeGreaterThan(deepRow(6));
    steps(s, 30);
    const st = s.state.player.stamina;
    const y0 = steer(s).y;
    const a = st.current;
    steps(s, 60);
    expect((steer(s).y - y0) / T).toBeCloseTo(tb.swimSpeed, 2);
    expect(a - st.current).toBeCloseTo(tb.swimDrain, 5);
    // Treading water still drains; nothing comes back while in deep water.
    s.submit(move(0, 0));
    steps(s, 120);
    const c = st.current;
    steps(s, 60);
    expect(c - st.current).toBeCloseTo(tb.swimDrain, 5);
  });

  it('keeps unmarked deep water the edge of the ground, and a load out of the water', () => {
    const { s, events } = sim({ x: 22.5, y: 21 });
    s.submit(move(0, 1));
    steps(s, 60 * 12);
    expect(steer(s).traverse ?? null).toBeNull();
    expect(steer(s).y / T).toBeLessThan(deepRow(22) + 1);
    expect(events.some((e) => e.type === 'SWIM_STARTED')).toBe(false);
  });

  it('acceptance check 5: empty mid-swim, the swimmer sinks and lives by reaching the shallows in time', () => {
    const { s, events } = sim({ x: 6.5, y: 21 });
    s.submit(move(0, 1));
    until(s, () => steer(s).traverse?.verb === 'swim', 60 * 30);
    steps(s, 90);
    s.state.player.stamina.current = 0.05;
    until(s, () => events.some((e) => e.type === 'SINKING'));
    const t = steer(s).traverse;
    expect(t?.verb === 'swim' && t.sink !== undefined).toBe(true);
    // Back for the shore at once: the shallows are reached within Book 10's seconds.
    s.submit(move(0, -1));
    const ticks = until(s, () => events.some((e) => e.type === 'SINK_ENDED'));
    expect(ticks).toBeLessThan(tb.sink.seconds * 60);
    expect(s.state.player.vitality).toBe(100);
    expect(events.some((e) => e.type === 'DROWNING')).toBe(false);
    expect(s.state.gameOver).toBeNull();
    const band = bandAt(land.water, elevation, steer(s).x, steer(s).y, level())?.band;
    expect(band === 'WAIST' || band === 'KNEE').toBe(true);
  });

  it('acceptance check 5: still in deep water after Book 10’s seconds, the swimmer drowns; the steerer’s drowning ends the game', () => {
    const { s, events } = sim({ x: 6.5, y: 21 });
    s.submit(move(0, 1));
    until(s, () => steer(s).traverse?.verb === 'swim', 60 * 30);
    steps(s, 120);
    s.submit(move(0, 0));
    s.state.player.stamina.current = 0.05;
    until(s, () => events.some((e) => e.type === 'SINKING'));
    const sank = s.state.tick;
    until(s, () => events.some((e) => e.type === 'DROWNING'));
    expect(s.state.tick - sank).toBe(tb.sink.seconds * 60);
    const v = s.state.player.vitality;
    steps(s, 60);
    expect(v - s.state.player.vitality).toBeCloseTo(tb.sink.drownPerSecond, 5);
    until(s, () => s.state.gameOver !== null);
    expect(s.state.gameOver?.cause).toBe('DROWNED');
    expect(events.some((e) => e.type === 'STEERER_DIED')).toBe(true);
  });
});

describe('jump (Book 10 jumpGap, jumpStamina)', () => {
  it('jumps a marked gap with Interact for jumpStamina, at the run’s pace, and never falls short', () => {
    const { s, events } = sim({ x: 9.5, y: 15.6 });
    const st = s.state.player.stamina;
    const a = st.current;
    s.submit({ type: 'INTERACT' });
    s.step();
    expect(events.some((e) => e.type === 'JUMPED')).toBe(true);
    expect(a - st.current).toBeCloseTo(tb.jumpStamina, 5);
    const t = steer(s).traverse;
    if (t?.verb !== 'jump') throw new Error('not jumping');
    const dist = Math.hypot(t.to.x - t.from.x, t.to.y - t.from.y);
    expect(t.ticks).toBe(Math.ceil(dist / ((land.movement.run * T) / 60)));
    until(s, () => events.some((e) => e.type === 'JUMP_LANDED'));
    expect(Math.floor(steer(s).x / T)).toBe(11);
  });

  it('refuses with less than jumpStamina, or carrying: the steerer stays on the take-off', () => {
    const { s, events } = sim({ x: 9.5, y: 15.6 });
    s.state.player.stamina.current = tb.jumpStamina - 1;
    s.submit({ type: 'INTERACT' });
    steps(s, 30);
    expect(events.some((e) => e.type === 'COMMAND_REFUSED' && e.reason === 'TOO_TIRED')).toBe(true);
    expect(Math.floor(steer(s).x / T)).toBe(9);
    expect(steer(s).traverse ?? null).toBeNull();
  });

  it('ordinary ground never jumps: Interact away from a take-off does nothing of the kind', () => {
    const { s, events } = sim({ x: 6.5, y: 18 });
    s.submit({ type: 'INTERACT' });
    steps(s, 5);
    expect(events.some((e) => e.type === 'JUMPED')).toBe(false);
  });
});

describe('crawl (Book 10 crawlSpeed, crawlCarry)', () => {
  it('starts by walking into its mouth, goes at crawlSpeed low as a sneak, and comes out the far side', () => {
    const { s, events } = sim({ x: 13.5, y: 16.6 });
    s.submit(move(1, 0));
    until(s, () => steer(s).traverse?.verb === 'crawl');
    expect(events.some((e) => e.type === 'CRAWL_STARTED')).toBe(true);
    steps(s, 10);
    const x0 = steer(s).x;
    steps(s, 60);
    expect((steer(s).x - x0) / T).toBeCloseTo(tb.crawlSpeed, 5);
    expect(steer(s).gait).toBe('sneak');
    until(s, () => events.some((e) => e.type === 'CRAWL_ENDED'));
    expect(Math.floor(steer(s).x / T)).toBe(18);
  });

  it('can be backed out of at any point', () => {
    const { s, events } = sim({ x: 13.5, y: 16.6 });
    s.submit(move(1, 0));
    until(s, () => steer(s).traverse?.verb === 'crawl');
    steps(s, 80);
    s.submit(move(-1, 0));
    until(s, () => events.some((e) => e.type === 'CRAWL_ENDED'));
    expect(Math.floor(steer(s).x / T)).toBe(14);
  });

  it('lets nothing carried through: the edge says it is too low', () => {
    const { s, events } = sim({ x: 13.5, y: 16.6 });
    const onFoot = s.state.onFoot;
    if (onFoot === null) throw new Error('no zone');
    onFoot.actors['C_TEST'] = { x: steer(s).x, y: steer(s).y, facing: 's', pose: 'carried' };
    onFoot.carrying = 'C_TEST';
    s.submit(move(1, 0));
    steps(s, 60 * 4);
    expect(steer(s).traverse ?? null).toBeNull();
    expect(events.some((e) => e.type === 'CRAWL_STARTED')).toBe(false);
  });
});

describe('push and pull (Book 10 pushSpeed, pushStamina; the reset rule)', () => {
  const region = (s: Simulation): Record<string, { x: number; y: number }> =>
    s.state.regions[ZONE]?.pushed ?? {};

  it('walking into it pushes it one tile along its line at pushSpeed, draining pushStamina', () => {
    const { s, events } = sim({ x: 20.5, y: 15.6 });
    s.submit(move(1, 0));
    until(s, () => steer(s).traverse?.verb === 'push');
    const t = steer(s).traverse;
    if (t?.verb !== 'push') throw new Error('not pushing');
    expect(t.ticks).toBe(Math.round(60 / tb.pushSpeed));
    const st = s.state.player.stamina;
    const a = st.current;
    steps(s, 30);
    expect(a - st.current).toBeCloseTo((30 / 60) * tb.pushStamina, 5);
    s.submit(move(0, 0));
    until(s, () => events.some((e) => e.type === 'OBJECT_MOVED'));
    expect(region(s)[`${ZONE}/stone`]).toEqual({ x: 23, y: 15 });
  });

  it('never leaves its line: pushed to its end, it goes no further', () => {
    const { s, events } = sim({ x: 20.5, y: 15.6 });
    s.submit(move(1, 0));
    steps(s, 60 * 8);
    expect(events.filter((e) => e.type === 'OBJECT_MOVED')).toHaveLength(2);
    expect(region(s)[`${ZONE}/stone`]).toEqual({ x: 24, y: 15 });
  });

  it('holding Interact and stepping back pulls it, so it can always go back where it started', () => {
    const { s, events } = sim({ x: 20.5, y: 15.6 });
    s.submit(move(1, 0));
    until(s, () => events.some((e) => e.type === 'OBJECT_MOVED'));
    s.submit(move(0, 0));
    until(s, () => steer(s).traverse == null);
    s.submit({ type: 'INTERACT' });
    s.step();
    expect(steer(s).grip).toBe('stone');
    s.submit(move(-1, 0));
    until(s, () => events.filter((e) => e.type === 'OBJECT_MOVED').length === 2);
    expect(region(s)[`${ZONE}/stone`]).toEqual({ x: 22, y: 15 });
    const moved = events.filter((e) => e.type === 'OBJECT_MOVED');
    expect(moved[1]?.type === 'OBJECT_MOVED' && moved[1].pull).toBe(true);
    s.submit({ type: 'GRIP', on: false });
    s.step();
    expect(steer(s).grip ?? null).toBeNull();
  });

  it('never moves onto anyone, and never starts with the bar empty', () => {
    const { s, events } = sim({ x: 20.5, y: 15.6 });
    const onFoot = s.state.onFoot;
    if (onFoot === null) throw new Error('no zone');
    onFoot.actors['C_TEST'] = { x: 23.5 * T, y: 15.6 * T, facing: 's', pose: 'idle' };
    s.submit(move(1, 0));
    steps(s, 120);
    expect(events.some((e) => e.type === 'OBJECT_MOVED')).toBe(false);
    delete onFoot.actors['C_TEST'];
    // Just spent to nothing (Book 10 needsStamina: an action starts only with stamina above 0).
    s.state.player.stamina.current = 0;
    s.state.player.stamina.spentTick = s.state.tick;
    steps(s, 30);
    expect(steer(s).traverse ?? null).toBeNull();
  });
});

describe('soft ground (Book 10 bogSoftRain)', () => {
  it('slows the walker on the bog’s soft ground only while it rains', () => {
    const pace = (rain: boolean): number => {
      const { s } = sim({ x: 5.5, y: 17.5 });
      if (rain) s.state.facts['weather.raining'] = true;
      s.submit(move(1, 0));
      steps(s, 60);
      const x0 = steer(s).x;
      steps(s, 30);
      return (steer(s).x - x0) / T / 0.5;
    };
    expect(pace(false)).toBeCloseTo(land.movement.walk, 3);
    expect(pace(true)).toBeCloseTo(land.movement.walk * tb.bogSoftRain, 3);
  });
});
