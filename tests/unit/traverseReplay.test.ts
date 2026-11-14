/**
 * Stage 14: the movement verbs are simulation state reached only by commands, saved and replayed
 * like any other (Book 2 sections 03 and 10; decision S14-14). A bot plays every verb in the test
 * zone (climb up to the ledge and down, the jump, the crawl, a push and a pull, a swim run empty
 * to the sinking and back to the shallows), recording only its commands; replaying them gives every
 * checkpoint's hash again, and so does resuming from a save taken part-way through a verb.
 */
import { describe, expect, it } from 'vitest';
import { record, replay, snapshot } from '../../src/sim/replay.ts';
import type { TimedCommand } from '../../src/sim/replay.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { Command, SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { b, testLand, testWorld } from './traverseZone.ts';

const land = testLand();
const T = 24;

/** Plays every verb, returning the commands it sent (with their ticks) and the events seen. */
function play(): { start: ReturnType<typeof testWorld>; inputs: TimedCommand[]; ticks: number; events: SimEvent[] } {
  const start = testWorld({ x: 3.5, y: 15 });
  const s: Simulation = createSimulation(b, snapshot(start), land);
  const inputs: TimedCommand[] = [];
  const events: SimEvent[] = [];
  s.events.onAny((e) => events.push(e));
  const send = (command: Command): void => {
    inputs.push({ tick: s.state.tick, command });
    s.submit(command);
  };
  let last = '';
  const move = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (key === last) return;
    last = key;
    send({ type: 'MOVE', x, y, run: false, sneak: false });
  };
  const p = (): NonNullable<Simulation['state']['onFoot']>['player'] => {
    const pl = s.state.onFoot?.player;
    if (pl === undefined) throw new Error('not on foot');
    return pl;
  };
  const wait = (ok: () => boolean, max = 60 * 60): void => {
    for (let i = 0; i < max && !ok(); i++) s.step();
    if (!ok()) throw new Error(`stuck at ${p().x}, ${p().y}`);
  };
  const seen = (type: SimEvent['type'], n = 1): boolean =>
    events.filter((e) => e.type === type).length >= n;
  /** Walks to a point in tiles, a quarter-step direction at a time. */
  const goTo = (tx: number, ty: number): void => {
    for (let i = 0; i < 60 * 60; i++) {
      const dx = tx * T - p().x;
      const dy = ty * T - p().y;
      const d = Math.hypot(dx, dy);
      if (d < 2) break;
      const q = (v: number): number => Math.round((v / d) * 4) / 4;
      move(q(dx), q(dy));
      s.step();
    }
    move(0, 0);
    wait(() => p().vel === undefined || Math.hypot(p().vel?.x ?? 0, p().vel?.y ?? 0) < 1e-6, 120);
  };
  // The climb, up to the ledge and back down to the foot.
  move(0, -1);
  wait(() => seen('CLIMB_STARTED'));
  wait(() => p().y <= 9 * T - 4);
  move(0, 0);
  for (let i = 0; i < 90; i++) s.step();
  move(0, 1);
  wait(() => seen('CLIMB_ENDED'));
  // The jump over the rock.
  goTo(3.5, 16.5);
  goTo(9.5, 16.5);
  goTo(9.5, 15.6);
  send({ type: 'INTERACT' });
  wait(() => seen('JUMP_LANDED'));
  // The crawl through the wall.
  goTo(11.5, 16.6);
  goTo(13.5, 16.6);
  move(1, 0);
  wait(() => seen('CRAWL_ENDED'), 60 * 20);
  // The stone: pushed, then pulled back.
  goTo(20.5, 16.6);
  goTo(20.5, 15.6);
  move(1, 0);
  wait(() => seen('OBJECT_MOVED'));
  move(0, 0);
  wait(() => p().traverse == null);
  send({ type: 'INTERACT' });
  s.step();
  move(-1, 0);
  wait(() => seen('OBJECT_MOVED', 2));
  move(0, 0);
  wait(() => p().traverse == null);
  send({ type: 'GRIP', on: false });
  s.step();
  // The swim: out into the marked water, treading it until the bar is gone, and back.
  goTo(20.5, 20.6);
  goTo(6.5, 20.6);
  move(0, 1);
  wait(() => seen('SWIM_STARTED'));
  for (let i = 0; i < 30; i++) s.step();
  move(0, 0);
  wait(() => seen('SINKING'), 60 * 30);
  move(0, -1);
  wait(() => seen('SINK_ENDED'), 60 * 10);
  move(0, 0);
  for (let i = 0; i < 120; i++) s.step();
  return { start, inputs, ticks: s.state.tick - start.tick, events };
}

describe('the movement verbs replay exactly (Book 2 section 03)', () => {
  const run = play();
  const every = 300;

  it('plays every verb by commands alone', () => {
    const types = new Set(run.events.map((e) => e.type));
    for (const t of [
      'CLIMB_STARTED',
      'CLIMB_ENDED',
      'JUMPED',
      'JUMP_LANDED',
      'CRAWL_STARTED',
      'CRAWL_ENDED',
      'OBJECT_MOVED',
      'GRIPPED',
      'SWIM_STARTED',
      'SINKING',
      'SINK_ENDED',
    ] as const)
      expect(types.has(t), t).toBe(true);
    expect(run.inputs.length).toBeGreaterThan(20);
  });

  it('reproduces every checkpoint hash when replayed', () => {
    const rec = record(b, run.start, run.inputs, run.ticks, every, land);
    expect(rec.checkpoints.length).toBeGreaterThan(10);
    expect(replay(b, rec, land)).toEqual({ ok: true, mismatches: [] });
  });

  it('resumes from a save taken mid-verb to the same hashes', () => {
    const full = record(b, run.start, run.inputs, run.ticks, every, land);
    // Part-way through, wherever a verb is under way (the climb, the crawl or the swim).
    const half = Math.floor(run.ticks / 2);
    const first = record(b, run.start, run.inputs, half, every, land);
    const saved = snapshot(first.final);
    const rest = record(
      b,
      saved,
      run.inputs.filter((i) => i.tick >= saved.tick),
      run.ticks - half,
      every,
      land,
    );
    expect(stateHash(rest.final)).toBe(stateHash(full.final));
  });
});
