/**
 * No trap (the user's third playtest; decision DG-20; Book 2 sections 10 and 23; Book 9 section
 * 13; Book 10 section 25, "No trap"). The user was stuck in the water by the western outcrop on
 * Wreck Strand, by the broken mast and the stores' lashing, at night on day 1 (about 20:41).
 *
 * The cause, reproduced here: the steerer stood on the tidal flats at the outcrop's seaward foot
 * while the tidal window was open; when it closed (about 19:30 on day 1), the flats under them
 * became blocking ground, and since every step was tested with the whole footprint, every step in
 * every direction was refused (`footprintClear` on closed flats), so they could never move again.
 * The fix is the rule itself (`stepClear`): tidal ground that closes under someone is wading water
 * for them until they leave it, and a body already overlapping blocking ground may always move in
 * any way that does not deepen the overlap.
 *
 * The edge-walk test drives the real movement step (`stepMovement`, with the edge stop as built)
 * from points along every collision edge of every zone, at every tide state and with the doors
 * open and shut, and needs the steerer to get Book 10's escapeDistance away within escapeTime.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseInterfaceBalance } from '../../src/content/interfaceBalance.ts';
import { heightAt, tideHeight } from '../../src/content/terrain/elevation.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { doorOverlap } from '../../src/sim/land/doors.ts';
import type { DoorState } from '../../src/sim/land/doors.ts';
import {
  footprintClear,
  onTidalGround,
  placeOnFoot,
  stepClear,
  stepMovement,
  TICKS_PER_SECOND,
} from '../../src/sim/land/onFoot.ts';
import type { OnFootState, TideNow } from '../../src/sim/land/onFoot.ts';
import { bandAt, isDeep, stillWaterLevel } from '../../src/sim/land/water.ts';
import { terrainAt, tileBlocks } from '../../src/sim/land/zoneMap.ts';
import type { ZoneMap } from '../../src/sim/land/zoneMap.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const trap = parseInterfaceBalance(balance).noTrap;
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const T = TICKS_PER_SECOND;

/** Book 10 probeTides: low water, half tide rising, high water, half tide falling. */
const TIDES: readonly { name: string; toLow: number; sinceLow: number }[] = [
  { name: 'low water', toLow: 0, sinceLow: 0 },
  { name: 'half tide rising', toLow: 540, sinceLow: 180 },
  { name: 'high water', toLow: 360, sinceLow: 360 },
  { name: 'half tide falling', toLow: 180, sinceLow: 540 },
];

/** Every tide state of the test, with the tidal window open and closed (Book 10 probeTides). */
function tideStates(): { name: string; tide: TideNow }[] {
  return TIDES.flatMap((t) =>
    [true, false].map((open) => ({
      name: `${t.name}, window ${open ? 'open' : 'closed'}`,
      tide: { open, level: tideHeight(t.toLow, t.sinceLow, open) },
    })),
  );
}

interface Probe {
  readonly x: number;
  readonly y: number;
  /** The way out of the edge (unit), tried first. */
  readonly nx: number;
  readonly ny: number;
  /** Inside a shape that closed on them (tidal ground, a door, deep water risen round them). */
  readonly inside: boolean;
  readonly what: string;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * The probe points of a zone under a tide and door state: 0.1 tiles outside every edge of every
 * collision shape (blocking tiles and the zone's own edge, closed doorways, deep water), every
 * probeStep along it; and, for shapes that can close on someone, 0.1 tiles inside them.
 */
function probes(map: ZoneMap, tide: TideNow, doors: readonly DoorState[]): Probe[] {
  const t = map.tile;
  const fw = land.rules.footprint.w;
  const fh = land.rules.footprint.h;
  const out = trap.probeOut * t;
  const step = trap.probeStep * t;
  const along = Array.from({ length: Math.round(1 / trap.probeStep) }, (_, k) => (k + 0.5) * step);
  const blocks = (tx: number, ty: number, open: boolean): boolean =>
    tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || tileBlocks(map, tx, ty, open);
  const list: Probe[] = [];
  // A footprint set beside a side of tile (tx, ty), `gap` from it (negative: over the side).
  const beside = (
    tx: number,
    ty: number,
    side: (typeof DIRS)[number],
    s: number,
    gap: number,
  ): { x: number; y: number } => {
    const [sx, sy] = side;
    if (sx === -1) return { x: tx * t + gap + fw / 2, y: ty * t + s };
    if (sx === 1) return { x: (tx + 1) * t - gap - fw / 2, y: ty * t + s };
    if (sy === -1) return { x: tx * t + s, y: ty * t + gap + fh };
    return { x: tx * t + s, y: (ty + 1) * t - gap };
  };
  for (let ty = 0; ty < map.height; ty++)
    for (let tx = 0; tx < map.width; tx++) {
      const flats = terrainAt(map, tx, ty) === 'flats';
      // Outside: a standable tile's sides against blocking ground or the zone's edge.
      if (!blocks(tx, ty, tide.open))
        for (const side of DIRS) {
          if (!blocks(tx + side[0], ty + side[1], tide.open)) continue;
          for (const s of along)
            list.push({
              ...beside(tx, ty, side, s, out),
              nx: -side[0],
              ny: -side[1],
              inside: false,
              what: `edge of (${tx + side[0]}, ${ty + side[1]})`,
            });
        }
      // Inside: tidal ground the window closed on, along its sides and at its middle.
      if (flats && !tide.open) {
        for (const side of DIRS) {
          if (terrainAt(map, tx + side[0], ty + side[1]) === 'flats') continue;
          if (blocks(tx + side[0], ty + side[1], true)) continue;
          for (const s of along) {
            // Over the side: the footprint straddles the flats and the ground beyond.
            const p = beside(tx, ty, side, s, -out);
            list.push({
              ...p,
              nx: side[0],
              ny: side[1],
              inside: true,
              what: `flats (${tx}, ${ty})`,
            });
          }
        }
        list.push({
          x: (tx + 0.5) * t,
          y: (ty + 0.5) * t + fh / 2,
          nx: 0,
          ny: -1,
          inside: true,
          what: `flats (${tx}, ${ty}) middle`,
        });
      }
    }
  // Closed doorways: outside each side, and inside (shut on someone standing in it).
  for (const d of map.doors ?? []) {
    const st = doors.find((s) => s.id === d.id);
    if (st === undefined || st.open >= 1) continue;
    const half = (d.width * t) / 2;
    const depth = t * 0.45;
    const cx = d.pos.x * t;
    const cy = d.pos.y * t;
    const ns = d.facing === 'n' || d.facing === 's';
    const r = ns
      ? { x0: cx - half, y0: cy - depth, x1: cx + half, y1: cy + 1 }
      : { x0: cx - depth / 2, y0: cy - half, x1: cx + depth / 2, y1: cy + half };
    for (let s = step / 2; s < r.x1 - r.x0; s += step) {
      list.push({ x: r.x0 + s, y: r.y0 - out, nx: 0, ny: -1, inside: false, what: `door ${d.id}` });
      list.push({
        x: r.x0 + s,
        y: r.y1 + out + fh,
        nx: 0,
        ny: 1,
        inside: false,
        what: `door ${d.id}`,
      });
      list.push({
        x: r.x0 + s,
        y: (r.y0 + r.y1) / 2 + fh / 2,
        nx: 0,
        ny: 1,
        inside: true,
        what: `in door ${d.id}`,
      });
    }
    for (let s = step / 2; s < r.y1 - r.y0; s += step) {
      list.push({
        x: r.x0 - out - fw / 2,
        y: r.y0 + s,
        nx: -1,
        ny: 0,
        inside: false,
        what: `door ${d.id}`,
      });
      list.push({
        x: r.x1 + out + fw / 2,
        y: r.y0 + s,
        nx: 1,
        ny: 0,
        inside: false,
        what: `door ${d.id}`,
      });
    }
  }
  // Deep water: its edge on the probe step's lattice, outside it and inside (risen round them).
  const elevation = land.elevations.get(map.zone);
  if (elevation !== undefined) {
    const deep = (x: number, y: number): boolean =>
      isDeep(bandAt(land.water, elevation, x, y, tide.level));
    for (let y = step / 2; y < map.height * t; y += step)
      for (let x = step / 2; x < map.width * t; x += step) {
        if (deep(x, y)) continue;
        for (const [sx, sy] of DIRS) {
          const qx = x + sx * step;
          const qy = y + sy * step;
          if (!deep(qx, qy)) continue;
          list.push({ x, y, nx: -sx, ny: -sy, inside: false, what: 'deep water edge' });
          list.push({ x: qx, y: qy, nx: -sx, ny: -sy, inside: true, what: 'deep water risen' });
        }
      }
  }
  return list;
}

/** Whether a probe point can be stood on: as it is, or (inside) before the shape closed on it. */
function standable(map: ZoneMap, tide: TideNow, doors: readonly DoorState[], p: Probe): boolean {
  if (p.inside) return footprintClear(map, land.rules, p.x, p.y, true);
  // Tidal ground the window has closed could have been stood on while it was open.
  const caught = !tide.open && onTidalGround(map, land.rules, p.x, p.y);
  if (!footprintClear(map, land.rules, p.x, p.y, tide.open || caught)) return false;
  return doorOverlap({ doors }, map, p.x, p.y, land.rules.footprint) <= 0;
}

/**
 * Whether the steerer, set at the probe point and walking (or wading) through the real movement
 * step, gets escapeDistance away within escapeTime in one of the escapeDirs directions, the way
 * out of the edge tried first.
 */
function escapes(map: ZoneMap, state: OnFootState, tide: TideNow, p: Probe): boolean {
  const n = trap.escapeDirs;
  const base = Math.atan2(p.ny, p.nx);
  const ticks = Math.round(trap.escapeSeconds * T);
  const need = trap.escapeDistance * map.tile;
  const pl = state.player;
  for (let k = 0; k < n; k++) {
    // 0, +1, -1, +2, -2, ... sixteenths of a turn from the way out.
    const off = k % 2 === 1 ? (k + 1) / 2 : -k / 2;
    const a = base + (off * 2 * Math.PI) / n;
    pl.x = p.x;
    pl.y = p.y;
    delete pl.vel;
    delete pl.motion;
    pl.intent = { x: Math.cos(a), y: Math.sin(a), run: false, sneak: false };
    for (let i = 0; i < ticks; i++) {
      stepMovement(state, map, land, tide, i);
      if (Math.hypot(pl.x - p.x, pl.y - p.y) >= need) return true;
    }
  }
  return false;
}

interface Walked {
  readonly probes: number;
  readonly failures: string[];
}

/** The edge walk of one zone at one tide, doors open or shut. */
function walkEdges(map: ZoneMap, name: string, tide: TideNow, doorsShut: boolean): Walked {
  const state = placeOnFoot(map, []);
  const doors: DoorState[] = (map.doors ?? []).map((d) => ({
    id: d.id,
    open: doorsShut ? 0 : 1,
    moving: 0,
    barred: false,
  }));
  if (doors.length > 0) state.doors = doors;
  let count = 0;
  const failures: string[] = [];
  for (const p of probes(map, tide, doors)) {
    if (!standable(map, tide, doors, p)) continue;
    count++;
    if (!escapes(map, state, tide, p))
      failures.push(
        `${map.zone} ${name}${doorsShut ? ', doors shut' : ''}: (${(p.x / map.tile).toFixed(2)}, ${(p.y / map.tile).toFixed(2)}) ${p.what}`,
      );
  }
  return { probes: count, failures };
}

describe('No trap: the edge-walk test (Book 10 section 25; decision DG-20)', () => {
  it('reads its numbers from Book 10', () => {
    expect(trap).toEqual({
      probeStep: 0.25,
      probeOut: 0.1,
      escapeDirs: 16,
      escapeDistance: 0.5,
      escapeSeconds: 1,
      narrowestMargin: 0.25,
    });
  });

  for (const [zone, map] of land.maps) {
    it(`${zone}: from every edge of every collision shape, at every tide, the steerer gets clear`, () => {
      let total = 0;
      const failures: string[] = [];
      const doorStates = (map.doors ?? []).length > 0 ? [false, true] : [false];
      for (const { name, tide } of tideStates())
        for (const shut of doorStates) {
          const w = walkEdges(map, name, tide, shut);
          total += w.probes;
          failures.push(...w.failures);
        }
      expect(failures.slice(0, 60)).toEqual([]);
      expect(total).toBeGreaterThan(1000);
    }, 120_000);
  }

  it('no gap between collision shapes narrower than the footprint + the margin exists', () => {
    // Collision shapes are whole tiles, door frames and the water's edge: the narrowest gap two
    // blocking tiles can leave is a tile, which is wider than Book 10's narrowest.
    const fw = land.rules.footprint.w;
    for (const map of land.maps.values())
      expect(map.tile).toBeGreaterThan(fw + trap.narrowestMargin * map.tile);
  });
});

describe('the user’s stuck spot: the western outcrop on Wreck Strand at night (DG-20)', () => {
  const map = land.maps.get('ZONE_SK_STRAND');
  if (map === undefined) throw new Error('no strand');
  const mast = land.wreck?.rw.mast;
  const foot = { x: 40.4, y: 37.6 };
  const mouth = { x: 37.5, y: 37.0 };

  it('the mast’s foot and the stream’s mouth are where Book 9 puts them', () => {
    expect(mast?.foot).toEqual(foot);
    expect(mast?.fall).toMatchObject(mouth);
  });

  it('reproduced: on the flats at the seaward foot as the tide closes, every step was refused', () => {
    // The screenshot's place and time: day 1, 20:41, the tidal window closed and the flood rising.
    const tide = tideAt({ day: 1, minuteOfDay: 20 * 60 + 41 }, b);
    expect(tide.tidalGroundOpen).toBe(false);
    const at = { x: 41.5 * map.tile, y: 38.4 * map.tile };
    expect(terrainAt(map, 41, 38)).toBe('flats');
    // The old rule: the footprint must be clear wherever it goes, so on closed flats nothing is.
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * 2 * Math.PI;
      expect(
        footprintClear(map, land.rules, at.x + Math.cos(a) * 2, at.y + Math.sin(a) * 2, false),
      ).toBe(false);
    }
    // The rule now: the closed flats are wading water for them until they leave them.
    expect(stepClear(map, land.rules, at, at.x - 2, at.y, false)).toBe(true);
  });

  it('played through the simulation: walked onto the flats at dusk, held there to 20:41, then walked off', () => {
    const world = newCampaign(
      'outcrop',
      b,
      parsePeopleBasics(balance),
      content,
      { name: 'Ash', bodyModel: 'A' },
      { coldOpen: false },
    );
    const sim = createSimulation(b, world, land);
    // Up from the surf.
    sim.submit({ type: 'MOVE', x: -1, y: 0, run: false, sneak: false });
    for (let i = 0; i < 3 * T; i++) sim.step();
    sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
    for (let i = 0; i < T; i++) sim.step();
    expect(world.facts['ch1.phase']).toBe('PLAY');
    const p = world.onFoot?.player;
    if (p === undefined) throw new Error('no steerer');
    // 19:10 on day 1, low water's window still open: on the foreshore by the mast's foot.
    world.calendar = { day: 1, minuteOfDay: 19 * 60 + 10 };
    expect(tideAt(world.calendar, b).tidalGroundOpen).toBe(true);
    p.x = 39.5 * map.tile;
    p.y = 38.6 * map.tile;
    // Wade east onto the flats below the lashing, and stand there.
    sim.submit({ type: 'MOVE', x: 1, y: 0.2, run: false, sneak: false });
    for (let i = 0; i < Math.round(1.2 * T); i++) sim.step();
    sim.submit({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
    expect(terrainAt(map, Math.floor(p.x / map.tile), Math.floor((p.y - 1) / map.tile))).toBe(
      'flats',
    );
    while (world.calendar.minuteOfDay < 20 * 60 + 41) sim.step();
    expect(tideAt(world.calendar, b).tidalGroundOpen).toBe(false);
    const elevation = land.elevations.get(map.zone);
    if (elevation === undefined) throw new Error('no elevation');
    const level = stillWaterLevel(tideAt(world.calendar, b));
    expect(level - heightAt(elevation, p.x, p.y)).toBeGreaterThan(0.05);
    // Every way that is not deeper water lets them move; west, they wade off onto the foreshore.
    const start = { x: p.x, y: p.y };
    for (const [dx, dy] of [
      [-1, 0],
      [0, -1],
      [1, 0],
    ] as const) {
      const from = { x: p.x, y: p.y };
      sim.submit({ type: 'MOVE', x: dx, y: dy, run: false, sneak: false });
      for (let i = 0; i < T / 2; i++) sim.step();
      expect(Math.hypot(p.x - from.x, p.y - from.y)).toBeGreaterThan(0);
    }
    p.x = start.x;
    p.y = start.y;
    sim.submit({ type: 'MOVE', x: -1, y: -0.3, run: false, sneak: false });
    for (let i = 0; i < 3 * T; i++) sim.step();
    const tx = Math.floor(p.x / map.tile);
    const ty = Math.floor((p.y - 1) / map.tile);
    expect(terrainAt(map, tx, ty)).not.toBe('flats');
    // Off the flats, the closed tidal ground blocks again as ever.
    expect(footprintClear(map, land.rules, p.x, p.y, false)).toBe(true);
    expect(stepClear(map, land.rules, p, 41.5 * map.tile, 38.4 * map.tile, false)).toBe(false);
  });

  it('at night at every tide, every edge within 4 tiles of the mast’s foot, its seaward foot and the stream’s mouth has a way out', () => {
    const near = (x: number, y: number): boolean =>
      [foot, mouth, { x: 41.3, y: 38.6 }].some(
        (c) => Math.hypot(x / map.tile - c.x, y / map.tile - c.y) <= 4,
      );
    let count = 0;
    const failures: string[] = [];
    // Each night hour of day 1 from dusk, and the four probe tides.
    const night = [19, 20, 21, 22, 23].map((h) => tideAt({ day: 1, minuteOfDay: h * 60 + 41 }, b));
    const tides: TideNow[] = [
      ...night.map((t) => ({ open: t.tidalGroundOpen, level: stillWaterLevel(t) })),
      ...tideStates().map((s) => s.tide),
    ];
    const state = placeOnFoot(map, []);
    for (const tide of tides)
      for (const p of probes(map, tide, [])) {
        if (!near(p.x, p.y) || !standable(map, tide, [], p)) continue;
        count++;
        if (!escapes(map, state, tide, p))
          failures.push(
            `(${(p.x / map.tile).toFixed(2)}, ${(p.y / map.tile).toFixed(2)}) ${p.what}`,
          );
      }
    expect(failures).toEqual([]);
    expect(count).toBeGreaterThan(200);
  });
});
