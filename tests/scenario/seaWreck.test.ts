/**
 * Stage 13, work package C (Book 6 section 19; decisions S13-40 to S13-59): the wreck on Sgeir
 * Dhubh, played through the whole simulation. From the chapter's end (golden save 12) the course to
 * Carrick is plotted and sailed until the wreck's handoff; the scene is put in place, the steerer
 * walks the reef, speaks with the survivors (the reveal), lifts Ívar, and answers Hild at the
 * boat's side; the result goes back with `SEA_HANDOFF_RETURN` and the voyage sails on to Carrick.
 * Every one of the four answers is completed; the result is deterministic.
 */
import { describe, expect, it } from 'vitest';
import { parseTimeBalance } from '../../src/content/balance.ts';
import { parseWreckBalance } from '../../src/content/wreckBalance.ts';
import { readSave } from '../../src/persist/save.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { currentHandoff } from '../../src/sim/sea/index.ts';
import {
  ASK_SITE,
  WRECK_FACTS,
  beginWreck,
  chooseWreck,
  finishWreck,
  freeBerths,
  inWreck,
  seaWreckContext,
  wreckInteract,
  wreckOptions,
  wreckReady,
  wreckResult,
  wreckUses,
} from '../../src/sim/sea/wreck.ts';
import type { WreckChoice } from '../../src/sim/sea/wreck.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { GOLDEN_12 } from '../../src/tools/saves/golden.ts';
import { repoFile } from '../unit/books.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const wb = parseWreckBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const ctx = seaWreckContext(content, land.people ?? null);
if (ctx === null) throw new Error('content/wreck.json did not load');
const map = land.maps.get(ctx.def.zone);
if (map === undefined) throw new Error('no reef zone');
const T = map.tile;
const CHOICES: readonly WreckChoice[] = ['ABOARD', 'ASHORE', 'SALVAGE', 'LEAVE'];

function run(sim: Simulation, command: Parameters<Simulation['submit']>[0]): void {
  sim.submit(command);
  sim.step();
}

/** The chapter's end, sailed to the wreck's handoff (the scene not yet in place). */
function atTheWreck(): { sim: Simulation; events: SimEvent[] } {
  const world = readSave(JSON.parse(repoFile(GOLDEN_12))).state;
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  run(sim, { type: 'SEA_PLOT', to: 'SITE_CARRICK' });
  run(sim, { type: 'SEA_DEPART' });
  for (let i = 0; i < 40 && sim.state.sea.voyage?.status !== 'HANDOFF'; i++) {
    if (sim.state.sea.voyage?.status === 'CHOICE')
      run(sim, { type: 'SEA_CHOOSE', option: 'PRESS_ON' });
    else run(sim, { type: 'SEA_WATCH' });
  }
  return { sim, events };
}

/** Steps until the open words have played and closed (or `max` ticks). */
function untilQuiet(sim: Simulation, max = 3000): void {
  for (let i = 0; i < max && sim.state.talk !== null; i++) sim.step();
}

function standAt(world: WorldState, x: number, y: number): void {
  const p = world.onFoot?.player;
  if (p === undefined) throw new Error('not on foot');
  p.x = x * T;
  p.y = y * T;
}

/** Plays the scene to the answer `choice` and returns the result sent back. */
function play(choice: WreckChoice, sim: Simulation) {
  const w = sim.state;
  expect(beginWreck(w, ctx, map)).toBe(true);
  expect(inWreck(w, ctx)).toBe(true);
  for (let i = 0; i < 120; i++) sim.step();
  // Derbáil's words, and the reveal.
  const d = ctx.def.survivors.find((s) => s.id === 'C_DERBAIL');
  if (d === undefined) throw new Error('no Derbáil');
  standAt(w, d.at.x + 1, d.at.y + 0.4);
  expect(wreckInteract(w, ctx, T, () => undefined)).toBe('wreck.C_DERBAIL');
  const reveal = wreckOptions(w, ctx).findIndex((o) => o.key === 'p_steerer.wreck.ask_sail');
  expect(reveal).toBeGreaterThanOrEqual(0);
  chooseWreck(w, ctx, reveal);
  expect(w.facts[WRECK_FACTS.askedConn]).toBe(true);
  for (let i = 0; i < 400 && (w.talk?.queue.length ?? 0) > 0; i++) sim.step();
  chooseWreck(
    w,
    ctx,
    wreckOptions(w, ctx).findIndex((o) => o.key === 'ui.talk.leave'),
  );
  untilQuiet(sim);
  expect(w.talk).toBeNull();
  // Lift Ívar where he lies (the game's own lift) and carry him a few steps towards the boat.
  const ivar = w.onFoot?.actors['C_IVAR'];
  if (ivar === undefined) throw new Error('no Ívar');
  standAt(w, ivar.x / T + 0.6, ivar.y / T);
  run(sim, { type: 'INTERACT' });
  expect(w.onFoot?.carrying).toBe('C_IVAR');
  run(sim, { type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
  for (let i = 0; i < 90; i++) sim.step();
  run(sim, { type: 'MOVE', x: 0, y: 0, run: false, sneak: false });
  // Hild's question at the boat's side.
  standAt(w, ctx.def.board.x, ctx.def.board.y);
  expect(wreckUses(w, ctx, T).some((u) => u.site === ASK_SITE)).toBe(true);
  expect(wreckInteract(w, ctx, T, () => undefined)).toBe(ASK_SITE);
  const keys = wreckOptions(w, ctx).map((o) => o.key);
  expect(keys).toEqual([
    'p_steerer.wreck.aboard',
    'p_steerer.wreck.ashore',
    'p_steerer.wreck.salvage',
    'p_steerer.wreck.leave',
    'p_steerer.wreck.not_yet',
  ]);
  const index = CHOICES.indexOf(choice);
  expect(chooseWreck(w, ctx, index)).toBe(choice);
  expect(wreckReady(w, ctx)).toBe(false);
  untilQuiet(sim);
  expect(wreckReady(w, ctx)).toBe(true);
  const crew = [...(w.sea.voyage?.aboard ?? [])];
  const stores = Object.values(w.sea.voyage?.stores ?? {}).reduce((a, n) => a + n, 0);
  const outcome = finishWreck(w, ctx);
  if (outcome === null) throw new Error('not finished');
  expect(w.onFoot).toBeNull();
  run(sim, { type: 'SEA_HANDOFF_RETURN', result: outcome.result });
  return { outcome, crew, stores };
}

describe('the wreck on Sgeir Dhubh (Book 6 section 19)', () => {
  it('is handed off on the first crossing to Carrick, on the Skarvholm to Carrick route', () => {
    const { sim } = atTheWreck();
    const req = currentHandoff(sim.state);
    expect(req).toMatchObject({
      kind: 'ON_FOOT',
      scenarioId: 'SCN_SEA_WRECK',
      edgeId: 'SEA_SKARV_CARRICK',
    });
    // The scene: the steerer ashore by the boat, the three survivors in their poses; adults only.
    expect(beginWreck(sim.state, ctx, map)).toBe(true);
    const onFoot = sim.state.onFoot;
    expect(onFoot?.zone).toBe('ZONE_SEA_WRECK');
    expect(Object.keys(onFoot?.actors ?? {}).sort()).toEqual(['C_DERBAIL', 'C_FINAN', 'C_IVAR']);
    expect(onFoot?.actors['C_FINAN']?.pose).toBe('call');
    expect(onFoot?.actors['C_DERBAIL']?.pose).toBe('watch');
    expect(onFoot?.actors['C_IVAR']?.pose).toBe('down');
    expect(ctx.def.survivors).toHaveLength(wb.survivors);
    // Not twice: the scene is in place.
    expect(beginWreck(sim.state, ctx, map)).toBe(false);
  });

  for (const choice of CHOICES)
    it(`completes the answer ${choice}, and the voyage sails on to Carrick`, () => {
      const { sim } = atTheWreck();
      const w = sim.state;
      const free = freeBerths(w, ctx);
      const { outcome, crew, stores } = play(choice, sim);
      const rescued = choice === 'ABOARD' || choice === 'ASHORE';
      const goods = choice !== 'LEAVE';
      // The voyage takes the result and goes on.
      expect(w.sea.voyage?.handoff).toBeNull();
      expect(outcome.result.outcome).toBe('CONTINUE');
      expect(w.facts[WRECK_FACTS.choice]).toBe(choice);
      expect(w.facts[WRECK_FACTS.cask]).toBe(goods);
      expect(w.facts[WRECK_FACTS.iron]).toBe(goods ? wb.ironLots : 0);
      expect(w.facts[WRECK_FACTS.goods]).toBe(rescued ? 'GIVEN' : goods ? 'TAKEN' : 'NONE');
      expect(w.facts[WRECK_FACTS.warned]).toBe(choice === 'ASHORE');
      const after = Object.values(w.sea.voyage?.stores ?? {}).reduce((a, n) => a + n, 0);
      expect(after - stores).toBeCloseTo(goods ? wb.caskStoresRd : 0, 6);
      // Berths: the Chapter 2 household leaves three free on the coastal boat (Book 10 Hulls).
      expect(free).toBe(3);
      expect(w.facts[WRECK_FACTS.overloaded]).toBe(0);
      if (rescued) {
        expect(w.sea.voyage?.aboard).toEqual([...crew, 'C_FINAN', 'C_DERBAIL', 'C_IVAR']);
        // Survivors aboard are people of the world, outside the roster; Ívar's leg is a wound.
        for (const id of ['C_FINAN', 'C_DERBAIL', 'C_IVAR']) {
          expect(w.people[id]).toBeDefined();
          expect(w.household.residents).not.toContain(id);
        }
        expect(w.people['C_IVAR']?.wounds[0]).toMatchObject({ severity: 'SERIOUS', where: 'leg' });
        expect(w.facts[WRECK_FACTS.survivors]).toBe(choice);
        expect(w.ledger.at(-1)?.tag).toBe('RESCUE');
      } else {
        expect(w.sea.voyage?.aboard).toEqual(crew);
        expect(w.people['C_FINAN']).toBeUndefined();
        expect(['TAKEN_OFF', 'DROWNED']).toContain(w.facts[WRECK_FACTS.survivors]);
        if (choice === 'SALVAGE') expect(w.ledger.at(-1)?.tag).toBe('THEFT');
      }
      // On to Carrick Landing: its landing handoff comes, with the survivors' stores eaten.
      for (let i = 0; i < 40 && currentHandoff(w)?.landing !== true; i++) {
        const v = w.sea.voyage;
        if (v === null) break;
        if (v.status === 'CHOICE') run(sim, { type: 'SEA_CHOOSE', option: 'PRESS_ON' });
        else run(sim, { type: 'SEA_WATCH' });
      }
      expect(currentHandoff(w)).toMatchObject({ scenarioId: 'SCN_CARRICK', landing: true });
    });

  it('is deterministic: the same answer from the same world gives the same result and world', () => {
    const one = atTheWreck();
    const two = atTheWreck();
    const a = play('ASHORE', one.sim);
    const c = play('ASHORE', two.sim);
    expect(c.outcome).toEqual(a.outcome);
    expect(stateHash(two.sim.state)).toBe(stateHash(one.sim.state));
  });

  it('the left survivors live or drown by the next day’s wind (Book 10 leftTakenOffBelow)', () => {
    const { sim } = atTheWreck();
    const w = sim.state;
    const day = w.calendar.day;
    const tomorrow = w.sea.weather.days[day + 1];
    if (tomorrow === undefined) throw new Error('tomorrow not drawn');
    for (const [strength, fate, word] of [
      [wb.leftTakenOffBelow - 1, 'TAKEN_OFF', 'LEFT'],
      [wb.leftTakenOffBelow, 'DROWNED', 'NONE'],
    ] as const) {
      w.sea.weather.days[day + 1] = { ...tomorrow, strength: strength as 0 | 1 | 2 | 3 | 4 };
      const r = wreckResult(w, ctx, 'LEAVE');
      expect(r.survivors).toBe(fate);
      expect(r.result.facts[WRECK_FACTS.word]).toBe(word);
      expect(r.result.aboardChanges.join).toEqual([]);
      expect(r.result.storesDelta).toBe(0);
      const s = wreckResult(w, ctx, 'SALVAGE');
      expect(s.result.facts[WRECK_FACTS.word]).toBe(fate === 'TAKEN_OFF' ? 'ROBBED' : 'NONE');
    }
  });

  it('counts survivors beyond the free berths (Book 6 section 01: two cargo slots each)', () => {
    const { sim } = atTheWreck();
    const w = sim.state;
    w.sea.voyage?.aboard.push('C_EITHNE', 'C_NESSA');
    expect(freeBerths(w, ctx)).toBe(1);
    expect(wreckResult(w, ctx, 'ABOARD').overloaded).toBe(2);
    expect(wreckResult(w, ctx, 'LEAVE').overloaded).toBe(0);
  });

  it('“Not yet” closes the question without an answer, and it can be asked again', () => {
    const { sim } = atTheWreck();
    const w = sim.state;
    beginWreck(w, ctx, map);
    standAt(w, ctx.def.board.x, ctx.def.board.y);
    expect(wreckInteract(w, ctx, T, () => undefined)).toBe(ASK_SITE);
    expect(chooseWreck(w, ctx, 4)).toBeNull();
    untilQuiet(sim);
    expect(w.facts[WRECK_FACTS.choice]).toBeUndefined();
    expect(wreckReady(w, ctx)).toBe(false);
    expect(wreckInteract(w, ctx, T, () => undefined)).toBe(ASK_SITE);
  });
});
