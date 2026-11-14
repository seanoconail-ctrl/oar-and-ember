/**
 * Stage 14: the island's tide-gated ways walked in play, by commands only (Book 2 section 03: the
 * simulation takes commands; Book 9 sections 03 and 16; decisions S14-36, S14-110 to S14-113).
 *
 * - The Skerry's causeway is walked at a spring low out to the skerry's crown; at an ordinary low
 *   water the same walk stops at the causeway's foot.
 * - Seal Cave's back wall leads into the deep passage at a spring low; the passage is walked west,
 *   wading its pool, crawling under the fallen slab, wading its lowest point, into the cairn's
 *   tidal passage and on to the spring room, where the Seal Cave tides puzzle is solved.
 * - As the passage floods, whoever is still on its Seal Cave side wades out by the way in.
 *
 * The walker plans a way over the tiles a person can stand on (and the plan's crawl) and steps it
 * with MOVE commands, an axis at a time, as a player would hold a direction.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { crawlMouths, marksOf } from '../../src/content/traverseMarks.ts';
import { roarLevel } from '../../src/audio/islandAmbience.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { passageWater, puzzleState } from '../../src/sim/land/islandConditions.ts';
import { bandAt, isDeep, stillWaterLevel } from '../../src/sim/land/water.ts';
import { terrainAt, tileBlocks } from '../../src/sim/land/zoneMap.ts';
import type { ZoneMap } from '../../src/sim/land/zoneMap.ts';
import { zoneTide } from '../../src/sim/land/zoneWater.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Command, Simulation, SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const islandOrNull = land.island;
if (islandOrNull == null) throw new Error('no island context');
const island = islandOrNull;
const T = 24;

type Tile = readonly [number, number];

interface Run {
  readonly sim: Simulation;
  readonly events: SimEvent[];
  readonly send: (c: Command, steps?: number) => void;
}

function start(query: string): Run {
  const world = newCampaign('island-walk', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  const sim = createSimulation(b, world, land);
  campHooks(sim.state, content, land, new URLSearchParams(`camp=broch&crew=1&${query}`));
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  const send = (c: Command, steps = 1): void => {
    sim.submit(c);
    for (let i = 0; i < steps; i++) sim.step();
  };
  return { sim, events, send };
}

const hhmm = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** The first minute from `day` at which a (spring) low water's window has just opened. */
function windowOpens(day: number, spring: boolean): { day: number; minute: number } {
  for (let d = day; d < day + 120; d++)
    for (let m = 0; m < 1200; m += 5) {
      const minute = (b.dayStart + m) % 1440;
      const t = tideAt({ day: d, minuteOfDay: minute }, b);
      if (t.tidalGroundOpen && t.springTide === spring && t.minutesToLowWater >= 80)
        return { day: d, minute };
    }
  throw new Error('no low water');
}

function mapOf(zone: string): ZoneMap {
  const m = land.maps.get(zone);
  if (m === undefined) throw new Error(`no map ${zone}`);
  return m;
}

/** Where feet stand to fill a tile (src/sim/land/traverse.ts standPoint). */
const stand = (t: Tile): { x: number; y: number } => ({
  x: (t[0] + 0.5) * T,
  y: (t[1] + 0.5) * T + land.rules.footprint.h / 2,
});

/**
 * Whether a person may stand on a tile in the simulation now (the zone's tide and its wades);
 * `caught`: the closing tide's ground is wading water for whoever it caught (Book 10 "No trap").
 */
function standable(r: Run, map: ZoneMap, x: number, y: number, caught = false): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const tide = tideAt(r.sim.state.calendar, b);
  const passage = {
    water: passageWater(r.sim.state.calendar, b, island.ib),
    floors: island.puzzles.passage.floors ?? [],
  };
  const zt = zoneTide(map, tide, stillWaterLevel(tide), passage);
  if (tileBlocks(map, x, y, zt.open || caught, zt.spring || caught)) return false;
  for (const m of marksOf(map).pushes) {
    const at = m.line[m.start];
    if (at?.[0] === x && at[1] === y) return false;
  }
  const el = land.elevations.get(map.zone);
  if (el === undefined) return true;
  const { x: px, y: py } = stand([x, y]);
  return !isDeep(bandAt(land.water, el, px, py, zt.level, zt.wade));
}

/** A shortest way of tiles to a goal (four ways; the plan's crawls passed through). */
function plan(r: Run, map: ZoneMap, from: Tile, goal: Tile, caught = false): Tile[] | null {
  const crawl = new Set<string>();
  for (const c of marksOf(map).crawls) for (const t of c.tiles) crawl.add(`${t[0]},${t[1]}`);
  const k = (t: Tile): string => `${t[0]},${t[1]}`;
  const prev = new Map<string, string | null>([[k(from), null]]);
  const queue: Tile[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i];
    if (t === undefined) break;
    if (t[0] === goal[0] && t[1] === goal[1]) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n: Tile = [t[0] + dx, t[1] + dy];
      if (prev.has(k(n))) continue;
      if (!crawl.has(k(n)) && !standable(r, map, n[0], n[1], caught)) continue;
      prev.set(k(n), k(t));
      queue.push(n);
    }
  }
  if (!prev.has(k(goal))) return null;
  const out: Tile[] = [];
  for (let at: string | null = k(goal); at !== null; at = prev.get(at) ?? null) {
    const [x = 0, y = 0] = at.split(',').map(Number);
    out.push([x, y]);
  }
  return out.reverse();
}

const feetTile = (p: { x: number; y: number }): Tile => [
  Math.floor(p.x / T),
  Math.floor((p.y - 0.001) / T),
];

/**
 * Walks the steerer towards a tile of a zone by MOVE commands, replanning as it goes, until it
 * stands there, the zone changes, or `ticks` run out. Returns the ticks taken, or null.
 */
function walk(
  r: Run,
  zone: string,
  goal: Tile,
  ticks: number,
  spy?: (r: Run) => void,
  caught = false,
): number {
  const map = mapOf(zone);
  let last = '';
  for (let tick = 0; tick < ticks; tick++) {
    const of = r.sim.state.onFoot;
    if (of === null || of.zone !== zone) return tick;
    const p = of.player;
    const ft = feetTile(p);
    if (ft[0] === goal[0] && ft[1] === goal[1]) {
      r.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 1);
      return tick;
    }
    let ix = 0;
    let iy = 0;
    const t = p.traverse;
    if (t?.verb === 'crawl') {
      // Along the crawl, to the mouth on the far side from where it began.
      const c = marksOf(map).crawls.find((x) => x.id === t.crawl);
      if (c === undefined) throw new Error('no crawl');
      const [m0, m1] = crawlMouths(c);
      const goalSide =
        Math.hypot(m0[0] - goal[0], m0[1] - goal[1]) < Math.hypot(m1[0] - goal[0], m1[1] - goal[1])
          ? { mouth: m0, inner: c.tiles[0] }
          : { mouth: m1, inner: c.tiles[c.tiles.length - 1] };
      const inner = goalSide.inner ?? goalSide.mouth;
      ix = Math.sign(goalSide.mouth[0] - inner[0]);
      iy = Math.sign(goalSide.mouth[1] - inner[1]);
    } else {
      const way = plan(r, map, ft, goal, caught);
      const next = way?.[1];
      if (way === null || next === undefined) {
        r.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 1);
        spy?.(r);
        continue;
      }
      // Centre on the axis across the step first, then step along it (no diagonal into a wall).
      const sx = next[0] - ft[0];
      const sy = next[1] - ft[1];
      const here = stand(ft);
      const ex = sx === 0 ? here.x - p.x : 0;
      const ey = sy === 0 ? here.y - p.y : 0;
      if (Math.abs(ex) > 1.5 || Math.abs(ey) > 1.5) {
        ix = Math.abs(ex) > 1.5 ? Math.sign(ex) : 0;
        iy = Math.abs(ey) > 1.5 ? Math.sign(ey) : 0;
      } else {
        ix = sx;
        iy = sy;
      }
    }
    const key = `${ix},${iy}`;
    if (key !== last) {
      r.sim.submit({ type: 'MOVE', x: ix, y: iy, run: false, sneak: false });
      last = key;
    }
    r.sim.step();
    spy?.(r);
  }
  return ticks;
}

const sealCave = 'ZONE_SK_SEALCAVE';
const deep = 'ZONE_SK_SEALCAVE_DEEP';
const cairnIn = 'ZONE_SK_CAIRN_IN';
const skerry = 'ZONE_SK_SKERRY';
const built = [sealCave, deep, cairnIn, skerry].every((z) => land.maps.has(z));

describe.skipIf(!built)("the island's tide-gated ways, walked by commands (S14-110 to S14-113)", () => {
  it('walks the Skerry causeway at a spring low, and not at an ordinary low water', () => {
    const map = mapOf(skerry);
    const from: Tile = [2, 50];
    const crown: Tile = [55, 86];
    const spring = windowOpens(1, true);
    const r = start(`zone=${skerry}&at=${from[0] + 0.5},${from[1] + 0.8}&day=${spring.day}&time=${hhmm(spring.minute)}`);
    let onCauseway = false;
    walk(r, skerry, crown, 60 * 90, (x) => {
      const p = x.sim.state.onFoot?.player;
      if (p === undefined) return;
      const ft = feetTile(p);
      if (terrainAt(map, ft[0], ft[1]) === 'causeway') onCauseway = true;
    });
    const p = r.sim.state.onFoot?.player;
    if (p === undefined) throw new Error('not on foot');
    expect(onCauseway).toBe(true);
    expect(feetTile(p)).toEqual(crown);
    // An ordinary low water: the causeway stays awash; the walk never sets foot on it.
    const plain = windowOpens(4, false);
    const r2 = start(`zone=${skerry}&at=${from[0] + 0.5},${from[1] + 0.8}&day=${plain.day}&time=${hhmm(plain.minute)}`);
    let wet = false;
    walk(r2, skerry, crown, 60 * 40, (x) => {
      const q = x.sim.state.onFoot?.player;
      if (q === undefined) return;
      const ft = feetTile(q);
      if (terrainAt(map, ft[0], ft[1]) === 'causeway') wet = true;
    });
    expect(wet).toBe(false);
    const q = r2.sim.state.onFoot?.player;
    expect(q === undefined ? null : feetTile(q)).not.toEqual(crown);
  });

  it('goes through the back wall at a spring low, along the deep passage and its crawl, into the cairn to the spring room', () => {
    const w = windowOpens(1, true);
    // In Seal Cave's inner chamber, below the back wall.
    const r = start(`zone=${sealCave}&at=56.5,21.8&day=${w.day}&time=${hhmm(w.minute)}`);
    expect(r.sim.state.onFoot?.zone).toBe(sealCave);
    // Walk north into the back wall: the passage.
    r.send({ type: 'MOVE', x: 0, y: -1, run: false, sneak: false }, 240);
    expect(r.sim.state.onFoot?.zone).toBe(deep);
    expect(r.events).toContainEqual(
      expect.objectContaining({ type: 'ZONE_ENTERED', zone: deep, from: sealCave }),
    );
    // West along the passage to B, crawling the slab (the stone still lies in the wide way).
    const verbs: string[] = [];
    walk(r, deep, [0, 14], 60 * 120, (x) => {
      const v = x.sim.state.onFoot?.player.traverse?.verb;
      if (v !== undefined && verbs.at(-1) !== v) verbs.push(v);
    });
    expect(verbs).toContain('crawl');
    // Over the west edge into the cairn's tidal passage, then up the outflow to the spring room.
    r.send({ type: 'MOVE', x: -1, y: 0, run: false, sneak: false }, 60);
    expect(r.sim.state.onFoot?.zone).toBe(cairnIn);
    walk(r, cairnIn, [7, 21], 60 * 120);
    expect(r.sim.state.facts['sealcave.passage.found']).toBe(true);
    expect(puzzleState(r.sim.state, island, 'PUZ_SEALCAVE_TIDES')).toBe('FOUND');
    // Still inside the window: the whole way took less than the spring low.
    expect(tideAt(r.sim.state.calendar, b).tidalGroundOpen).toBe(true);
  });

  it('keeps the back wall shut at an ordinary low water', () => {
    const w = windowOpens(4, false);
    const r = start(`zone=${sealCave}&at=56.5,21.8&day=${w.day}&time=${hhmm(w.minute)}`);
    r.send({ type: 'MOVE', x: 0, y: -1, run: false, sneak: false }, 240);
    expect(r.sim.state.onFoot?.zone).toBe(sealCave);
  });

  it('wades the pool and the lowest point at the bands the tide gives them', () => {
    const w = windowOpens(1, true);
    const r = start(`zone=${deep}&at=36.5,10.8&day=${w.day}&time=${hhmm(w.minute)}`);
    const map = mapOf(deep);
    const tide = tideAt(r.sim.state.calendar, b);
    const zt = zoneTide(map, tide, stillWaterLevel(tide), {
      water: passageWater(r.sim.state.calendar, b, island.ib),
      floors: island.puzzles.passage.floors ?? [],
    });
    const el = land.elevations.get(deep);
    if (el === undefined) throw new Error('no elevation');
    const band = (t: Tile): string | undefined => {
      const s = stand(t);
      return bandAt(land.water, el, s.x, s.y, zt.level, zt.wade)?.band;
    };
    expect(band([36, 10])).toBe('KNEE');
    expect(band([10, 15])).toBe('WAIST');
    // The dry banks between are not water.
    expect(band([27, 9])).toBeUndefined();
  });

  it('says the passage grows loud once as the spring tide turns, as its roar comes in (S14-115)', () => {
    const w = windowOpens(1, true);
    let cal = { day: w.day, minuteOfDay: w.minute };
    while (tideAt(cal, b).minutesToLowWater > 2)
      cal = { day: cal.day, minuteOfDay: cal.minuteOfDay + 1 };
    const r = start(`zone=${deep}&at=27.5,9.8&day=${cal.day}&time=${hhmm(cal.minuteOfDay)}`);
    const loud = (): SimEvent[] =>
      r.events.filter(
        (e) => e.type === 'ISLAND_INFO' && (e as { sound?: string }).sound === 'PASSAGE_LOUD',
      );
    expect(loud()).toHaveLength(0);
    r.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 60 * 8);
    expect(loud()).toHaveLength(1);
    expect(loud()[0]).toMatchObject({ key: island.puzzles.passage.loudKey });
    // The event names the passage's roar, and the roar comes in at its caption's level then.
    const audio = content.audio;
    if (audio == null) throw new Error('no audio table');
    expect(audio.events['PASSAGE_LOUD']).toBe('AMB_PASSAGE_ROAR');
    const t = tideAt(r.sim.state.calendar, b);
    const level = roarLevel(
      { ...t, windowMinutes: b.tide.tidalGroundWindowMinutes },
      audio.island?.roarCaptionAt ?? 0,
    );
    expect(level).toBeGreaterThanOrEqual(audio.island?.roarCaptionAt ?? 1);
    // Once a spring low: no more while it stays open.
    r.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 60 * 4);
    expect(loud()).toHaveLength(1);
  });

  it('lets whoever is still on the Seal Cave side wade out as the passage floods (no trap)', () => {
    // Find the window's close on a spring-tide day: the passage floods.
    const w = windowOpens(1, true);
    let cal = { day: w.day, minuteOfDay: w.minute };
    while (passageWater(cal, b, island.ib).state === 'OPEN')
      cal = { day: cal.day, minuteOfDay: cal.minuteOfDay + 1 };
    expect(passageWater(cal, b, island.ib).state).toBe('FLOODING');
    const r = start(`zone=${deep}&at=44.5,10.8&day=${cal.day}&time=${hhmm(cal.minuteOfDay + 2)}`);
    expect(r.sim.state.onFoot?.zone).toBe(deep);
    r.send({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false }, 300);
    expect(r.sim.state.onFoot?.zone).toBe(sealCave);
    // And on, off the closed flats of the chamber onto dry ground.
    const map = mapOf(sealCave);
    const ticks = walk(r, sealCave, [49, 22], 60 * 60, undefined, true);
    expect(ticks).toBeLessThan(60 * 60);
    const p = r.sim.state.onFoot?.player;
    if (p === undefined) throw new Error('not on foot');
    const ft = feetTile(p);
    expect(terrainAt(map, ft[0], ft[1])).not.toBe('flats');
  });
});
