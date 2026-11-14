/**
 * Stage 13 scenario tests, through the whole simulation (its commands, its away step for the
 * home): the first voyage of Chapter 2 to Carrick Landing (the raid gate, the wreck's handoff, the
 * landing's Stage 16 stub, home again), and check 2 again: the Cauldron passed only at slack water
 * from departures across a year.
 */
import { describe, expect, it } from 'vitest';
import { parseTimeBalance } from '../../src/content/balance.ts';
import { parseSeaBalance } from '../../src/content/seaBalance.ts';
import { readSave } from '../../src/persist/save.ts';
import { advanceMinutes, isSlack } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import {
  beginHandoffScene,
  currentHandoff,
  endHandoffScene,
  inWinterClosure,
  plainResult,
} from '../../src/sim/sea/index.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { GOLDEN_12 } from '../../src/tools/saves/golden.ts';
import { repoFile } from '../unit/books.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const sb = parseSeaBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const WATCH = b.watchHours * 60;

function chapterEnd(): WorldState {
  return readSave(JSON.parse(repoFile(GOLDEN_12))).state;
}

/** One command, one tick. */
function run(sim: Simulation, command: Parameters<Simulation['submit']>[0]): void {
  sim.submit(command);
  sim.step();
}

describe('Chapter 2: setting out for Carrick Landing', () => {
  it('starts the raid gate, meets the wreck, hands off the landing (Stage 16 stub) and comes home', () => {
    const sim = createSimulation(b, chapterEnd(), land);
    const events: SimEvent[] = [];
    sim.events.onAny((e) => events.push(e));
    const residents = [...sim.state.household.residents];
    const homeFood = (): number =>
      (sim.state.homes['ISLE_SKARV']?.stores['RES_SALTED_FISH'] ?? 0) +
      (sim.state.homes['ISLE_SKARV']?.stores['RES_GRAIN'] ?? 0);
    run(sim, { type: 'SEA_PLOT', to: 'SITE_CARRICK' });
    expect(sim.state.sea.plan?.gate).toBe('BEAT_2_RAID');
    const before = homeFood();
    run(sim, { type: 'SEA_DEPART' });
    // The gate machinery: started, its checkpoint and the departure's autosave.
    expect(sim.state.gates['BEAT_2_RAID']?.status).toBe('STARTED');
    expect(events.some((e) => e.type === 'GATE_STARTED' && e.gate === 'BEAT_2_RAID')).toBe(true);
    expect(events.some((e) => e.type === 'CHECKPOINT' && e.label === 'carrick')).toBe(true);
    expect(events.some((e) => e.type === 'SEA_DEPARTED')).toBe(true);
    expect(sim.state.onFoot).toBeNull();
    expect(homeFood()).toBeLessThan(before);
    // On the sea map the clock waits for the watches, and on-foot commands are refused.
    const minute = sim.state.calendar.minuteOfDay;
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.state.calendar.minuteOfDay).toBe(minute);
    run(sim, { type: 'SLEEP' });
    expect(events.at(-1)).toMatchObject({ type: 'COMMAND_REFUSED', reason: 'AT_SEA' });
    // Sail to the wreck: its scene is put in place, then its result comes back.
    let wreck = false;
    for (let i = 0; i < 40 && sim.state.sea.voyage?.handoff?.landing !== true; i++) {
      const v = sim.state.sea.voyage;
      if (v === null) break;
      if (v.status === 'HANDOFF') {
        const req = currentHandoff(sim.state);
        expect(req?.scenarioId).toBe('SCN_SEA_WRECK');
        wreck = true;
        // A stand-in scene (the wreck's own is built beside this): the home's, kept.
        const scene = sim.state.sea.stash;
        if (scene === null) throw new Error('no home scene kept');
        expect(beginHandoffScene(sim.state, structuredClone(scene))).toBe(true);
        const t = sim.state.calendar;
        for (let k = 0; k < 600; k++) sim.step();
        // On foot in the scene the clock runs, the home through the away step.
        expect(sim.state.calendar).not.toEqual(t);
        endHandoffScene(sim.state);
        run(sim, { type: 'SEA_HANDOFF_RETURN', result: plainResult() });
        continue;
      }
      if (v.status === 'CHOICE') run(sim, { type: 'SEA_CHOOSE', option: 'PRESS_ON' });
      else run(sim, { type: 'SEA_WATCH' });
    }
    expect(wreck).toBe(true);
    expect(currentHandoff(sim.state)).toMatchObject({
      kind: 'ON_FOOT',
      scenarioId: 'SCN_CARRICK',
      placeId: 'SITE_CARRICK',
      landing: true,
      stubUntilStage: 16,
    });
    // The Stage 16 stub's result: the boat lies at Carrick, then turns for home.
    run(sim, { type: 'SEA_HANDOFF_RETURN', result: plainResult() });
    expect(sim.state.sea.voyage?.status).toBe('ANCHORED');
    run(sim, { type: 'SEA_TURN_BACK' });
    for (let i = 0; i < 40 && sim.state.sea.voyage !== null; i++) {
      const v = sim.state.sea.voyage;
      if (v.status === 'CHOICE') run(sim, { type: 'SEA_CHOOSE', option: 'PRESS_ON' });
      else if (v.status === 'HANDOFF')
        run(sim, { type: 'SEA_HANDOFF_RETURN', result: plainResult() });
      else run(sim, { type: 'SEA_WATCH' });
    }
    expect(sim.state.sea.voyage).toBeNull();
    expect(events.some((e) => e.type === 'SEA_HOME')).toBe(true);
    // Home: the scene is back, the steerer on the strand, the crew home, the clock running.
    expect(sim.state.onFoot?.zone).toBe('ZONE_SK_STRAND');
    expect(sim.state.household.residents).toEqual(residents);
    expect(sim.state.ships['flagship']?.aboard).toEqual([]);
    const m = sim.state.calendar.minuteOfDay;
    for (let i = 0; i < 6000; i++) sim.step();
    expect(sim.state.calendar.minuteOfDay).not.toBe(m);
  });
});

describe('Stage 13 check 2 (scenario): the Cauldron only at slack, across a year', () => {
  it('departures for Glen Arra from watches across the year pass the Cauldron at slack', () => {
    let passed = 0;
    for (let watch = 0; watch < 480; watch += 37) {
      const world = chapterEnd();
      world.calendar = advanceMinutes({ day: 1, minuteOfDay: b.dayStart }, watch * WATCH, b);
      const sim = createSimulation(b, world, land);
      if (inWinterClosure(sim.state.sea, sim.state.calendar.day)) continue;
      run(sim, { type: 'DEV_SEA_CHART' });
      run(sim, { type: 'SEA_PLOT', to: 'GLEN_ARRA' });
      if (sim.state.sea.plan?.legs[0]?.edge !== 'SEA_SKARV_CAULDRON') continue;
      run(sim, { type: 'SEA_DEPART' });
      const events: SimEvent[] = [];
      sim.events.onAny((e) => events.push(e));
      for (let i = 0; i < 40 && sim.state.sea.voyage?.at !== 'GLEN_ARRA'; i++) {
        const v = sim.state.sea.voyage;
        if (v === null) break;
        const cal = sim.state.calendar;
        const n = events.length;
        if (v.status === 'CHOICE') run(sim, { type: 'SEA_CHOOSE', option: 'PRESS_ON' });
        else if (v.status === 'HANDOFF')
          run(sim, { type: 'SEA_HANDOFF_RETURN', result: plainResult() });
        else run(sim, { type: 'SEA_WATCH' });
        for (const e of events.slice(n))
          if (e.type === 'SEA_LEG_STARTED' && e.edge === 'SEA_CAULDRON_ARRA') {
            passed++;
            expect(isSlack(cal, b, sb.slackWindowMinutes), `watch ${watch}`).toBe(true);
          }
      }
      expect(sim.state.sea.voyage?.at).toBe('GLEN_ARRA');
    }
    expect(passed).toBeGreaterThan(5);
  }, 120_000);
});
