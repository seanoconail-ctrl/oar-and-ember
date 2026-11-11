/**
 * Driftwood is found, not worked (the user's playtest note; decisions PT-1 to PT-4; Book 10
 * section 03, "Driftwood finds"):
 *
 * - pieces lie at Book 10's number of spots on Wreck Strand, each drawn with a frame of its sheet,
 *   on ground the sea never covers;
 * - a piece is picked up with a plain interact and a short stoop: no timing ring, no press, and its
 *   load goes into the camp's store at once, whatever the skill;
 * - each dawn the sea refills Book 10's pieces for the season at spots picked bare;
 * - the pieces picked up are kept in the world state and survive a save and a load;
 * - the numbers fit the camp's fuel: the first fire still needs wood fetched, and a dawn's pieces
 *   keep the fire in, every season.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance, SEASONS } from '../../src/content/balance.ts';
import { parseDriftwoodBalance, parseWorkBalance } from '../../src/content/homeBalance.ts';
import { heightAt } from '../../src/content/terrain/elevation.ts';
import { seasonOf } from '../../src/sim/calendar/calendar.ts';
import { readSave, writeSave } from '../../src/persist/save.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import {
  campContext,
  driftwoodLies,
  driftwoodPieces,
  FACT_AT_BROCH,
  siteUse,
  startDay,
  washUpDriftwood,
} from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { Simulation, SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadPalette, loadSheets } from '../../src/tools/art/artFiles.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { CampBot } from '../../src/tools/play/campBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const finds = parseDriftwoodBalance(balance);
const work = parseWorkBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const campOrNull = campContext(content);
if (campOrNull === null || content.camp === null) throw new Error('no camp content');
const camp = campOrNull;
const spots = camp.def.sites.filter((s) => s.kind === 'DRIFTWOOD');
const STRAND = 'ZONE_SK_STRAND';
const wood = (w: WorldState): number => w.homes[camp.def.home]?.stores['RES_DRIFTWOOD'] ?? 0;
const lying = (w: WorldState): number => driftwoodPieces(w, camp, STRAND).length;

function onStrand(
  seed: string,
  query = 'time=10:00',
): {
  sim: Simulation;
  bot: CampBot;
  events: SimEvent[];
} {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(`camp=broch&${query}`));
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  const bot = new CampBot(sim, b, land, camp);
  bot.goToZone(STRAND);
  return { sim, bot, events };
}

describe('pieces of driftwood in a variety of spots (Book 10 "Driftwood finds")', () => {
  it("lies at Book 10's number of spots on Wreck Strand, each a frame of prop_driftwood", () => {
    expect(spots.length).toBe(finds.spots);
    const sheet = loadSheets(loadPalette()).find((s) => s.name === 'prop_driftwood');
    expect(sheet).toBeDefined();
    for (const s of spots) {
      expect(s.zone, s.key).toBe(STRAND);
      const [state = ''] = (s.frame ?? '').split('/');
      expect(sheet?.anims[state], `${s.key}: ${s.frame ?? ''}`).toBeDefined();
    }
    // A variety: at both ends of the strand, and not two on one tile.
    expect(spots.some((s) => s.x < 40)).toBe(true);
    expect(spots.some((s) => s.x > 80)).toBe(true);
    expect(new Set(spots.map((s) => `${Math.floor(s.x)},${Math.floor(s.y)}`)).size).toBe(
      spots.length,
    );
  });

  it('lies on ground the sea never covers, even at the top of a spring tide', () => {
    const elevation = land.elevations.get(STRAND);
    const map = land.maps.get(STRAND);
    if (elevation === undefined || map === undefined) throw new Error('no strand');
    for (const s of spots)
      expect(heightAt(elevation, s.x * map.tile, s.y * map.tile), s.key).toBeGreaterThan(1.07);
  });

  it('lies at every spot at the first dawn, and the camp has no wood until some is fetched', () => {
    const world = newCampaign('first', b, parsePeopleBasics(balance), content);
    expect(lying(world)).toBe(finds.spots);
    expect(wood(world)).toBe(work.campFuelLoads);
    // The first fire needs fetching: Book 10 fireLight in pieces.
    expect(Math.ceil(work.fireLightLoads / finds.loadsPerPiece)).toBeGreaterThanOrEqual(2);
  });

  it("keeps the camp's fire with a dawn's pieces in every season, with some over", () => {
    for (const season of SEASONS)
      expect(finds.perDawn[season] * finds.loadsPerPiece, season).toBeGreaterThan(
        work.fuelPerDay[season],
      );
  });
});

describe('picked up with no mini-game (decisions PT-1 and PT-2)', () => {
  it('a plain interact and a short stoop: no ring, no press, the load at once', () => {
    const { sim, bot, events } = onStrand('pick');
    sim.state.player.skills['gathering'] = 4;
    const key = 'drift_east_rocks';
    bot.goToSite(key);
    const before = wood(sim.state);
    const t0 = sim.state.calendar.minuteOfDay;
    bot.interact();
    const started = events.filter((e) => e.type === 'WORK_STARTED').at(-1);
    expect(started).toMatchObject({
      task: 'TASK_GATHER_DRIFTWOOD',
      site: key,
      ticks: camp.stoopTicks,
      markTick: null,
    });
    expect(camp.stoopTicks).toBe(Math.round(finds.stoopSeconds * 60));
    // A press mid-stoop is no timing press: nothing is pressed, and it adds nothing.
    sim.submit({ type: 'WORK_PRESS' });
    bot.work('none');
    expect(events.some((e) => e.type === 'WORK_PRESSED')).toBe(false);
    const done = events.filter((e) => e.type === 'WORK_DONE').at(-1);
    expect(done).toMatchObject({
      task: 'TASK_GATHER_DRIFTWOOD',
      minutes: finds.pickUpMinutes,
      stamina: finds.pickUpStamina,
      bonus: 0,
      output: finds.loadsPerPiece,
    });
    // Its load, exactly, whatever the skill; the piece gone, and nothing to do there now.
    expect(wood(sim.state) - before).toBeCloseTo(finds.loadsPerPiece, 9);
    expect(driftwoodLies(sim.state, camp, key)).toBe(false);
    expect(lying(sim.state)).toBe(finds.spots - 1);
    const site = spots.find((s) => s.key === key);
    if (site === undefined) throw new Error(key);
    expect(siteUse(sim.state, camp, site)).toBeNull();
    expect(sim.state.calendar.minuteOfDay - t0).toBeGreaterThanOrEqual(finds.pickUpMinutes);
  });

  it('cannot be picked up during the opening (the camp work opens at the broch, S7-26)', () => {
    const world = newCampaign('opening', b, parsePeopleBasics(balance), content);
    expect(world.facts[FACT_AT_BROCH]).not.toBe(true);
    const sim = createSimulation(b, world, land);
    const events: SimEvent[] = [];
    sim.events.onAny((e) => events.push(e));
    const map = land.maps.get(STRAND);
    const piece = spots.find((s) => s.key === 'drift_east_tide');
    if (map === undefined || piece === undefined || world.onFoot === null) throw new Error('none');
    world.onFoot.player.x = piece.x * map.tile;
    world.onFoot.player.y = (piece.y + 0.6) * map.tile;
    sim.submit({ type: 'INTERACT' });
    sim.step();
    expect(events.some((e) => e.type === 'WORK_STARTED')).toBe(false);
    expect(lying(world)).toBe(finds.spots);
  });
});

describe("washed up again at dawn by Book 10's numbers", () => {
  /** A world at the broch with `n` pieces picked bare on day `day`. */
  const picked = (seed: string, n: number, day = 1): WorldState => {
    const world = newCampaign(seed, b, parsePeopleBasics(balance), content);
    world.calendar = { ...world.calendar, day };
    const nodes = world.regions[camp.def.region]?.resourceNodes;
    if (nodes === undefined) throw new Error('no region');
    for (const s of spots.slice(0, n)) nodes[s.key] = { nextDay: day + 1 };
    return world;
  };

  it.each(SEASONS)("refills the season's pieces at bare spots each dawn (%s)", (season) => {
    let start = 1;
    while (seasonOf(start) !== season || seasonOf(start + 4) !== season) start++;
    const world = picked(`wash-${season}`, finds.spots, start);
    expect(lying(world)).toBe(0);
    // Not on the day they were picked: from the next dawn.
    expect(washUpDriftwood(world, camp)).toBe(0);
    let expected = 0;
    for (let d = 1; d <= 3; d++) {
      world.calendar = { ...world.calendar, day: start + d };
      const want = Math.min(finds.perDawn[season], finds.spots - expected);
      expect(washUpDriftwood(world, camp), `${season} dawn ${d}`).toBe(want);
      expected += want;
      expect(lying(world)).toBe(expected);
    }
  });

  it('twice as many after a storm, never more than the spots picked bare', () => {
    const world = picked('storm', finds.spots);
    world.calendar = { ...world.calendar, day: 2 };
    expect(washUpDriftwood(world, camp, true)).toBe(finds.perDawn.Spring * finds.afterStorm);
    const few = picked('few', 1);
    few.calendar = { ...few.calendar, day: 2 };
    expect(washUpDriftwood(few, camp, true)).toBe(1);
    expect(lying(few)).toBe(finds.spots);
  });

  it('washes up as the day starts, once a day, deterministically', () => {
    const a = picked('dawn', 6);
    const c = picked('dawn', 6);
    for (const w of [a, c]) {
      w.calendar = { ...w.calendar, day: 2 };
      startDay(w, camp);
      startDay(w, camp);
    }
    expect(lying(a)).toBe(finds.spots - 6 + finds.perDawn.Spring);
    expect(a.regions[camp.def.region]?.resourceNodes).toEqual(
      c.regions[camp.def.region]?.resourceNodes,
    );
  });

  it('brings pieces back after a night slept at the camp', () => {
    const { sim, bot } = onStrand('night', 'time=17:00&fire=lit');
    bot.pickUp('drift_east_rocks');
    bot.pickUp('drift_east_tide');
    bot.pickUp('drift_east_shingle');
    expect(lying(sim.state)).toBe(finds.spots - 3);
    bot.goToZone(camp.def.zone);
    bot.waitUntil(b.sleepAfter + 10);
    bot.goToSite('bed_s0');
    sim.submit({ type: 'SLEEP' });
    bot.waitFor(() => sim.state.calendar.day === 2);
    expect(lying(sim.state)).toBe(finds.spots - 3 + finds.perDawn.Spring);
    // The morning report says where more lies, in a sentence.
    expect(sim.state.report?.lines.some((l) => l.key === 'report.wood.strand')).toBe(true);
  });
});

describe('picked-up pieces in the world state (decision PT-4)', () => {
  it('survive a save and a load, and play on the same', () => {
    const { sim, bot } = onStrand('saved');
    bot.pickUp('drift_east_rocks');
    bot.pickUp('drift_stern');
    const file = writeSave(sim.state, {
      build: 'test',
      kind: 'manual',
      slot: 'manual:1',
      label: 'driftwood',
      sequence: 1,
      savedAt: '2026-11-11T00:00:00.000Z',
    });
    const { state, migratedFrom } = readSave(JSON.parse(JSON.stringify(file)) as typeof file);
    expect(migratedFrom).toBeNull();
    expect(lying(state)).toBe(finds.spots - 2);
    expect(driftwoodLies(state, camp, 'drift_east_rocks')).toBe(false);
    expect(driftwoodLies(state, camp, 'drift_stern')).toBe(false);
    expect(driftwoodLies(state, camp, 'drift_east_tide')).toBe(true);
    expect(state.regions[camp.def.region]?.resourceNodes).toEqual(
      sim.state.regions[camp.def.region]?.resourceNodes,
    );
    expect(wood(state)).toBeCloseTo(2 * finds.loadsPerPiece, 9);
  });
});
