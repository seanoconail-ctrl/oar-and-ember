/**
 * The user's third playtest, the story part (decisions DG-12 to DG-14; Book 2 section 23, "The
 * shelter" and "The sea burial"; Book 10 sections 03 and 08):
 *
 * - Hild points to the broch when she is set down safe, and the aim to see it is hers;
 * - the shelter goes up over two days in three stages, Hild's line at each, with the stuck hints;
 *   the frame and the sail on day 1, the finishing not before 06:00 on day 2; the household
 *   sleeps under the sail from the first night and in the finished shelter once it is built;
 * - Thorkel's sea burial plays its three waves, the body submerges, drifts and sinks, and the scene
 *   ends with the body gone and the facts set, with control taken while it plays;
 * - world state version 13's shelter fact, from an older save's.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parseOpeningBalance } from '../../src/content/openingBalance.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { seaBurialView, SHELTER_SHEET, openingProps } from '../../src/scenes/openingView.ts';
import { activeSites, campContext, siteUse } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { findActor } from '../../src/sim/land/zoneLinks.ts';
import { journalLine } from '../../src/sim/narrative/aims.ts';
import {
  parseSeaBurialBalance,
  seaBurialActive,
  seaMoment,
  seaTimeline,
  waterEdgeBelow,
} from '../../src/sim/narrative/seaBurial.ts';
import { bedOf, jobToday } from '../../src/sim/people/schedule.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import { migrateShelter13 } from '../../src/persist/openingMigration.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';
import { OpeningBot } from '../../src/tools/play/openingBot.ts';
import { RepairBot } from '../../src/tools/play/repairBot.ts';
import { WreckBot } from '../../src/tools/play/wreckBot.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const ob = parseOpeningBalance(balance);
const sea = parseSeaBurialBalance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const campOrNull = campContext(content);
if (campOrNull === null || land.wreck == null || land.aims == null || land.people == null)
  throw new Error('no content');
const camp = campOrNull;
const wreck = land.wreck;
const aims = land.aims;
const people = land.people;
const machair = land.maps.get('ZONE_SK_MACHAIR');
const strand = land.maps.get('ZONE_SK_STRAND');
if (machair === undefined || strand === undefined || land.searches == null || land.repairs == null)
  throw new Error('no maps');
const searches = land.searches;
const repairs = land.repairs;
const T = 60;

function start(seed: string, hooks?: string) {
  const world = newCampaign(seed, b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  if (hooks !== undefined) campHooks(world, content, land, new URLSearchParams(hooks));
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  return { sim, events, world: sim.state };
}
const said = (events: SimEvent[]) =>
  events.flatMap((e) =>
    e.type === 'PERSON_SPOKE' || e.type === 'PERSON_CALLED' ? [e.lineKey] : [],
  );
const hints = (events: SimEvent[]) =>
  events.flatMap((e) => (e.type === 'AIM_HINT' ? [`${e.aim}.${e.hint}`] : []));

describe('Book 10’s numbers for the story (sections 03 and 08)', () => {
  it('reads the shelter’s stages and the sea burial’s timings as the book writes them', () => {
    expect(ob.camp.shelterFrame).toEqual({ seconds: 5, minutes: 15, stamina: 1 });
    expect(ob.camp.shelterSail).toEqual({ seconds: 5, minutes: 15, stamina: 1 });
    // The two day-1 stages keep shelterRaise's 30 game minutes and 2 stamina (DG-12).
    expect(ob.camp.shelterFrame.minutes + ob.camp.shelterSail.minutes).toBe(30);
    expect(ob.camp.shelterFinishFrom).toEqual({ day: 2, minute: 6 * 60 });
    expect(ob.camp.shelterHildTiles).toBe(10);
    // The finishing is the Buildings row's 1 worker-day (8 game hours).
    expect(camp.shelterWorkerDays).toBe(1);
    expect(wreck.shelterNeedMinutes).toBe(480);
    expect(sea.bierSeconds).toBe(4);
    expect(sea.waves).toBe(3);
    expect(sea.waveEverySeconds).toBe(2.6);
    expect(sea.firstWaveSeconds).toBe(1.5);
    expect(sea.underSeconds).toBe(1.2);
    expect([sea.backwashTiles, sea.backwashSeconds]).toEqual([3, 2.5]);
    expect([sea.driftTiles, sea.driftSeconds]).toEqual([6, 4]);
    expect(sea.turnDegrees).toEqual([30, 60]);
    expect([sea.lowerPx, sea.lowerEverySeconds]).toEqual([1, 0.5]);
    expect([sea.sinkSeconds, sea.ringSeconds]).toEqual([2, 1.5]);
    expect([sea.lineAfterSeconds, sea.controlAfterSeconds]).toEqual([1.5, 2]);
    expect(sea.cameraTiles).toBe(3);
    const tl = seaTimeline(sea);
    expect(tl.waves.map((w) => Math.round((w - tl.set) * 10) / 10)).toEqual([1.5, 4.1, 6.7]);
    // From the bier set down to control: Book 10's own steps add to 18.7 s ("about 17").
    expect(Math.round((tl.control - tl.set) * 10) / 10).toBe(18.7);
    expect(Math.abs(tl.control - tl.set - sea.aboutSeconds)).toBeLessThan(2);
  });
});

describe('Hild points to the broch (DG-13)', () => {
  it('set down safe, after her first line she says the old tower is up on the bank, north', () => {
    const { sim, events, world } = start('broch');
    const opening = new OpeningBot(sim, strand, b, land);
    opening.pickUp('wreck_seax');
    opening.rescue('C_HILD');
    expect(world.facts['ch1.hild_safe']).toBe(true);
    const bot = new WreckBot(sim, b, land, camp, searches, repairs);
    bot.waitFor(() => world.facts['ch1.chest_named'] === true, 60 * 30);
    const lines = said(events);
    const safe = lines.indexOf(content.opening?.safeLine ?? '');
    const broch = lines.indexOf('c_hild.open.broch');
    const chest = lines.indexOf('c_hild.chest.first');
    expect(safe).toBeGreaterThanOrEqual(0);
    expect(broch).toBeGreaterThan(safe);
    expect(chest).toBeGreaterThan(broch);
    // The aim to see the tower is hers, before the chest's, and done on reaching the broch.
    expect(world.aims?.current).toBe('see_tower');
    expect(journalLine(world, aims)).toBe('ui.journal.aim.see_tower');
    bot.chestToCamp();
    expect(world.facts['ch1.at_broch']).toBe(true);
    bot.step(2);
    expect(world.aims?.current).not.toBe('see_tower');
  });
});

describe('the shelter in three stages over two days (DG-12)', () => {
  it('the frame and the sail on day 1 with Hild’s word at each; the finishing from 06:00 on day 2', () => {
    const { sim, events, world } = start('shelter');
    const opening = new OpeningBot(sim, strand, b, land);
    opening.pickUp('wreck_seax');
    opening.rescue('C_HILD');
    const bot = new WreckBot(sim, b, land, camp, searches, repairs);
    bot.waitFor(() => world.facts['ch1.chest_named'] === true, 60 * 30);
    bot.chestToCamp();
    expect(world.facts['ch1.shelter']).toBe('FOLDED');
    // Folded, the sail and three oars lie at its place; nothing else of the shelter is drawn.
    const s0 = camp.def.props.S0;
    expect(
      openingProps(world, wreck, machair, s0, world.tick).some(
        (p) => p.sheet === SHELTER_SHEET && p.frame === 'folded/-/0',
      ),
    ).toBe(true);
    bot.goToZone('ZONE_SK_STRAND');
    bot.firstFire(['drift_west_rocks', 'drift_west_bank']);
    bot.waitForHild();
    // Her walk-up's aim, then the first step a moment after (two lines never in one frame).
    bot.step(Math.round(wreck.rw.camp.nextLineSeconds * T) + 2);
    let lines = said(events);
    expect(lines.indexOf('c_hild.camp.frame')).toBeGreaterThan(
      lines.indexOf('c_hild.camp.walk_up'),
    );
    expect(world.aims?.current).toBe('shelter_frame');
    // The frame: one hands-on action of Book 10's seconds, its frames drawn going up, Hild
    // steadying the oars beside it.
    const frames = new Set<string>();
    let steadied = false;
    const day = world.calendar.day;
    const minute0 = world.calendar.minuteOfDay;
    // The marked spot where the frame and the sail are worked (the user's fourth playtest, DH-10).
    const site = wreck.camp?.mark ?? { x: 0, y: 0 };
    const tile = { tx: Math.floor(site.x), ty: Math.floor(site.y) };
    bot.walkTo((t) => Math.abs(t.tx - tile.tx) + Math.abs(t.ty - tile.ty) <= 1);
    sim.submit({ type: 'INTERACT_AT', tile });
    for (let i = 0; i < ob.camp.shelterFrame.seconds * T + 10; i++) {
      sim.step();
      for (const p of openingProps(world, wreck, machair, s0, world.tick))
        frames.add(`${p.sheet}:${p.frame.split('/')[0] ?? ''}`);
      if (world.onFoot?.actors['C_HILD']?.pose === 'work') steadied = true;
    }
    expect(world.facts['ch1.shelter']).toBe('FRAME');
    expect(frames).toContain(`${SHELTER_SHEET}:raise`);
    // Hild steadies the oars beside the steerer while the frame goes up.
    expect(steadied).toBe(true);
    expect(world.calendar.minuteOfDay - minute0).toBeGreaterThanOrEqual(
      ob.camp.shelterFrame.minutes,
    );
    lines = said(events);
    expect(lines).toContain('c_hild.camp.sail');
    expect(world.aims?.current).toBe('shelter_sail');
    expect(
      openingProps(world, wreck, machair, s0, world.tick).some((p) => p.frame.startsWith('frame/')),
    ).toBe(true);
    // The sail: drawn hauled over the ridge frame by frame, then the lean-to.
    sim.submit({ type: 'INTERACT_AT', tile });
    for (let i = 0; i < ob.camp.shelterSail.seconds * T + 70; i++) {
      sim.step();
      for (const p of openingProps(world, wreck, machair, s0, world.tick))
        frames.add(`${p.sheet}:${p.frame.split('/')[0] ?? ''}`);
    }
    expect(world.facts['ch1.shelter']).toBe('SAIL');
    expect(frames).toContain(`${SHELTER_SHEET}:haul`);
    expect(frames).toContain('prop_sail_raise:fill');
    // Her word on the lean-to, and the night's a moment after.
    bot.step(Math.round(wreck.rw.camp.nextLineSeconds * T) + 2);
    lines = said(events);
    expect(lines.indexOf('c_hild.camp.shelter_night')).toBeGreaterThan(
      lines.indexOf('c_hild.camp.shelter_up'),
    );
    expect(world.calendar.day).toBe(day);
    // Day 1: the finishing is not open, and no one builds.
    const shelterSite = activeSites(world, camp, 'ZONE_SK_MACHAIR').find((s) => s.kind === 'BUILD');
    if (shelterSite === undefined) throw new Error('no shelter site');
    expect(siteUse(world, camp, shelterSite)).toBeNull();
    const hild = world.people['C_HILD'];
    if (hild === undefined) throw new Error('no Hild');
    expect(jobToday(world, camp, people, hild)).not.toBe('BUILDER');
    // The first night: Hild sleeps under the lean-to.
    expect(bedOf(world, camp, people, 'C_HILD')).toEqual(
      expect.objectContaining({ zone: 'ZONE_SK_MACHAIR' }),
    );
    const leanBeds = camp.def.shelterBeds ?? [];
    const bed = bedOf(world, camp, people, 'C_HILD');
    expect(leanBeds.some((l) => l.x === bed.x && l.y === bed.y)).toBe(true);
    // Through the night to 06:00 on day 2 (by the clock, as a sleep does).
    world.calendar = { day: 2, minuteOfDay: 6 * 60 };
    expect(siteUse(world, camp, shelterSite)).toEqual(
      expect.objectContaining({ kind: 'TASK', task: 'TASK_BUILD' }),
    );
    // Hild works the finishing as her day's job, once the stores hold the day's food; short, she
    // fishes first (no one goes hungry for the shelter: DG-56).
    const h0 = world.homes['ISLE_SKARV'];
    if (h0 === undefined) throw new Error('no home');
    const stores = h0.stores;
    stores['RES_SALTED_FISH'] = 0;
    // The meal-sack is food too (a reason for the first raid, DH-131): empty it as well.
    stores['RES_GRAIN'] = 0;
    h0.fresh = [];
    expect(jobToday(world, camp, people, hild)).toBe('FISHER');
    stores['RES_SALTED_FISH'] = 10;
    expect(jobToday(world, camp, people, hild)).toBe('BUILDER');
    // Her word on the second morning, near the steerer at the camp.
    const p = world.onFoot?.player;
    const h = world.onFoot?.actors['C_HILD'];
    if (p === undefined || h === undefined) throw new Error('no one');
    h.x = p.x + 30;
    h.y = p.y;
    h.pose = 'idle';
    bot.step(2);
    expect(said(events)).toContain('c_hild.camp.finish');
    expect(world.facts['ch1.shelter_finish_said']).toBe(true);
    // The steerer's Build actions add to it; it finishes at Book 10's worker-day, the S1 shelter.
    for (let k = 0; k < 40 && world.facts['ch1.shelter'] === 'SAIL'; k++)
      bot.doAt('shelter', 'none');
    expect(world.facts['ch1.shelter']).toBe('FINISHED');
    expect(world.homes['ISLE_SKARV']?.stage).toBe('S1');
    expect(world.calendar.day).toBe(2);
    const done = events.some((e) => e.type === 'WRECK' && e.what === 'SHELTER_FINISHED');
    expect(done).toBe(true);
    const owed = world.people['C_HILD']?.life.owed ?? [];
    expect([...said(events), ...owed]).toContain('c_hild.camp.finished');
    // Under the finished shelter: the S1 beds.
    const s1 = bedOf(world, camp, people, 'C_HILD');
    expect(leanBeds.some((l) => l.x === s1.x && l.y === s1.y)).toBe(false);
  });

  it('gives each stage’s hints when the player stalls (Book 10 stuckFirst and stuckSecond)', () => {
    const { sim, events, world } = start('shelter-hints', 'camp=broch&fire=lit&shelter=down');
    const home = world.homes['ISLE_SKARV'];
    if (home !== undefined) home.placed = ['ITEM_THORKEL_CHEST'];
    // Hild by the fire and the steerer beside her, doing nothing.
    const h = world.onFoot?.actors['C_HILD'];
    const p = world.onFoot?.player;
    if (h === undefined || p === undefined) throw new Error('no one');
    p.x = h.x + 30;
    p.y = h.y;
    const g = ob.guidance;
    for (let i = 0; i < (g.stuckFirstSeconds + g.stuckSecondSeconds + 2) * T; i++) sim.step();
    expect(hints(events)).toEqual(['shelter_frame.0', 'shelter_frame.1']);
    expect(said(events)).toEqual(
      expect.arrayContaining(['c_hild.hint.shelter_frame.1', 'c_hild.hint.shelter_frame.2']),
    );
    // The frame up: the sail's hints.
    world.facts['ch1.shelter'] = 'FRAME';
    for (let i = 0; i < (g.stuckFirstSeconds + g.stuckSecondSeconds + 2) * T; i++) sim.step();
    expect(hints(events)).toContain('shelter_sail.0');
    expect(hints(events)).toContain('shelter_sail.1');
    expect(said(events)).toEqual(
      expect.arrayContaining(['c_hild.hint.shelter_sail.1', 'c_hild.hint.shelter_sail.2']),
    );
  });

  it('gives the finishing’s hints once it is the aim on day 2', () => {
    const { sim, events, world } = start(
      'finish-hints',
      'camp=broch&fire=lit&tended=1&day=2&time=06:00&crew=1',
    );
    for (const f of [
      'ch1.chest_opened',
      'ch1.mast_stores',
      'ch1.dusk_over',
      'search.oddi',
      'search.bran',
      'search.runa',
    ])
      world.facts[f] = f === 'ch1.mast_stores' ? 'CAMP' : true;
    world.facts['ch1.shelter_finish_said'] = true;
    const home = world.homes['ISLE_SKARV'];
    if (home !== undefined) home.placed = ['ITEM_THORKEL_CHEST'];
    for (const id of ['C_ODDI', 'C_BRAN', 'C_RUNA']) delete world.onFoot?.actors[id];
    world.household.residents = ['C_HILD'];
    const h = world.onFoot?.actors['C_HILD'];
    const p = world.onFoot?.player;
    if (h === undefined || p === undefined) throw new Error('no one');
    sim.step();
    expect(world.aims?.current).toBe('shelter_finish');
    const g = ob.guidance;
    for (
      let i = 0;
      i < (g.stuckFirstSeconds + g.stuckSecondSeconds + 30) * T && hints(events).length < 2;
      i++
    ) {
      const hh = world.onFoot?.actors['C_HILD'];
      if (hh !== undefined) {
        p.x = hh.x + 24;
        p.y = hh.y;
      }
      sim.step();
    }
    expect(hints(events)).toEqual(['shelter_finish.0', 'shelter_finish.1']);
  });
});

describe('the shelter finished on day 2 by the household (DG-90)', () => {
  /** Day 2 at 07:00, the lean-to up, the four rescued at home at their own jobs. */
  function secondMorning(seed: string) {
    const s = start(seed, 'camp=broch&fire=lit&tended=1&day=2&time=07:00&crew=1');
    const { world } = s;
    world.facts['ch1.shelter'] = 'SAIL';
    delete world.facts['ch1.mast_stores'];
    world.household.residents = ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA'];
    for (const id of world.household.residents) {
      const p = world.people[id];
      const own = people.household.people[id]?.job;
      if (p !== undefined && own !== undefined) p.job = { kind: own, since: 1, byOrder: false };
    }
    const home = world.homes['ISLE_SKARV'];
    if (home === undefined) throw new Error('no home');
    home.stage = 'S0';
    home.fresh = [];
    return { ...s, home };
  }
  const job = (world: ReturnType<typeof secondMorning>['world'], id: string) => {
    const p = world.people[id];
    if (p === undefined) throw new Error(`no ${id}`);
    return jobToday(world, camp, people, p);
  };

  it('Hild reckons the ship’s stores on the mast towards tomorrow’s food, and fishes with nothing in the stores', () => {
    const { world, home } = secondMorning('reckon');
    expect(camp.mastStoresRd).toBe(ob.camp.mastStoresRd);
    const mouths = 1 + world.household.residents.length;
    // One ration-day in the stores and the mast's still lashed: tomorrow is reckoned fed.
    home.stores['RES_SALTED_FISH'] = mouths - camp.mastStoresRd;
    expect(job(world, 'C_HILD')).toBe('BUILDER');
    // A ration short of it, she fishes first (DG-56).
    home.stores['RES_SALTED_FISH'] = mouths - camp.mastStoresRd - 1;
    expect(job(world, 'C_HILD')).toBe('FISHER');
    // Brought up, the stores count once, in the stores.
    world.facts['ch1.mast_stores'] = 'CAMP';
    home.stores['RES_SALTED_FISH'] = mouths - camp.mastStoresRd;
    expect(job(world, 'C_HILD')).toBe('FISHER');
    home.stores['RES_SALTED_FISH'] = mouths;
    expect(job(world, 'C_HILD')).toBe('BUILDER');
    // Nothing in the stores for the evening meal: she fishes, whatever is on the mast.
    delete world.facts['ch1.mast_stores'];
    home.stores['RES_SALTED_FISH'] = 0;
    expect(job(world, 'C_HILD')).toBe('FISHER');
  });

  it('everyone home joins the finishing as they come, and goes back to their own work once it is done', () => {
    const { world, home } = secondMorning('join');
    home.stores['RES_SALTED_FISH'] = 10;
    for (const id of ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA'])
      expect(job(world, id), id).toBe('BUILDER');
    // Not on day 1, and not once it is the S1 shelter.
    world.calendar = { day: 1, minuteOfDay: 15 * 60 };
    expect(job(world, 'C_ODDI')).toBe('CAMP');
    world.calendar = { day: 2, minuteOfDay: 15 * 60 };
    world.facts['ch1.shelter'] = 'FINISHED';
    home.stage = 'S1';
    expect(job(world, 'C_ODDI')).toBe('CAMP');
    expect(job(world, 'C_BRAN')).toBe('CAMP');
    expect(job(world, 'C_HILD')).toBe('FISHER');
    expect(job(world, 'C_RUNA')).not.toBe('BUILDER');
  });
});

describe('Thorkel taken by the sea (DG-14)', () => {
  it('the waves wash round, over and lift the bier; it drifts, sinks and is gone, control returned', () => {
    const { sim, world, events } = start('sea-taken', 'camp=broch&crew=1&time=17:45');
    world.player.hotbar.slots[0] = 'ITEM_SEAX';
    const bot = new RepairBot(sim, b, land, camp, searches, repairs);
    sim.step();
    // Hild asks at the bier, the sea is chosen, and the steerer comes to the place.
    const seen: { t: number; mask: number; phase: string; y: number }[] = [];
    let begun = -1;
    sim.events.onAny((e) => {
      if (e.type === 'SEA_TAKEN' && e.what === 'BIER') begun = world.tick;
    });
    let lastX = 0;
    let lastY = 0;
    let refused = true;
    sim.events.onAny(() => undefined);
    const stepWatch = (): void => {
      const v = seaBurialView(world, wreck, strand, world.tick / T);
      if (v !== null && v.phase !== 'LAID')
        seen.push({ t: v.t, mask: v.mask, phase: v.phase, y: v.y });
      // After the carry down (the scene walks the steerer down with the household), held still.
      if (seaBurialActive(world) && v !== null && v.phase !== 'BIER') {
        const p = world.onFoot?.player;
        if (p !== undefined) {
          if (lastX !== 0 && (Math.abs(p.x - lastX) > 0.01 || Math.abs(p.y - lastY) > 0.01))
            refused = false;
          lastX = p.x;
          lastY = p.y;
          sim.submit({ type: 'MOVE', x: 1, y: 0, run: false, sneak: false });
        }
      }
    };
    sim.events.onAny((e) => {
      if (e.type === 'SEA_TAKEN') stepWatch();
    });
    const origStep = bot.step.bind(bot);
    bot.step = (n) => {
      for (let i = 0; i < (n ?? 1); i++) {
        origStep(1);
        stepWatch();
      }
    };
    bot.rites('SEA');
    expect(begun).toBeGreaterThan(0);
    // The marks in Book 10's order and at its times (seconds after the bier is lifted).
    const marks = events.flatMap((e) => (e.type === 'SEA_TAKEN' ? [`${e.what}${e.n ?? ''}`] : []));
    expect(marks).toEqual([
      'BIER',
      'SET',
      'WAVE1',
      'WAVE2',
      'WAVE3',
      'LIFT',
      'SINK',
      'SUNK',
      'DONE',
    ]);
    // Hild's last word once the ring of foam fades.
    expect(said(events)).toContain('c_hild.rites.sea_taken');
    // The body went under the second wave's foam, rode out and lower, and was wholly masked for
    // at least Book 10's seaSink before it was taken out of the world.
    const under = seen.filter((s) => s.phase === 'WAVES' && s.mask >= 10);
    expect(under.length).toBeGreaterThan(0);
    const out = Math.max(...seen.map((s) => s.y)) - Math.min(...seen.map((s) => s.y));
    expect(out / 24).toBeGreaterThan(sea.driftTiles - 0.5);
    const full = seen.filter((s) => s.mask >= 26).map((s) => s.t);
    expect(Math.max(...full) - Math.min(...full)).toBeGreaterThanOrEqual(sea.sinkSeconds);
    // Control was taken: once at the water's edge the steerer did not move, the keys held.
    expect(refused).toBe(true);
    // The scene ended with the body gone and the facts set.
    expect(seaBurialActive(world)).toBe(false);
    const onFoot = world.onFoot;
    if (onFoot === null) throw new Error('not on foot');
    expect(findActor(onFoot, 'C_THORKEL')).toBeNull();
    expect(world.facts['ch1.rites']).toBe('SEA_BURIAL');
    expect(world.facts['ch1.thorkel_ring']).toBe('RAN');
    expect(world.facts['rites.stage']).toBe('DONE');
    expect(events).toContainEqual({ type: 'RITES_DONE', form: 'SEA' });
  });

  it('sets the bier at the water’s edge wherever the tide stands', () => {
    const wet = (y0: number) => (_x: number, y: number) => y >= y0;
    const edge = waterEdgeBelow(33, 35.6, wet(38));
    expect(edge.x).toBe(33);
    expect(Math.abs(edge.y - 38)).toBeLessThanOrEqual(0.25);
    // Already awash at the place: back up the shingle to the last wet ground.
    expect(Math.abs(waterEdgeBelow(33, 35.6, wet(34)).y - 34)).toBeLessThanOrEqual(0.25);
    const m0 = seaMoment(sea, 0);
    expect(m0.phase).toBe('BIER');
    const tl = seaTimeline(sea);
    expect(seaMoment(sea, tl.waves[1] ?? 0).underFoam).toBe(true);
    expect(seaMoment(sea, (tl.waves[1] ?? 0) + sea.underSeconds + 0.01).underFoam).toBe(false);
    expect(seaMoment(sea, tl.drift).out).toBeCloseTo(sea.backwashTiles);
    expect(seaMoment(sea, tl.sink).out).toBeCloseTo(sea.driftTiles);
    expect(seaMoment(sea, tl.sink).lowerPx).toBe(8);
    expect(seaMoment(sea, tl.sunk).sink).toBe(1);
  });
});

describe('world state version 13: the shelter’s stage (DG-23)', () => {
  it('maps a raised lean-to to SAIL, at S1 to FINISHED, and one not raised to FOLDED', () => {
    const up = (raised: boolean, stage: string) =>
      migrateShelter13({
        facts: { 'ch1.shelter_raised': raised, 'ch1.shelter_raised_at': 7 },
        homes: { ISLE_SKARV: { stage } },
      })['facts'] as Record<string, unknown>;
    expect(up(true, 'S0')['ch1.shelter']).toBe('SAIL');
    expect(up(true, 'S1')['ch1.shelter']).toBe('FINISHED');
    expect(up(false, 'S0')['ch1.shelter']).toBe('FOLDED');
    expect(up(true, 'S0')['ch1.shelter_raised']).toBeUndefined();
    expect(up(true, 'S0')['ch1.shelter_at']).toBe(7);
    // A world from before the opening's rework keeps no shelter fact (drawn up as before).
    expect(migrateShelter13({ facts: {} })).toEqual({ facts: {} });
  });
});
