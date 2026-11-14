/**
 * Stage 13, decision S13-80 (Book 2 section 03, "replaying a recorded input stream from a save
 * reproduces identical state hashes"; section 21, "the simulation receives only commands"): the
 * wreck on Sgeir Dhubh, recorded as a command stream and replayed. From the chapter's end (golden
 * save 12) the household sails from Skarvholm for Carrick, meets the wreck, the steerer walks the
 * reef by commands (`DEV_TELEPORT` stands in for walking), hears Derbáil and Ívar, lifts Ívar and
 * sets him down, answers Hild at the boat's side, and the voyage comes back to the chart and sails
 * on to Carrick Landing. For each of the four answers the stream is replayed from the save and
 * every checkpoint hash must match, and again resumed from a save written on the reef.
 */
import { describe, expect, it } from 'vitest';
import { parseTimeBalance } from '../../src/content/balance.ts';
import { readSave, writeSave } from '../../src/persist/save.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { record, replay, snapshot } from '../../src/sim/replay.ts';
import type { TimedCommand } from '../../src/sim/replay.ts';
import { currentHandoff } from '../../src/sim/sea/index.ts';
import { WRECK_FACTS, inWreck, wreckOptions } from '../../src/sim/sea/wreck.ts';
import type { SeaWreckContext, WreckChoice } from '../../src/sim/sea/wreck.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { Command, SimState, Simulation } from '../../src/sim/simulation.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { GOLDEN_12 } from '../../src/tools/saves/golden.ts';
import { repoFile } from '../unit/books.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const maybeCtx = land.seaWreck ?? null;
if (maybeCtx === null) throw new Error('content/wreck.json did not load');
const ctx: SeaWreckContext = maybeCtx;
const CHOICES: readonly WreckChoice[] = ['ABOARD', 'ASHORE', 'SALVAGE', 'LEAVE'];
const EVERY = 50;

/** A live run that sends commands by reading the world, as a player would, and records them. */
class Driver {
  readonly sim: Simulation;
  readonly inputs: TimedCommand[] = [];
  readonly hashes = new Map<number, string>();
  readonly first: number;
  /** A save written on the reef, mid-scene, with the tick it was written at. */
  saved: { state: SimState; tick: number } | null = null;

  constructor(start: SimState) {
    this.sim = createSimulation(b, snapshot(start), land);
    this.first = this.sim.state.tick;
  }

  get w(): SimState {
    return this.sim.state;
  }

  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      this.sim.step();
      const ran = this.sim.state.tick - this.first;
      if (ran % EVERY === 0) this.hashes.set(this.sim.state.tick, stateHash(this.sim.state));
    }
  }

  send(command: Command): void {
    this.inputs.push({ tick: this.sim.state.tick, command });
    this.sim.submit(command);
    this.step();
  }

  until(done: () => boolean, max: number): void {
    for (let i = 0; i < max && !done(); i++) this.step();
    expect(done()).toBe(true);
  }

  /** Sails watch by watch (pressing on through rising weather) until `done`. */
  sail(done: () => boolean): void {
    for (let i = 0; i < 60 && !done(); i++) {
      if (this.w.sea.voyage?.status === 'CHOICE')
        this.send({ type: 'SEA_CHOOSE', option: 'PRESS_ON' });
      else this.send({ type: 'SEA_WATCH' });
    }
    expect(done()).toBe(true);
  }

  /** Stands by a point of the reef (in tiles) by the developer's teleport. */
  standBy(x: number, y: number): void {
    this.send({
      type: 'DEV_TELEPORT',
      tile: { tx: Math.floor(x), ty: Math.floor(y) },
      within: 2,
    });
  }

  choose(key: string): void {
    this.until(() => (this.w.talk?.queue.length ?? 0) === 0, 1000);
    const index = wreckOptions(this.w, ctx).findIndex((o) => o.key === key);
    expect(index).toBeGreaterThanOrEqual(0);
    this.send({ type: 'TALK_CHOOSE', index });
  }

  quiet(): void {
    this.until(() => this.w.talk === null, 3000);
  }
}

/** Sails Skarvholm to Carrick, plays the wreck to `choice`, and sails on to Carrick Landing. */
function drive(choice: WreckChoice): Driver {
  const start = readSave(JSON.parse(repoFile(GOLDEN_12))).state;
  const d = new Driver(start);
  d.send({ type: 'SEA_PLOT', to: 'SITE_CARRICK' });
  d.send({ type: 'SEA_DEPART' });
  // On the chart until the wreck: the simulation puts the reef in place at its handoff.
  d.sail(() => d.w.onFoot !== null);
  expect(inWreck(d.w, ctx)).toBe(true);
  expect(currentHandoff(d.w)?.edgeId).toBe('SEA_SKARV_CARRICK');
  d.step(60);
  // Derbáil, and the reveal.
  const derbail = ctx.def.survivors.find((s) => s.id === 'C_DERBAIL');
  const ivar = ctx.def.survivors.find((s) => s.id === 'C_IVAR');
  if (derbail === undefined || ivar === undefined) throw new Error('no survivors');
  d.standBy(derbail.at.x + 1, derbail.at.y);
  d.send({ type: 'INTERACT' });
  expect(d.w.talk?.scene).toBe('wreck.C_DERBAIL');
  d.choose('p_steerer.wreck.ask_sail');
  d.choose('ui.talk.leave');
  d.quiet();
  // Ívar: his words first, then the lift, and set down again.
  d.standBy(ivar.at.x + 1, ivar.at.y);
  d.send({ type: 'INTERACT' });
  expect(d.w.talk?.scene).toBe('wreck.C_IVAR');
  d.choose('ui.talk.leave');
  d.quiet();
  d.send({ type: 'INTERACT' });
  expect(d.w.onFoot?.carrying).toBe('C_IVAR');
  d.step(30);
  // A save written on the reef, mid-scene, as the pause menu's would be.
  d.saved = {
    state: readSave(
      JSON.parse(
        JSON.stringify(
          writeSave(d.w, {
            build: 'test',
            kind: 'manual',
            slot: '1',
            sequence: 1,
            savedAt: '2026-11-14T00:00:00Z',
          }),
        ),
      ),
    ).state,
    tick: d.w.tick,
  };
  d.send({ type: 'INTERACT' });
  expect(d.w.onFoot?.carrying).toBeNull();
  // Hild's question at the boat's side, and the answer.
  d.standBy(ctx.def.board.x, ctx.def.board.y);
  d.send({ type: 'INTERACT' });
  expect(d.w.talk?.scene).toBe('wreck.ask');
  d.choose(
    {
      ABOARD: 'p_steerer.wreck.aboard',
      ASHORE: 'p_steerer.wreck.ashore',
      SALVAGE: 'p_steerer.wreck.salvage',
      LEAVE: 'p_steerer.wreck.leave',
    }[choice],
  );
  // The simulation ends the scene and hands the result back: the chart again.
  d.until(() => d.w.onFoot === null && d.w.sea.voyage?.handoff === null, 4000);
  expect(d.w.facts[WRECK_FACTS.choice]).toBe(choice);
  // On to Carrick Landing, whose landing handoff comes.
  d.sail(() => currentHandoff(d.w)?.landing === true);
  d.step(5);
  return d;
}

describe('the wreck replayed from its commands (Book 2 section 03; S13-80)', () => {
  for (const choice of CHOICES)
    it(`replays the voyage with the answer ${choice} to identical hashes, from the save and from a save on the reef`, () => {
      const d = drive(choice);
      const start = readSave(JSON.parse(repoFile(GOLDEN_12))).state;
      const ticks = d.w.tick - d.first;
      // Replayed blind from the chapter-end save: every checkpoint the live run took matches.
      const rec = record(b, start, d.inputs, ticks, EVERY, land);
      expect(stateHash(rec.final)).toBe(stateHash(d.w));
      for (const cp of rec.checkpoints) {
        const live = d.hashes.get(cp.tick);
        if (live !== undefined) expect(cp.hash).toBe(live);
      }
      expect(rec.checkpoints.length).toBeGreaterThan(10);
      expect(replay(b, rec, land)).toEqual({ ok: true, mismatches: [] });
      // Resumed from the save written on the reef, with the commands after it.
      const saved = d.saved;
      if (saved === null) throw new Error('no save on the reef');
      const rest = record(
        b,
        saved.state,
        d.inputs.filter((i) => i.tick >= saved.tick),
        d.w.tick - saved.tick,
        EVERY,
        land,
      );
      expect(stateHash(rest.final)).toBe(stateHash(d.w));
      expect(d.w.facts[WRECK_FACTS.done]).toBeDefined();
      // A stream without the answer's command does not replay to the same hashes.
      const answer = d.inputs.filter((i) => i.command.type === 'TALK_CHOOSE').at(-1);
      const without = { ...rec, inputs: rec.inputs.filter((i) => i !== answer) };
      expect(replay(b, without, land).ok).toBe(false);
    });

  it('a different answer gives a different history', () => {
    expect(stateHash(drive('ABOARD').w)).not.toBe(stateHash(drive('LEAVE').w));
  });
});
