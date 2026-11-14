/**
 * Stage 13 (Book 3): sea-map travel and voyage events. Check 1: travel times are deterministic
 * and match Book 10; check 2: the Cauldron is passable only at slack water (also in
 * tests/scenario/voyage.test.ts); and the rest of the sea's contract: the watch's budget, stores
 * never below zero, the forecast's accuracy, winter closure and calm windows, the Cailleach's
 * washing, storms feeding the driftwood, refusals in words, discovery, the choice, handoffs and
 * every edge reachable. Every number is read from content/balance.json (Book 10).
 */
import { describe, expect, it } from 'vitest';
import { parseTimeBalance } from '../../src/content/balance.ts';
import { parseShipBalance } from '../../src/content/shipBalance.ts';
import { parseSeaBalance, POINTS } from '../../src/content/seaBalance.ts';
import type { Point8 } from '../../src/content/seaBalance.ts';
import { loadContent } from '../../src/content/registry.ts';
import { readSave } from '../../src/persist/save.ts';
import {
  isSlack,
  minutesToSlack,
  tideAt,
  advanceMinutes,
} from '../../src/sim/calendar/calendar.ts';
import { campContext, startDay, washUpDriftwood } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import {
  bearingOf,
  depart,
  effectiveSpeed,
  ensureWeather,
  legMinutes,
  plotCourse,
  pointOfSail,
  resolveWatch,
  choose,
  returnFromHandoff,
  turnBack,
  storesRd,
  inWinterClosure,
  closedOn,
  shipStats,
  planLeg,
  currentHandoff,
  plainResult,
} from '../../src/sim/sea/index.ts';
import type { SeaContext, SeaEvent, VoyageHooks } from '../../src/sim/sea/index.ts';
import { chartAll } from '../../src/sim/sea/chart.ts';
import { minuteOf } from '../../src/sim/sea/state.ts';
import { createSimulation, stateHash } from '../../src/sim/simulation.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk, readContentFiles } from '../../src/tools/content/loadContentFiles.ts';
import { GOLDEN_12 } from '../../src/tools/saves/golden.ts';
import { repoFile } from './books.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const sb = parseSeaBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const sea: SeaContext = ((): SeaContext => {
  if (land.sea == null) throw new Error('no sea context');
  return land.sea;
})();
const WATCH = b.watchHours * 60;
/** Book 10 section 05: the gilt weather-vane's forecast. */
const vaneForecast =
  parseShipBalance(balance).fittings.get('Gilt weather-vane')?.effect.forecast ?? 0;

/** The chapter end of the fourth playtest (golden 12), at version 15: launched, seaworthy. */
function chapterEnd(): WorldState {
  const { state } = readSave(JSON.parse(repoFile(GOLDEN_12)));
  ensureWeather(state, sb, sb.forecastAccuracy);
  return state;
}

/** Hooks that pass time on the calendar only (the sea's own work, for the budget). */
function hooks(world: WorldState, events: SeaEvent[] = []): VoyageHooks {
  return {
    advance: (m) => {
      world.calendar = advanceMinutes(world.calendar, m, b);
      ensureWeather(world, sb, sb.forecastAccuracy);
    },
    emit: (e) => events.push(e),
    home: () => undefined,
  };
}

/** Today's wind set to `from` at `strength`. */
function setWind(world: WorldState, from: Point8, strength: 0 | 1 | 2 | 3 | 4): void {
  const day = world.calendar.day;
  const w = world.sea.weather.days[day];
  if (w === undefined) throw new Error('no weather today');
  world.sea.weather.days[day] = { ...w, windFrom: from, strength, named: null, calm: false };
  const f = world.sea.weather.forecasts[day + 1];
  if (f !== undefined)
    world.sea.weather.forecasts[day + 1] = { ...f, windFrom: from, strength, storm: false };
}

/** The T1 coastal boat with no fitting (the hold taken off). */
function plainT1(world: WorldState): WorldState {
  const ship = world.ships['flagship'];
  if (ship === undefined) throw new Error('no boat');
  for (const k of Object.keys(ship.fittings)) ship.fittings[k] = null;
  return world;
}

/** The point the wind must come from for a heading to be `off` points off it. */
const windFor = (heading: Point8, off: number): Point8 =>
  POINTS[(POINTS.indexOf(heading) + off) % 8] ?? 'N';

describe('Book 10 section 02: the sea numbers read from balance.json', () => {
  it('reads every sea table', () => {
    expect(sb.referenceSpeed).toBeGreaterThan(0);
    expect(sb.routes.size).toBe(14);
    expect(sb.slackWindowMinutes).toBeGreaterThan(0);
    expect(sb.weights.size).toBe(4);
    for (const season of ['Spring', 'Summer', 'Autumn', 'Winter'] as const) {
      expect(sb.weather.windFrom[season].reduce((s, x) => s + x, 0)).toBe(100);
      expect(sb.weather.strength[season].reduce((s, x) => s + x, 0)).toBe(100);
    }
    expect(sb.governor.eventfulBand[0]).toBeLessThan(sb.governor.eventfulShare);
    expect(sb.governor.eventfulBand[1]).toBeGreaterThan(sb.governor.eventfulShare);
  });

  it('builds the sea map from content: 10 places, 2 hazard nodes, 14 edges on Book 10', () => {
    expect([...sea.nodes.values()].filter((n) => n.kind === 'PLACE')).toHaveLength(10);
    expect(
      [...sea.nodes.values()]
        .filter((n) => n.kind === 'HAZARD')
        .map((n) => n.id)
        .sort(),
    ).toEqual(['HAZ_BLUEMEN', 'HAZ_CAULDRON']);
    expect(sea.edges.size).toBe(14);
    for (const e of sea.edges.values()) {
      const row = sb.routes.get(e.id);
      expect(row, e.id).toBeDefined();
      expect([e.baseWatches, e.exposure, e.winter]).toEqual([
        row?.baseWatches,
        row?.exposure,
        row?.winter,
      ]);
    }
    expect(sea.edges.get('SEA_SKARV_CAULDRON')?.tideGate).toEqual({
      passableAt: 'SLACK',
      at: 'HAZ_CAULDRON',
    });
  });

  it('content lint catches a broken sea file', () => {
    const files = readContentFiles() as Record<string, unknown>;
    const broken = structuredClone(files['sea']) as {
      edges: { a: string }[];
      tables: Record<string, { entries: { key: string }[] }>;
    };
    const first = broken.edges[0];
    if (first !== undefined) first.a = 'ISLE_NOWHERE';
    broken.tables['ENC_OPEN']?.entries.push({
      key: 'unweighed',
      textKey: 'sea.enc.open.sail',
    } as never);
    const { issues } = loadContent({ ...files, sea: broken } as never);
    const reasons = issues.filter((i) => i.file === 'content/sea.json').map((i) => i.reason);
    expect(reasons.some((r) => r.includes('ISLE_NOWHERE'))).toBe(true);
    expect(reasons.some((r) => r.includes('no weight'))).toBe(true);
  });
});

describe('Stage 13 check 1: travel times are deterministic and match Book 10', () => {
  it('the T1 boat from Skarvholm to Carrick at every point of sail', () => {
    const world = plainT1(chapterEnd());
    const edge = sea.edges.get('SEA_SKARV_CARRICK');
    const a = sea.nodes.get('ISLE_SKARV');
    const z = sea.nodes.get('SITE_CARRICK');
    if (edge === undefined || a === undefined || z === undefined) throw new Error('no edge');
    const heading = bearingOf(a.pos, z.pos);
    const crew = world.household.residents.length + 1;
    const stats = shipStats(world, sea, crew);
    if (stats === null) throw new Error('no stats');
    const factors = {
      RUNNING: sb.windFactor.running,
      BROAD_REACH: sb.windFactor.broadReach,
      BEAM: sb.windFactor.beam,
      CLOSE_HAULED: stats.closeHauled ?? sb.windFactor.closeHauled,
      AGAINST: sb.windFactor.against,
    };
    const seen: Record<string, number> = {};
    for (const [off, pos] of [
      [4, 'RUNNING'],
      [3, 'BROAD_REACH'],
      [2, 'BEAM'],
      [1, 'CLOSE_HAULED'],
      [0, 'AGAINST'],
    ] as const) {
      setWind(world, windFor(heading, off), 2);
      const plot = plotCourse(world, sea, 'SITE_CARRICK');
      if (!plot.ok) throw new Error(plot.reason);
      const leg = plot.plan.legs[0];
      expect(leg?.pointOfSail).toBe(pos);
      const sail = stats.sailSpeed * factors[pos];
      const row = stats.oarSpeed * sb.rowingFactor;
      const speed = Math.max(sail, row);
      expect(leg?.speed).toBeCloseTo(speed, 9);
      expect(leg?.rowing).toBe(row > sail);
      expect(leg?.minutes).toBe(
        Math.round(((edge.baseWatches * sb.referenceSpeed) / speed) * WATCH),
      );
      seen[pos] = leg?.minutes ?? 0;
    }
    // Running is quickest; against the wind it rows; a calm rows too.
    expect(seen['RUNNING']).toBeLessThan(seen['BROAD_REACH'] ?? 0);
    expect(seen['BROAD_REACH']).toBeLessThan(seen['BEAM'] ?? 0);
    setWind(world, windFor(heading, 4), 0);
    const calm = plotCourse(world, sea, 'SITE_CARRICK');
    expect(calm.ok && calm.plan.legs[0]?.pointOfSail).toBe('CALM');
    expect(calm.ok && calm.plan.legs[0]?.minutes).toBe(seen['AGAINST']);
  });

  it('the extended hold: oars slower (Book 10 section 05: oar -1, rowing crew +1)', () => {
    const plain = plainT1(chapterEnd());
    const held = chapterEnd();
    expect(Object.values(held.ships['flagship']?.fittings ?? {})).toContain('FIT_EXTENDED_HOLD');
    const crew = held.household.residents.length + 1;
    const ps = shipStats(plain, sea, crew);
    const hs = shipStats(held, sea, crew);
    if (ps === null || hs === null) throw new Error('no stats');
    expect(hs.oarSpeed).toBeLessThan(ps.oarSpeed);
    for (const w of [plain, held]) setWind(w, 'N', 0);
    const p = plotCourse(plain, sea, 'SITE_CARRICK');
    const h = plotCourse(held, sea, 'SITE_CARRICK');
    if (!p.ok || !h.ok) throw new Error('no course');
    const base = sea.edges.get('SEA_SKARV_CARRICK')?.baseWatches ?? 0;
    expect(h.plan.minutes).toBe(
      Math.round(((base * sb.referenceSpeed) / (hs.oarSpeed * sb.rowingFactor)) * WATCH),
    );
    expect(h.plan.minutes).toBeGreaterThan(p.plan.minutes);
  });

  it('the Cauldron route to Glen Arra saves about two watches on the Crowwick route', () => {
    const world = chartWorld();
    const crew = world.household.residents.length + 1;
    const stats = shipStats(world, sea, crew);
    if (stats === null) throw new Error('no stats');
    // At the reference speed (Book 10: base watches are at speed 3), the sailing saved.
    const ref = { sailSpeed: 0, oarSpeed: sb.referenceSpeed / sb.rowingFactor, closeHauled: null };
    const now = minuteOf(world.calendar, b);
    const leg = (id: string, from: string): number =>
      planLeg(world, sea, ref, sea.edges.get(id) as never, from, now, 0).minutes;
    const cauldron =
      leg('SEA_SKARV_CAULDRON', 'ISLE_SKARV') + leg('SEA_CAULDRON_ARRA', 'HAZ_CAULDRON');
    const crowwick =
      leg('SEA_SKARV_CROWWICK', 'ISLE_SKARV') + leg('SEA_CROWWICK_ARRA', 'CAMP_CROWWICK');
    expect(crowwick - cauldron).toBe(2 * WATCH);
    // As plotted, with the wait for slack at the Cauldron: the Cauldron course is taken, and saves
    // two watches less the wait (never more than a watch less the slack window either side).
    setWind(world, 'N', 0);
    const plot = plotCourse(world, sea, 'GLEN_ARRA');
    if (!plot.ok) throw new Error(plot.reason);
    expect(plot.plan.legs.map((l) => l.edge)).toEqual(['SEA_SKARV_CAULDRON', 'SEA_CAULDRON_ARRA']);
    const wait = plot.plan.legs[1]?.waitMinutes ?? 0;
    expect(wait).toBeLessThanOrEqual(WATCH - 2 * sb.slackWindowMinutes);
    const rowSpeed = stats.oarSpeed * sb.rowingFactor;
    const viaCrowwick = Math.round(((4 * sb.referenceSpeed) / rowSpeed) * WATCH);
    expect(viaCrowwick - plot.plan.minutes).toBeGreaterThan(0);
  });

  it('gives identical state hashes from the same seed and commands', () => {
    const run = (): string => {
      const world = chapterEnd();
      const sim = createSimulation(b, world, land);
      sim.submit({ type: 'SEA_PLOT', to: 'SITE_CARRICK' });
      sim.step();
      sim.submit({ type: 'SEA_DEPART' });
      sim.step();
      for (let i = 0; i < 12; i++) {
        const v = sim.state.sea.voyage;
        if (v === null) break;
        if (v.status === 'HANDOFF')
          sim.submit({ type: 'SEA_HANDOFF_RETURN', result: plainResult() });
        else if (v.status === 'CHOICE') sim.submit({ type: 'SEA_CHOOSE', option: 'PRESS_ON' });
        else sim.submit({ type: 'SEA_WATCH' });
        sim.step();
      }
      return stateHash(sim.state);
    };
    expect(run()).toBe(run());
  });

  it('rounds bearings to eight points and points of sail by points off', () => {
    expect(bearingOf({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe('N');
    expect(bearingOf({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe('E');
    expect(bearingOf({ x: 0, y: 0 }, { x: -10, y: 10 })).toBe('SW');
    expect(pointOfSail('E', 'W', 2)).toBe('RUNNING');
    expect(pointOfSail('E', 'E', 2)).toBe('AGAINST');
    expect(pointOfSail('E', 'NE', 2)).toBe('CLOSE_HAULED');
    expect(pointOfSail('E', 'E', 0)).toBe('CALM');
    expect(
      effectiveSpeed({ sailSpeed: 3, oarSpeed: 2, closeHauled: null }, 'AGAINST', sb).rowing,
    ).toBe(true);
    expect(legMinutes(2, 0, sb, WATCH)).toBe(Number.POSITIVE_INFINITY);
  });
});

/** The chapter end with every route known (the developer's chart). */
function chartWorld(): WorldState {
  const world = chapterEnd();
  chartAll(world, sea);
  return world;
}

describe('Stage 13 check 2: the Cauldron is passable only at slack water', () => {
  it('isSlack is exactly within the window of a tide turn, over a year of watches', () => {
    const start = { day: 1, minuteOfDay: b.dayStart };
    const at = (m: number) => advanceMinutes(start, m, b);
    const year = 120 * 1440;
    // Independently: the tide turns at a watch boundary where its phase changes.
    const turns: number[] = [];
    for (let t = WATCH; t <= year + WATCH; t += WATCH)
      if (tideAt(at(t - 1), b).phase !== tideAt(at(t), b).phase) turns.push(t);
    expect(turns.length).toBeGreaterThan(400);
    const w = sb.slackWindowMinutes;
    let slackMinutes = 0;
    for (let m = 0; m < year; m += 5) {
      const expected = turns.some((t) => m >= t - w && m < t + w);
      const cal = at(m);
      expect(isSlack(cal, b, w), `minute ${m}`).toBe(expected);
      if (expected) slackMinutes += 5;
      else {
        const wait = minutesToSlack(cal, b, w);
        expect(wait).toBeGreaterThan(0);
        expect(isSlack(at(m + wait), b, w)).toBe(true);
        expect(isSlack(at(m + wait - 1), b, w)).toBe(false);
      }
    }
    expect(slackMinutes).toBeGreaterThan(0);
  });

  it('a voyage held at the Cauldron goes on only at slack, from any watch of a year', () => {
    let passed = 0;
    let held = 0;
    for (let watch = 0; watch < 480; watch += 7) {
      const world = chartWorld();
      world.calendar = advanceMinutes({ day: 1, minuteOfDay: b.dayStart }, watch * WATCH, b);
      world.sea.weather = { rolledTo: 0, days: {}, forecasts: {}, years: {}, calmLeft: 0 };
      ensureWeather(world, sb, sb.forecastAccuracy);
      // Keep winter out of it: the Cauldron's routes close for winter outside calm windows.
      if (inWinterClosure(world.sea, world.calendar.day)) continue;
      setWind(world, 'N', 0);
      const plot = plotCourse(world, sea, 'GLEN_ARRA');
      if (!plot.ok) throw new Error(plot.reason);
      world.sea.plan = plot.plan;
      const events: SeaEvent[] = [];
      const h = hooks(world, events);
      expect(depart(world, sea, h)).toBeNull();
      for (let i = 0; i < 40 && world.sea.voyage !== null; i++) {
        const v = world.sea.voyage;
        if (v.status === 'CHOICE') choose(world, sea, h, 'PRESS_ON');
        else if (v.status === 'HANDOFF') returnFromHandoff(world, sea, h, plainResult());
        else if (v.status === 'ANCHORED') break;
        else {
          // A leg starts as the step begins, before its time passes.
          const before = events.length;
          const cal = world.calendar;
          resolveWatch(world, sea, h);
          for (const e of events.slice(before))
            if (e.type === 'SEA_LEG_STARTED' && e.edge === 'SEA_CAULDRON_ARRA') {
              passed++;
              expect(isSlack(cal, b, sb.slackWindowMinutes), `watch ${watch}`).toBe(true);
            }
          for (const e of events.slice(before))
            if (e.type === 'SEA_HELD' && e.reason === 'TIDE') {
              // Held on arriving at the hazard, as the step ends: not at slack then.
              held++;
              expect(isSlack(world.calendar, b, sb.slackWindowMinutes)).toBe(false);
            }
        }
      }
      expect(world.sea.voyage?.at).toBe('GLEN_ARRA');
    }
    // Both happen over the year: some arrivals hold off, and every passage is at slack.
    expect(passed).toBeGreaterThan(40);
    expect(held).toBeGreaterThan(0);
  });
});

describe('the voyage: stores, budget, discovery, the choice and handoffs', () => {
  it('resolves a watch in under 2 ms (Book 2 section 22)', () => {
    const times: number[] = [];
    for (let n = 0; n < 6; n++) {
      const world = chartWorld();
      const h = hooks(world);
      const plot = plotCourse(world, sea, 'ISLE_KALDNESS');
      if (!plot.ok) continue;
      world.sea.plan = plot.plan;
      depart(world, sea, h);
      for (let i = 0; i < 30 && world.sea.voyage !== null; i++) {
        const v = world.sea.voyage;
        if (v.status === 'CHOICE') choose(world, sea, h, 'PRESS_ON');
        else if (v.status === 'HANDOFF') returnFromHandoff(world, sea, h, plainResult());
        else if (v.status === 'ANCHORED') break;
        else {
          const t0 = performance.now();
          resolveWatch(world, sea, h);
          times.push(performance.now() - t0);
        }
      }
    }
    times.sort((p, q) => p - q);
    expect(times.length).toBeGreaterThan(10);
    // The median and the 95th percentile, after the first (warming) watches.
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(2);
    expect(times[Math.floor(times.length * 0.95)]).toBeLessThan(2);
  });

  it('drains the stores by Book 10 and never below zero, saying a shortage in words', () => {
    const world = chartWorld();
    const home = world.homes['ISLE_SKARV'];
    if (home === undefined) throw new Error('no home');
    home.stores['RES_SALTED_FISH'] = 1;
    home.stores['RES_GRAIN'] = 0;
    setWind(world, 'N', 0);
    const plot = plotCourse(world, sea, 'ISLE_KALDNESS');
    if (!plot.ok) throw new Error(plot.reason);
    world.sea.plan = plot.plan;
    const events: SeaEvent[] = [];
    const h = hooks(world, events);
    depart(world, sea, h);
    const v = world.sea.voyage;
    if (v === null) throw new Error('no voyage');
    expect(storesRd(v)).toBe(1);
    expect(home.stores['RES_SALTED_FISH']).toBe(0);
    const mouths = v.aboard.length + 1;
    let before = storesRd(v);
    for (let i = 0; i < 20 && world.sea.voyage !== null; i++) {
      const at = world.sea.voyage;
      if (at.status === 'CHOICE') choose(world, sea, h, 'PRESS_ON');
      else if (at.status === 'HANDOFF') returnFromHandoff(world, sea, h, plainResult());
      else if (at.status === 'ANCHORED') break;
      else {
        const n = events.length;
        resolveWatch(world, sea, h);
        const passed = events.slice(n).find((e) => e.type === 'SEA_WATCH');
        const minutes = passed?.type === 'SEA_WATCH' ? passed.minutes : 0;
        const now = storesRd(at);
        expect(now).toBeGreaterThanOrEqual(0);
        expect(before - now).toBeCloseTo(
          Math.min(before, (mouths * sb.storesPerPersonPerWatch * minutes) / WATCH),
          9,
        );
        before = now;
      }
    }
    const short = events.filter((e) => e.type === 'SEA_STORES_SHORT');
    expect(short.length).toBeGreaterThan(0);
    expect(short[0]).toMatchObject({ textKey: 'sea.stores.short' });
    expect(content.strings.has('sea.stores.short')).toBe(true);
    expect(world.sea.voyage?.shortWatches).toBeGreaterThan(0);
  });

  it('loads Book 10 days of stores for everyone aboard, and brings the rest home', () => {
    const world = chartWorld();
    const home = world.homes['ISLE_SKARV'];
    if (home === undefined) throw new Error('no home');
    home.stores['RES_SALTED_FISH'] = 100;
    const days = sb.storesDays.get('T1 Coastal boat') ?? 0;
    const plot = plotCourse(world, sea, 'SITE_CARRICK');
    if (!plot.ok) throw new Error(plot.reason);
    world.sea.plan = plot.plan;
    const events: SeaEvent[] = [];
    const h = hooks(world, events);
    depart(world, sea, h);
    const v = world.sea.voyage;
    if (v === null) throw new Error('no voyage');
    const mouths = v.aboard.length + 1;
    expect(storesRd(v)).toBeCloseTo(days * mouths * sb.storesPerPersonPerWatch * (1440 / WATCH), 9);
    // Turned for home from Skarvholm at once: everything comes back.
    const total = (home.stores['RES_SALTED_FISH'] ?? 0) + storesRd(v);
    expect(turnBack(world, sea, h)).toBeNull();
    expect(world.sea.voyage).toBeNull();
    expect(home.stores['RES_SALTED_FISH']).toBeCloseTo(total, 9);
    expect(world.onFoot?.zone).toBe('ZONE_SK_STRAND');
  });

  it('refuses in words: unknown, here, inland, routes not known, not ready, at sea', () => {
    const world = chapterEnd();
    const r = (to: string) => {
      const p = plotCourse(world, sea, to);
      return p.ok ? 'OK' : p.reason;
    };
    expect(r('ISLE_NOWHERE')).toBe('UNKNOWN_PLACE');
    world.knowledge.places['TOWN_ARDCARN'] = 'RUMOURED';
    world.knowledge.places['TOWN_SALTVIK'] = 'RUMOURED';
    expect(r('TOWN_ARDCARN')).toBe('INLAND');
    expect(r('TOWN_SALTVIK')).toBe('NO_KNOWN_ROUTE');
    expect(r('SITE_CARRICK')).toBe('OK');
    world.knowledge.places['ISLE_SKARV'] = 'KNOWN';
    expect(r('ISLE_SKARV')).toBe('HERE');
    world.facts['ch1.launched'] = false;
    expect(r('SITE_CARRICK')).toBe('NOT_READY');
    world.facts['ch1.launched'] = true;
    const p = plotCourse(world, sea, 'SITE_CARRICK');
    if (!p.ok) throw new Error(p.reason);
    world.sea.plan = p.plan;
    depart(world, sea, hooks(world));
    expect(r('SITE_CARRICK')).toBe('AT_SEA');
    for (const word of Object.values(sea.words)) expect(content.strings.has(word), word).toBe(true);
  });

  it('discovers: a route sailed is known, a place reached is known and its routes rumoured', () => {
    const world = chapterEnd();
    setWind(world, 'NE', 2);
    const p = plotCourse(world, sea, 'SITE_CARRICK');
    if (!p.ok) throw new Error(p.reason);
    world.sea.plan = p.plan;
    const h = hooks(world);
    depart(world, sea, h);
    for (let i = 0; i < 20 && world.sea.voyage?.handoff?.landing !== true; i++) {
      const v = world.sea.voyage;
      if (v === null) break;
      if (v.status === 'CHOICE') choose(world, sea, h, 'PRESS_ON');
      else if (v.status === 'HANDOFF') returnFromHandoff(world, sea, h, plainResult());
      else resolveWatch(world, sea, h);
    }
    expect(world.knowledge.routes['SEA_SKARV_CARRICK']).toBe('KNOWN');
    expect(world.knowledge.routes['SEA_CARRICK_KILBRECC']).toBe('RUMOURED');
    expect(world.knowledge.places['SITE_CARRICK']).toBe('KNOWN');
    expect(world.knowledge.places['ABBEY_KILBRECC']).toBeDefined();
    // The Carrick landing: the raid gate started, the Stage 16 stub handed off.
    expect(world.gates['BEAT_2_RAID']?.status).toBe('STARTED');
    expect(currentHandoff(world)).toMatchObject({ scenarioId: 'SCN_CARRICK', stubUntilStage: 16 });
    // A rumoured route is not sailed until known.
    world.sea.voyage = null;
    world.knowledge.places['ABBEY_KILBRECC'] = 'RUMOURED';
    expect(plotCourse(world, sea, 'ABBEY_KILBRECC').ok).toBe(false);
  });

  it('offers the one choice when the weather rises: press on, or shelter until morning', () => {
    const world = chapterEnd();
    setWind(world, 'NE', 3);
    const p = plotCourse(world, sea, 'SITE_CARRICK');
    if (!p.ok) throw new Error(p.reason);
    world.sea.plan = p.plan;
    const events: SeaEvent[] = [];
    const h = hooks(world, events);
    depart(world, sea, h);
    resolveWatch(world, sea, h);
    const v = world.sea.voyage;
    expect(v?.status).toBe('CHOICE');
    expect(v?.choice?.options.map((o) => o.option)).toEqual(['PRESS_ON', 'SHELTER']);
    expect(resolveWatch(world, sea, h)).toBe('BUSY');
    expect(choose(world, sea, h, 'SHELTER')).toBeNull();
    expect(v?.hold?.reason).toBe('SHELTER');
    for (let i = 0; i < 6 && v?.status === 'HELD'; i++) resolveWatch(world, sea, h);
    expect(world.calendar.minuteOfDay).toBe(sb.shelterUntil);
    setWind(world, 'NE', 3);
    resolveWatch(world, sea, h);
    expect(v?.status).toBe('CHOICE');
    choose(world, sea, h, 'PRESS_ON');
    resolveWatch(world, sea, h);
    expect(v?.leg?.edge).toBe('SEA_SKARV_CARRICK');
  });

  it('hands off the wreck and takes its result back: survivors aboard, stores, facts, home', () => {
    const world = chapterEnd();
    setWind(world, 'NE', 2);
    const p = plotCourse(world, sea, 'SITE_CARRICK');
    if (!p.ok) throw new Error(p.reason);
    world.sea.plan = p.plan;
    const events: SeaEvent[] = [];
    const h = hooks(world, events);
    depart(world, sea, h);
    for (let i = 0; i < 10 && world.sea.voyage?.status !== 'HANDOFF'; i++) {
      if (world.sea.voyage?.status === 'CHOICE') choose(world, sea, h, 'PRESS_ON');
      else resolveWatch(world, sea, h);
    }
    const req = currentHandoff(world);
    expect(req).toMatchObject({
      kind: 'ON_FOOT',
      scenarioId: 'SCN_SEA_WRECK',
      edgeId: 'SEA_SKARV_CARRICK',
      placeId: null,
    });
    expect(req?.voyage.leg?.edge).toBe('SEA_SKARV_CARRICK');
    const stores = storesRd(world.sea.voyage ?? { stores: {} });
    expect(
      returnFromHandoff(world, sea, h, {
        outcome: 'TURN_BACK',
        facts: { 'sea.wreck': 'RESCUED' },
        aboardChanges: { join: ['C_TEST_SURVIVOR'], leave: [] },
        storesDelta: -1,
      }),
    ).toBeNull();
    expect(world.facts['sea.wreck']).toBe('RESCUED');
    expect(world.sea.voyage?.aboard).toContain('C_TEST_SURVIVOR');
    expect(storesRd(world.sea.voyage ?? { stores: {} })).toBeCloseTo(stores - 1, 9);
    // Turned back mid-leg: home over what was sailed.
    for (let i = 0; i < 20 && world.sea.voyage !== null; i++) {
      if (world.sea.voyage.status === 'CHOICE') choose(world, sea, h, 'PRESS_ON');
      else resolveWatch(world, sea, h);
    }
    expect(world.sea.voyage).toBeNull();
    expect(events.some((e) => e.type === 'SEA_HOME')).toBe(true);
    // The wreck happens once.
    expect(world.sea.once['ENC_OPEN:wreck']).toBeDefined();
  });

  it('reaches every edge: with the chart, every edge is sailed by some course', () => {
    const sailed = new Set<string>();
    const places = [...sea.nodes.values()].filter(
      (n) => n.kind === 'PLACE' && n.id !== 'ISLE_SKARV',
    );
    for (const to of places) {
      const world = chartWorld();
      // Summer, out of winter's reach (the Blue Men's routes close all winter).
      world.calendar = { day: 40, minuteOfDay: b.dayStart };
      world.sea.weather = { rolledTo: 0, days: {}, forecasts: {}, years: {}, calmLeft: 0 };
      ensureWeather(world, sb, sb.forecastAccuracy);
      // A calm: every leg rows at one speed, so the quickest course is the shortest by Book 10.
      setWind(world, 'N', 0);
      const p = plotCourse(world, sea, to.id);
      if (!p.ok) {
        expect(p.reason, to.id).toBe('INLAND');
        continue;
      }
      for (const l of p.plan.legs) sailed.add(l.edge);
      // And along the coast from Carrick (the coastal routes).
      world.sea.voyage = null;
    }
    // The coastal routes from Carrick and Kilbrecc: plotted from an anchorage there.
    for (const [at, to] of [
      ['SITE_CARRICK', 'FORT_DUNFIACH'],
      ['SITE_CARRICK', 'TOWN_SALTVIK'],
      ['TOWN_SALTVIK', 'CAMP_CROWWICK'],
      ['CAMP_CROWWICK', 'GLEN_ARRA'],
      ['CAMP_CROWWICK', 'ISLE_INISRON'],
    ] as const) {
      const world = chartWorld();
      world.calendar = { day: 40, minuteOfDay: b.dayStart };
      world.sea.weather = { rolledTo: 0, days: {}, forecasts: {}, years: {}, calmLeft: 0 };
      ensureWeather(world, sb, sb.forecastAccuracy);
      setWind(world, 'N', 0);
      world.sea.voyage = { ...anchoredAt(at), aboard: [...world.household.residents] } as never;
      const p = plotCourse(world, sea, to);
      if (!p.ok) throw new Error(`${at} to ${to}: ${p.reason}`);
      for (const l of p.plan.legs) sailed.add(l.edge);
    }
    expect([...sea.edges.keys()].filter((e) => !sailed.has(e))).toEqual([]);
  });
});

/** A voyage lying at anchor at a place (for plotting on from it). */
function anchoredAt(at: string): WorldState['sea']['voyage'] {
  return {
    id: 1,
    from: 'ISLE_SKARV',
    to: at,
    at,
    arrivedBy: null,
    route: [],
    leg: null,
    status: 'ANCHORED',
    hold: null,
    choice: null,
    pressed: [],
    handoff: null,
    aboard: [],
    stores: {},
    shortWatches: 0,
    shortRd: 0,
    minutes: 0,
    legs: 0,
    met: [],
    gate: null,
  };
}

describe('the weather: forecast, named storms, winter closure and calm windows', () => {
  /** Ten years of weather from a seed, with the forecast accuracy given. */
  function years(seed: string, accuracy: number, n = 10) {
    const world = readSave(JSON.parse(repoFile(GOLDEN_12))).state;
    world.rng.weather = [seed.length * 977, 13, 7, 3];
    const days = [];
    for (let day = 1; day <= 120 * n; day++) {
      world.calendar = { day, minuteOfDay: b.dayStart };
      ensureWeather(world, sb, accuracy);
      const w = world.sea.weather.days[day];
      const f = world.sea.weather.forecasts[day];
      const y = world.sea.weather.years[Math.ceil(day / 120)];
      const edge = (id: string) => {
        const e = sea.edges.get(id);
        if (e === undefined || w === undefined) throw new Error('no edge');
        return closedOn(world, e, day, w.calm);
      };
      days.push({
        w,
        f,
        closed: inWinterClosure(world.sea, day),
        y,
        open: edge('SEA_SKARV_CARRICK'),
        shut: edge('SEA_SKARV_BLUEMEN'),
        coast: edge('SEA_CARRICK_KILBRECC'),
      });
    }
    return { world, days };
  }

  it('the forecast is right four times in five (and nine in ten with the weather-vane)', () => {
    for (const [acc, label] of [
      [sb.forecastAccuracy, 'household'],
      [vaneForecast, 'weather-vane'],
    ] as const) {
      const { days } = years(`forecast-${label}`, acc);
      const plain = days.filter((d) => d.w?.named === null && !d.w.calm);
      const right = plain.filter(
        (d) => d.f?.windFrom === d.w?.windFrom && d.f?.strength === d.w?.strength,
      );
      const share = right.length / plain.length;
      expect(share, label).toBeGreaterThan(acc - 0.04);
      expect(share, label).toBeLessThan(acc + 0.04);
    }
  });

  it('the Cailleach’s washing falls once a year in days 86 to 94; the first and autumn storms on their days', () => {
    const { days } = years('storms', sb.forecastAccuracy);
    for (let year = 1; year <= 10; year++) {
      const ys = days.slice((year - 1) * 120, year * 120);
      const washing = ys.filter((d) => d.w?.named === 'CAILLEACH');
      expect(washing).toHaveLength(1);
      const doy = (((washing[0]?.w?.day ?? 0) - 1) % 120) + 1;
      expect(doy).toBeGreaterThanOrEqual(sb.weather.washing[0]);
      expect(doy).toBeLessThanOrEqual(sb.weather.washing[1]);
      expect(washing[0]?.w?.strength).toBe(4);
      const first = ys.filter((d) => d.w?.named === 'FIRST_STORM');
      expect(first).toHaveLength(1);
      const autumn = ys.filter((d) => d.w?.named === 'AUTUMN_STORM');
      expect(autumn.length).toBeGreaterThanOrEqual(sb.weather.autumnStorms.count[0]);
      expect(autumn.length).toBeLessThanOrEqual(sb.weather.autumnStorms.count[1]);
      // Named storms are always forecast.
      for (const d of [...washing, ...first, ...autumn]) expect(d.f?.storm).toBe(true);
      // Spring and summer storms only on the named day (Book 10 wind strength).
      for (const d of ys.slice(0, 60)) if (d.w?.strength === 4) expect(d.w.named).not.toBeNull();
    }
  });

  it('winter closes the open crossings from the washing except in calm windows of 1 to 3 days', () => {
    const { days } = years('winter', sb.forecastAccuracy);
    let run = 0;
    const runs: number[] = [];
    for (const d of days) {
      const w = d.w;
      if (w === undefined) continue;
      const doy = ((w.day - 1) % 120) + 1;
      expect(d.closed).toBe(doy >= (d.y?.washing ?? 999));
      if (w.calm) {
        expect(d.closed).toBe(true);
        expect(w.strength).toBeLessThanOrEqual(sb.weather.calmStrengthMax);
        run++;
      } else if (run > 0) {
        runs.push(run);
        run = 0;
      }
      expect(d.open).toBe(d.closed && !w.calm);
      expect(d.shut).toBe(d.closed);
      expect(d.coast).toBe(false);
    }
    expect(runs.length).toBeGreaterThan(5);
    // Windows run into each other only when one starts the day after another ends: each
    // window is 1 to 3 days, so a run is at least 1 and a lone window at most 3.
    expect(Math.min(...runs)).toBeGreaterThanOrEqual(sb.weather.calmWindowDays[0]);
  });

  it('a winter-closed route is refused in words outside a calm window', () => {
    const world = chapterEnd();
    world.calendar = { day: 100, minuteOfDay: b.dayStart };
    world.sea.weather = { rolledTo: 0, days: {}, forecasts: {}, years: {}, calmLeft: 0 };
    ensureWeather(world, sb, sb.forecastAccuracy);
    const day = world.sea.weather.days[100];
    if (day === undefined) throw new Error('no day');
    world.sea.weather.days[100] = { ...day, calm: false };
    const f = world.sea.weather.forecasts[101];
    if (f !== undefined) world.sea.weather.forecasts[101] = { ...f, calm: false };
    const p = plotCourse(world, sea, 'SITE_CARRICK');
    expect(p.ok ? 'OK' : p.reason).toBe('WINTER');
    expect(p.ok ? '' : p.textKey).toBe('sea.refuse.winter');
    world.sea.weather.days[100] = { ...day, calm: true, strength: 0 };
    expect(plotCourse(world, sea, 'SITE_CARRICK').ok).toBe(true);
  });

  it('draws the same weather from the same seed, whenever it is asked for', () => {
    const a = years('same', sb.forecastAccuracy, 1).days.map((d) => d.w);
    const world = readSave(JSON.parse(repoFile(GOLDEN_12))).state;
    world.rng.weather = ['same'.length * 977, 13, 7, 3];
    world.calendar = { day: 119, minuteOfDay: b.dayStart };
    ensureWeather(world, sb, sb.forecastAccuracy);
    expect(world.sea.weather.days[119]).toEqual(a[118]);
  });
});

describe('storms feed the driftwood (Book 10 afterStorm)', () => {
  it('the dawn after a storm washes up twice the season’s pieces, at sea or at home', () => {
    const camp = campContext(content);
    if (camp === null) throw new Error('no camp');
    const count = (storm: boolean): number => {
      const world = chapterEnd();
      const region = world.regions[camp.def.region];
      // Every spot picked bare.
      if (region !== undefined)
        for (const s of camp.def.sites)
          if (s.kind === 'DRIFTWOOD') region.resourceNodes[s.key] = { nextDay: 0 };
      return washUpDriftwood(world, camp, storm);
    };
    expect(count(true)).toBe(
      Math.min(2 * count(false), camp.def.sites.filter((s) => s.kind === 'DRIFTWOOD').length),
    );
    // startDay passes the storm on.
    const world = chapterEnd();
    const region = world.regions[camp.def.region];
    if (region !== undefined)
      for (const s of camp.def.sites)
        if (s.kind === 'DRIFTWOOD') region.resourceNodes[s.key] = { nextDay: 0 };
    const home = world.homes['ISLE_SKARV'];
    if (home !== undefined) home.rationDay = 0;
    const before = Object.keys(region?.resourceNodes ?? {}).length;
    startDay(world, camp, { storm: true });
    const washed = before - Object.keys(region?.resourceNodes ?? {}).length;
    expect(washed).toBe(count(true));
  });

  it('a storm day at sea doubles the next dawn’s driftwood at home (the away step)', () => {
    const camp = campContext(content);
    if (camp === null) throw new Error('no camp');
    const spots = camp.def.sites.filter((x) => x.kind === 'DRIFTWOOD');
    const washed = (strength: 0 | 1 | 2 | 3 | 4): number => {
      const sim = createSimulation(b, chapterEnd(), land);
      const s0 = sim.state;
      const day = s0.calendar.day;
      sim.submit({ type: 'SEA_PLOT', to: 'SITE_CARRICK' });
      sim.step();
      sim.submit({ type: 'SEA_DEPART' });
      sim.step();
      const w = s0.sea.weather.days[day];
      if (w !== undefined) s0.sea.weather.days[day] = { ...w, strength, named: null };
      const region = s0.regions[camp.def.region];
      if (region === undefined) throw new Error('no region');
      for (const x of spots) region.resourceNodes[x.key] = { nextDay: 0 };
      for (let i = 0; i < 12 && s0.calendar.day === day; i++) {
        const v = s0.sea.voyage;
        if (v?.status === 'HANDOFF')
          sim.submit({ type: 'SEA_HANDOFF_RETURN', result: plainResult() });
        else if (v?.status === 'CHOICE') sim.submit({ type: 'SEA_CHOOSE', option: 'PRESS_ON' });
        else sim.submit({ type: 'SEA_WATCH' });
        sim.step();
      }
      expect(s0.calendar.day).toBe(day + 1);
      return spots.length - Object.keys(region.resourceNodes).length;
    };
    const calm = washed(2);
    expect(calm).toBeGreaterThan(0);
    expect(washed(4)).toBe(Math.min(spots.length, 2 * calm));
  });
});
