/**
 * Stage 14: the island's heavy objects moved in play by commands (Book 2 section 10, "Push and
 * pull"; Book 9 sections 03 and 16; decisions S14-56, S14-80 and S14-114): Interact held (GRIP)
 * and a step back pulls an object a tile along its line, walking into it pushes it, and each can
 * be put back where it started. While an object lies on a tile, nobody walks onto that tile.
 *
 * - The deep passage's fallen stone: pushed north into its slot from (23, 13), opening the wide
 *   way, then pulled back out to where it fell (Book 9 section 16).
 * - The prayer stone's capstone on Rook Hill: pulled off the cist, the page under it taken, and
 *   pushed back (Book 9 section 03).
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { marksOf } from '../../src/content/traverseMarks.ts';
import type { PushMark } from '../../src/content/traverseMarks.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { puzzleState } from '../../src/sim/land/islandConditions.ts';
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
const STILL: Command = { type: 'MOVE', x: 0, y: 0, run: false, sneak: false };
const move = (x: number, y: number): Command => ({ type: 'MOVE', x, y, run: false, sneak: false });

interface Run {
  readonly sim: Simulation;
  readonly events: SimEvent[];
  readonly send: (c: Command, steps?: number) => void;
}

function start(query: string): Run {
  const world = newCampaign('heavy', b, parsePeopleBasics(balance), content, {
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

function springWindow(): { day: number; minute: number } {
  for (let d = 1; d < 120; d++)
    for (let m = 0; m < 1200; m += 5) {
      const minute = (b.dayStart + m) % 1440;
      const t = tideAt({ day: d, minuteOfDay: minute }, b);
      if (t.tidalGroundOpen && t.springTide && t.minutesToLowWater >= 80) return { day: d, minute };
    }
  throw new Error('no spring low');
}

function markOf(zone: string, id: string): PushMark {
  const map = land.maps.get(zone);
  const m = map === undefined ? undefined : marksOf(map).pushes.find((p) => p.id === id);
  if (m === undefined) throw new Error(`no ${id} in ${zone}`);
  return m;
}

/** Where the object lies now (its saved place, or its start). */
function lies(r: Run, zone: string, id: string): readonly [number, number] {
  const saved = r.sim.state.regions['REG_SK']?.pushed?.[`${zone}/${id}`];
  if (saved !== undefined) return [saved.x, saved.y];
  return markOf(zone, id).line[markOf(zone, id).start] ?? [0, 0];
}

const feet = (r: Run): readonly [number, number] => {
  const p = r.sim.state.onFoot?.player;
  if (p === undefined) throw new Error('not on foot');
  return [Math.floor(p.x / T), Math.floor((p.y - 0.001) / T)];
};

/** Stands the steerer in a tile's middle, facing it (the developer menu's teleport, exact). */
function standAt(r: Run, t: readonly [number, number], facing: 'n' | 's' | 'e' | 'w'): void {
  const p = r.sim.state.onFoot?.player;
  if (p === undefined) throw new Error('not on foot');
  p.x = (t[0] + 0.5) * T;
  p.y = (t[1] + 0.5) * T + land.rules.footprint.h / 2;
  p.facing = facing;
  r.send(STILL, 2);
}

const deep = 'ZONE_SK_SEALCAVE_DEEP';
const rook = 'ZONE_SK_ROOK';

describe.skipIf(!land.maps.has(deep))('the deep passage: the fallen stone (S14-114)', () => {
  it('blocks its tile while it lies there, from every side', () => {
    const w = springWindow();
    const r = start(`zone=${deep}&at=24.5,12.8&day=${w.day}&time=${hhmm(w.minute)}`);
    const stone = lies(r, deep, 'deep.stone');
    expect(stone).toEqual([23, 12]);
    // From the east (the wide way), walking west into it: it does not move off its line, and
    // nobody walks onto it.
    standAt(r, [24, 12], 'w');
    r.send(move(-1, 0), 180);
    expect(lies(r, deep, 'deep.stone')).toEqual([23, 12]);
    expect(feet(r)).not.toEqual([23, 12]);
    expect(feet(r)[0]).toBeGreaterThanOrEqual(24);
  });

  it('is pushed north into its slot from (23, 13), and pulled back out with Interact held', () => {
    const w = springWindow();
    const r = start(`zone=${deep}&at=23.5,13.8&day=${w.day}&time=${hhmm(w.minute)}`);
    standAt(r, [23, 13], 'n');
    // Walking into it pushes it a tile at a time along its line.
    r.send(move(0, -1), 100);
    expect(lies(r, deep, 'deep.stone')).toEqual([23, 11]);
    r.send(move(0, -1), 100);
    expect(lies(r, deep, 'deep.stone')).toEqual([23, 10]);
    r.send(STILL, 30);
    expect(r.sim.state.facts['sealcave.stone.moved']).toBe(true);
    expect(puzzleState(r.sim.state, island, 'PUZ_DEEP_STONE')).toBe('SLOTTED');
    // The wide way is open: walk out east through the doorway where it lay.
    standAt(r, [22, 12], 'e');
    r.send(move(1, 0), 120);
    expect(feet(r)[0]).toBeGreaterThanOrEqual(24);
    // Back to the slot's mouth, take hold (GRIP) and step back: it follows, a tile a step.
    standAt(r, [23, 11], 'n');
    r.send({ type: 'GRIP', on: true }, 2);
    expect(r.sim.state.onFoot?.player.grip).toBe('deep.stone');
    r.send(move(0, 1), 100);
    expect(lies(r, deep, 'deep.stone')).toEqual([23, 11]);
    r.send(move(0, 1), 100);
    expect(lies(r, deep, 'deep.stone')).toEqual([23, 12]);
    r.send(STILL, 2);
    r.send({ type: 'GRIP', on: false }, 2);
    expect(r.sim.state.onFoot?.player.grip ?? null).toBeNull();
    expect(r.events).toContainEqual(
      expect.objectContaining({ type: 'OBJECT_MOVED', object: 'deep.stone', pull: true }),
    );
    r.send(STILL, 30);
    expect(r.sim.state.facts['sealcave.stone.moved']).toBe(false);
    expect(puzzleState(r.sim.state, island, 'PUZ_DEEP_STONE')).toBe('FALLEN');
  });
});

describe.skipIf(!land.maps.has(rook))("Rook Hill: the prayer stone's capstone (S14-114)", () => {
  it('is pulled off the cist with Interact held, the page taken, and pushed back', () => {
    const cap = markOf(rook, 'rook.capstone');
    const [from, to] = cap.line;
    if (from === undefined || to === undefined) throw new Error('short line');
    const r = start(`zone=${rook}&at=${to[0] + 1.5},${to[1] + 0.8}&day=20&time=10:00`);
    // Beside it on its line's far side, facing it: hold Interact and step back.
    standAt(r, to, 'w');
    expect(feet(r)).toEqual(to);
    r.send({ type: 'GRIP', on: true }, 2);
    expect(r.sim.state.onFoot?.player.grip).toBe('rook.capstone');
    const away: [number, number] = [Math.sign(to[0] - from[0]), Math.sign(to[1] - from[1])];
    r.send(move(away[0], away[1]), 100);
    r.send(STILL, 2);
    r.send({ type: 'GRIP', on: false }, 2);
    expect(lies(r, rook, 'rook.capstone')).toEqual(to);
    r.send(STILL, 30);
    expect(r.sim.state.facts['rook.cist.open']).toBe(true);
    expect(puzzleState(r.sim.state, island, 'PUZ_PRAYER_STONE')).toBe('OPEN');
    // The page in the cist, where the capstone lay.
    const page = island.collectibles.find((c) => c.key === 'rook_page');
    if (page === undefined) throw new Error('no page');
    const p = r.sim.state.onFoot?.player;
    if (p === undefined) throw new Error('not on foot');
    p.x = page.pos.x * T;
    p.y = (page.pos.y + 0.6) * T;
    r.send({ type: 'INTERACT' }, 3);
    expect(r.sim.state.regions['REG_SK']?.collected).toContain('rook_page');
    // Pushed back onto the cist from the far side: it can always be put back.
    const beyond: [number, number] = [to[0] + away[0], to[1] + away[1]];
    standAt(r, beyond, 'w');
    r.send(move(-away[0], -away[1]), 100);
    r.send(STILL, 30);
    expect(lies(r, rook, 'rook.capstone')).toEqual(from);
    expect(puzzleState(r.sim.state, island, 'PUZ_PRAYER_STONE')).toBe('CLOSED');
  });
});
