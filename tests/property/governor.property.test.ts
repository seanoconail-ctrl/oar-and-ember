/**
 * Stage 13 acceptance check 3 (Book 3): the governor keeps two quiet legs per eventful one over
 * 200 simulated voyages, within Book 10's eventfulBand, for any seed; and supernatural encounters
 * come about once in three or four voyages (Book 10 supernaturalBand), tested with a test table in
 * which every table offers one. Voyages are sailed through the sea's own functions (the time on
 * the calendar only), to destinations drawn from the seed, all year round.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseTimeBalance } from '../../src/content/balance.ts';
import { parseSeaBalance } from '../../src/content/seaBalance.ts';
import { seedAllStreams } from '../../src/core/rng.ts';
import { readSave } from '../../src/persist/save.ts';
import { advanceMinutes } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import {
  choose,
  depart,
  ensureWeather,
  plainResult,
  plotCourse,
  resolveWatch,
  returnFromHandoff,
  turnBack,
} from '../../src/sim/sea/index.ts';
import type { EncounterEntry, SeaContext, VoyageHooks } from '../../src/sim/sea/index.ts';
import { chartAll } from '../../src/sim/sea/chart.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { GOLDEN_12 } from '../../src/tools/saves/golden.ts';
import { repoFile } from '../unit/books.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const sb = parseSeaBalance(balance);
const { content } = loadContentFromDisk();
const real: SeaContext = ((): SeaContext => {
  const s = landContext(content, balance).sea;
  if (s == null) throw new Error('no sea context');
  return s;
})();
const golden = JSON.parse(repoFile(GOLDEN_12)) as unknown;
const VOYAGES = 200;

/** Every table with a supernatural entry that always applies (the test table). */
function testTables(ctx: SeaContext): SeaContext {
  const tables = new Map<string, readonly EncounterEntry[]>();
  for (const [id, entries] of ctx.tables)
    tables.set(id, [
      ...entries.filter((e) => e.supernatural !== true),
      { key: 'test_super', textKey: 'sea.enc.open.follower', supernatural: true, weight: 1 },
    ]);
  return { ...ctx, tables };
}

/** Sails `VOYAGES` courses from the chapter end on `seed`; returns the governor. */
function sail(seed: number, ctx: SeaContext): WorldState['sea']['governor'] {
  const world = readSave(golden).state;
  (world as { rng: WorldState['rng'] }).rng = seedAllStreams(`governor-${seed}`);
  chartAll(world, ctx);
  const home = world.homes['ISLE_SKARV'];
  ensureWeather(world, sb, sb.forecastAccuracy);
  const h: VoyageHooks = {
    advance: (m) => {
      world.calendar = advanceMinutes(world.calendar, m, b);
      ensureWeather(world, sb, sb.forecastAccuracy);
    },
    emit: () => undefined,
  };
  const places = [...ctx.nodes.values()].filter(
    (n) => n.kind === 'PLACE' && (ctx.byNode.get(n.id) ?? []).length > 0,
  );
  let pick = seed >>> 0;
  const next = (): number => {
    pick = (Math.imul(pick, 1664525) + 1013904223) >>> 0;
    return pick;
  };
  let guard = 0;
  while (world.sea.governor.voyages < VOYAGES && guard++ < 100_000) {
    // Plenty of food: the governor is under test, not the stores.
    if (home !== undefined && world.sea.voyage === null) home.stores['RES_SALTED_FISH'] = 500;
    const v = world.sea.voyage;
    if (v === null || v.status === 'ANCHORED') {
      const from = v?.at ?? ctx.home;
      const choices = places.filter((p) => p.id !== from);
      const to =
        v !== null && next() % 2 === 0
          ? ctx.home
          : (choices[next() % choices.length]?.id ?? ctx.home);
      const plot = plotCourse(world, ctx, to);
      if (!plot.ok) {
        // Winter: wait a day at home (or anchored) for a calm.
        if (v !== null && v.at !== ctx.home) turnBack(world, ctx, h);
        h.advance(1440);
        continue;
      }
      world.sea.plan = plot.plan;
      depart(world, ctx, h);
      continue;
    }
    if (v.status === 'CHOICE') choose(world, ctx, h, 'PRESS_ON');
    else if (v.status === 'HANDOFF') returnFromHandoff(world, ctx, h, plainResult());
    else resolveWatch(world, ctx, h);
  }
  // Finish the last course.
  for (
    let i = 0;
    i < 200 && world.sea.voyage !== null && world.sea.voyage.status !== 'ANCHORED';
    i++
  ) {
    const v = world.sea.voyage;
    if (v.status === 'CHOICE') choose(world, ctx, h, 'PRESS_ON');
    else if (v.status === 'HANDOFF') returnFromHandoff(world, ctx, h, plainResult());
    else resolveWatch(world, ctx, h);
  }
  return world.sea.governor;
}

describe('the governor (Book 10 section 02, "Encounters")', () => {
  it('keeps two quiet legs per eventful one over 200 seeded voyages, within Book 10’s band', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const g = sail(seed, real);
        const share = g.eventful / g.legs;
        expect(g.voyages).toBeGreaterThanOrEqual(VOYAGES);
        expect(share, `seed ${seed}: ${g.eventful} of ${g.legs}`).toBeGreaterThanOrEqual(
          sb.governor.eventfulBand[0],
        );
        expect(share, `seed ${seed}: ${g.eventful} of ${g.legs}`).toBeLessThanOrEqual(
          sb.governor.eventfulBand[1],
        );
      }),
      { numRuns: 6, seed: 13 },
    );
  }, 120_000);

  it('brings a supernatural encounter about once in three or four voyages (a test table)', () => {
    const ctx = testTables(real);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const g = sail(seed, ctx);
        const every = g.voyages / g.supernatural;
        expect(every, `seed ${seed}: ${g.supernatural} in ${g.voyages}`).toBeGreaterThanOrEqual(
          sb.governor.supernaturalBand[0],
        );
        expect(every, `seed ${seed}: ${g.supernatural} in ${g.voyages}`).toBeLessThanOrEqual(
          sb.governor.supernaturalBand[1],
        );
        const share = g.eventful / g.legs;
        expect(share).toBeGreaterThanOrEqual(sb.governor.eventfulBand[0]);
        expect(share).toBeLessThanOrEqual(sb.governor.eventfulBand[1]);
      }),
      { numRuns: 4, seed: 31 },
    );
  }, 120_000);
});
