/**
 * Stage 14 acceptance check 2: each of Skarvholm's puzzles has an in-world hint and a solved fact,
 * and the scenario runner can solve it: a simulation driven only by commands (moving, Interact,
 * holding a heavy object, the developer's skip and teleport, as the input layer and the developer
 * menu send them) and by the calendar, from the camp to each solved fact (Book 2 section 10,
 * PuzzleDef; Book 9 sections 03, 09 and 16; decisions S14-8 to S14-12, S14-18, S14-22 and S14-26).
 *
 * A puzzle whose scenes are not built yet is listed in its test's name and skipped, so the file
 * covers it as soon as its scene appears. The deep passage's flood order (S14-9), the drowned's
 * order and the side aims are tested without a scene as well.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { tideAt } from '../../src/sim/calendar/calendar.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { holds, passageWater, puzzleState } from '../../src/sim/land/islandConditions.ts';
import { sideAimsMinute } from '../../src/sim/narrative/sideAims.ts';
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
const built = (zones: readonly string[]): boolean => zones.every((z) => land.maps.has(z));
const missing = (zones: readonly string[]): string => {
  const m = zones.filter((z) => !land.maps.has(z));
  return m.length === 0 ? '' : ` [waits for ${m.join(', ')}]`;
};
const puzzle = (id: string) => {
  const p = island.puzzles.puzzles.find((x) => x.id === id);
  if (p === undefined) throw new Error(id);
  return p;
};

interface Run {
  readonly sim: Simulation;
  readonly events: SimEvent[];
  readonly send: (c: Command, steps?: number) => void;
}

function start(query: string): Run {
  const world = newCampaign('puzzles', b, parsePeopleBasics(balance), content, { name: 'Ash', bodyModel: 'A' });
  const sim = createSimulation(b, world, land);
  campHooks(sim.state, content, land, new URLSearchParams(`camp=broch&crew=1&${query}`));
  sim.state.player.hotbar.slots = ['ITEM_SEAX', 'ITEM_SPADE'];
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  const send = (c: Command, steps = 1): void => {
    sim.submit(c);
    for (let i = 0; i < steps; i++) sim.step();
  };
  return { sim, events, send };
}

const hhmm = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** The first day from `from` and minute of it with a (spring) low water, inside the window. */
function lowWater(from: number, spring: boolean): { day: number; minute: number } {
  for (let day = from; day < from + 120; day++)
    for (let m = 0; m < 1200; m += 10) {
      const minute = (b.dayStart + m) % 1440;
      const t = tideAt({ day, minuteOfDay: minute }, b);
      if (t.tidalGroundOpen && t.minutesSinceLowWater < 40 && t.springTide === spring) return { day, minute };
    }
  throw new Error('no low water');
}

const tp = (x: number, y: number): Command => ({ type: 'DEV_TELEPORT', tile: { tx: Math.floor(x), ty: Math.floor(y) }, within: 2 });

describe("Skarvholm's puzzles: a hint and a solved fact each (Book 3 Stage 14, check 2)", () => {
  it('gives every puzzle an in-world hint that exists and a solved fact', () => {
    const keys = new Set(island.collectibles.map((c) => c.key));
    for (const p of island.puzzles.puzzles) {
      expect(p.hints.length, p.id).toBeGreaterThan(0);
      expect(p.solvedFact, p.id).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
      // Some transition writes the solved fact.
      expect(p.transitions.some((t) => t.effects.some((e) => 'set' in e && e.set === p.solvedFact)) ||
        p.transitions.some((t) => t.when.some((c) => 'fact' in c && c.fact === p.solvedFact)) ||
        island.puzzles.uses.some((u) => u.effects.some((e) => 'set' in e && e.set === p.solvedFact)), p.id).toBe(true);
      for (const h of p.hints) {
        if (h.kind === 'COLLECTIBLE') expect(keys.has(h.ref), `${p.id} ${h.ref}`).toBe(true);
        if (h.kind === 'LINE') expect(content.strings.has(h.ref), `${p.id} ${h.ref}`).toBe(true);
        if (h.kind === 'SIGN') expect(content.audio?.cues.some((c) => c.id === h.ref) === true || content.strings.has(h.ref), `${p.id} ${h.ref}`).toBe(true);
      }
    }
  });

  it('gives every scene of the island a secret or small puzzle (check 4)', () => {
    for (const zone of [...land.maps.keys()].filter((z) => z.startsWith('ZONE_SK_')))
      expect(island.puzzles.secrets[zone]?.length ?? 0, zone).toBeGreaterThan(0);
    for (const zone of ['ZONE_SK_GEO', 'ZONE_SK_CLIFFS', 'ZONE_SK_ROOK', 'ZONE_SK_BOG', 'ZONE_SK_NAUST', 'ZONE_SK_SKERRY', 'ZONE_SK_SEALCAVE_DEEP', 'ZONE_SK_CAIRN_IN'])
      expect(island.puzzles.secrets[zone]?.length ?? 0, zone).toBeGreaterThan(0);
  });
});

describe('the scenario runner solves each puzzle', () => {
  const niche = puzzle('PUZ_HERMIT_NICHE');
  it.skipIf(!built(niche.scenes))(`the hermit's niche: read the cross, pull the proud stone, take the page and the clue to Brecc${missing(niche.scenes)}`, () => {
    const cross = island.collectibles.find((c) => c.key === 'geo_cross');
    const page = island.collectibles.find((c) => c.key === 'geo_page_niche');
    if (cross === undefined || page === undefined) throw new Error('no cross');
    const r = start(`zone=ZONE_SK_GEO&at=${cross.pos.x},${(cross.pos.y + 0.6).toFixed(2)}&time=10:00`);
    // Before the cross is read the stone is ordinary wall: nothing moves it.
    expect(puzzleState(r.sim.state, island, niche.id)).toBe('SEALED');
    r.send({ type: 'INTERACT' }, 2);
    expect(r.sim.state.facts['geo.cross.read']).toBe(true);
    expect(puzzleState(r.sim.state, island, niche.id)).toBe('READ');
    // Pull the stone one tile east, out of the wall: stand east of it, hold Interact, step back.
    const map = land.maps.get('ZONE_SK_GEO');
    const mark = (map as unknown as { traverse?: { pushes?: { id: string; line: [number, number][] }[] } }).traverse?.pushes?.find((p) => p.id === 'geo.niche');
    if (mark === undefined || map === undefined) throw new Error('no niche mark');
    const [from, to] = mark.line;
    if (from === undefined || to === undefined) throw new Error('short line');
    const p = r.sim.state.onFoot?.player;
    if (p === undefined) throw new Error('not on foot');
    p.x = (to[0] + 0.5) * map.tile;
    p.y = (to[1] + 0.75) * map.tile;
    p.facing = 'w';
    r.send({ type: 'INTERACT' }, 2);
    r.send({ type: 'MOVE', x: Math.sign(to[0] - from[0]), y: Math.sign(to[1] - from[1]), run: false, sneak: false }, 120);
    r.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 2);
    r.send({ type: 'GRIP', on: false }, 2);
    expect(r.sim.state.facts['geo.niche.open']).toBe(true);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'PUZZLE_SOLVED', puzzle: niche.id }));
    // The page in the niche: taken, its margin note the clue to Brecc.
    r.send(tp(page.pos.x, page.pos.y + 0.6), 1);
    r.send({ type: 'INTERACT' }, 2);
    expect(r.sim.state.regions['REG_SK']?.collected).toContain('geo_page_niche');
    expect(content.strings.get(page.journalKey)?.text).toContain('Brecc said it was for his brother');
  });

  const skerry = puzzle('PUZ_SKERRY');
  it.skipIf(!built(skerry.scenes))(`the Skerry of the Drowned: out along the causeway at a spring low; one of the drowned each spring tides, in order${missing(skerry.scenes)}`, () => {
    const spot = island.collectibles.find((c) => c.kind === 'NAME_OF_THE_DEAD');
    if (spot === undefined) throw new Error('no drowned');
    const at = `zone=ZONE_SK_SKERRY&at=${spot.pos.x},${(spot.pos.y + 0.6).toFixed(2)}`;
    // Not at an ordinary low water: the causeway stays awash, and none comes forward.
    const plain = lowWater(4, false);
    const r0 = start(`${at}&day=${plain.day}&time=${hhmm(plain.minute)}`);
    r0.send({ type: 'INTERACT' }, 2);
    expect(r0.sim.state.facts['skerry.drowned.met']).toBeUndefined();
    const met: string[] = [];
    let from = 1;
    for (let k = 0; k < 4; k++) {
      const w = lowWater(from, true);
      const r = start(`${at}&day=${w.day}&time=${hhmm(w.minute)}`);
      // Carry on the earlier spring tides' meetings.
      for (const [i, key] of met.entries()) {
        r.sim.state.facts[`skerry.drowned.${key}`] = 1;
        r.sim.state.facts['skerry.drowned.count'] = i + 1;
        r.sim.state.facts['skerry.drowned.period'] = 'earlier';
        (r.sim.state.regions['REG_SK'] ??= { discoveredZones: [], resourceNodes: {}, puzzles: {} }).collected = met.map((m) => `skerry_name_${m}`);
      }
      r.send({ type: 'INTERACT' }, 2);
      const lines = r.events.filter((e) => e.type === 'ISLAND_SPOKE').map((e) => (e as { lineKey: string }).lineKey);
      const who = island.puzzles.drowned.order[k];
      expect(lines, `spring tides ${k + 1}`).toEqual(who?.lines);
      met.push(who?.key ?? '');
      // One each spring tides: a second word the same day gets nothing more.
      r.send({ type: 'INTERACT' }, 2);
      expect(r.events.filter((e) => e.type === 'ISLAND_SPOKE')).toHaveLength(2);
      from = w.day + 4;
    }
    expect(met).toEqual(['sigrid', 'cellach', 'gunnar', 'bergljot']);
    // Donngal waits for the wreck on Sgeir Dhubh to have been met.
    const w = lowWater(from, true);
    const r = start(`${at}&day=${w.day}&time=${hhmm(w.minute)}`);
    r.sim.state.facts['skerry.drowned.count'] = 4;
    r.send({ type: 'INTERACT' }, 2);
    expect(r.events.filter((e) => e.type === 'ISLAND_SPOKE')).toHaveLength(0);
    r.sim.state.facts['sea.wreck.met'] = 1;
    r.send({ type: 'INTERACT' }, 2);
    expect(r.events.filter((e) => e.type === 'ISLAND_SPOKE').map((e) => (e as { lineKey: string }).lineKey)).toEqual(
      island.puzzles.drowned.order[4]?.lines,
    );
    expect(r.sim.state.facts['skerry.drowned.met']).toBe(true);
  });

  const naust = puzzle('PUZ_OLD_NAUST');
  it.skipIf(!built(naust.scenes))(`the old naust: the line of stones walked to its end${missing(naust.scenes)}`, () => {
    const r = start('zone=ZONE_SK_NAUST&time=10:00');
    for (const m of naust.marks ?? []) r.send(tp(m.x, m.y), 3);
    expect(r.sim.state.facts['naust.old.found']).toBe(true);
    expect(puzzleState(r.sim.state, island, naust.id)).toBe('END');
  });

  const grey = puzzle('PUZ_GREYMEN');
  const door = island.puzzles.alignment.door;
  it.skipIf(!land.maps.has(door.zone))(`the Grey Men by light: the cairn's east door on a feast morning, not in fog${missing([door.zone])}`, () => {
    const light = b.daylight.Autumn.lightFrom;
    const at = `zone=${door.zone}&at=${door.x + 1},${door.y + 0.6}`;
    // Day 61 (Lunasa), first light, at the door: but a foggy morning hides the sun.
    const fog = start(`${at}&day=61&time=${hhmm(light + 5)}&weather=fog`);
    fog.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 30);
    expect(fog.sim.state.facts['cairn.door.open']).toBeUndefined();
    // A clear feast morning outside the window: nothing.
    const late = start(`${at}&day=61&time=${hhmm(light + 60)}&weather=clear`);
    late.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 10);
    expect(late.sim.state.facts['cairn.door.open']).toBeUndefined();
    // An ordinary morning at first light: nothing.
    const plain = start(`${at}&day=62&time=${hhmm(light + 5)}&weather=clear`);
    plain.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 10);
    expect(plain.sim.state.facts['cairn.door.open']).toBeUndefined();
    // The feast morning, clear, within the window, standing within doorWaitTiles: it opens.
    const r = start(`${at}&day=61&time=${hhmm(light + 5)}&weather=clear`);
    r.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 10);
    expect(r.sim.state.facts['cairn.door.open']).toBe(true);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'PUZZLE_SOLVED', puzzle: grey.id }));
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'ISLAND_INFO', key: 'caption.puzzle.door_turns' }));
  });

  const offering = puzzle('PUZ_BOG_OFFERING');
  it.skipIf(!built(offering.scenes))(`the bog offering: cut the bank in summer until the rim shows, look, and leave it or take it${missing(offering.scenes)}`, () => {
    const bank = island.island.nodes.find((n) => n.key === 'bog_peat_east');
    const look = island.puzzles.uses.find((u) => u.key === 'bog_cauldron_look');
    if (bank === undefined || look === undefined) throw new Error('no bank');
    const r = start(`zone=ZONE_SK_BOG&at=${bank.x},${(bank.y + 0.6).toFixed(2)}&day=35&time=08:00`);
    for (let i = 0; i < island.ib.secrets.offeringLoads; i++) r.send({ type: 'INTERACT' }, 2);
    r.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 2);
    expect(puzzleState(r.sim.state, island, offering.id)).toBe('SHOWING');
    r.send(tp(look.x, look.y + 0.6), 2);
    r.send({ type: 'INTERACT' }, 3);
    expect(r.sim.state.facts['bog.offering.found']).toBe(true);
    r.send({ type: 'INTERACT' }, 3);
    expect(r.sim.state.facts['bog.keeper.offended']).toBe(true);
    expect(r.sim.state.ledger.some((d) => d.tag === 'SACRED_TAKEN')).toBe(true);
    expect(r.sim.state.player.inventory['ITEM_BRONZE_CAULDRON']).toBe(1);
  });

  const falls = puzzle('PUZ_FALLS');
  it.skipIf(!built(falls.scenes))(`behind the falls: the spiral on the dry ledge${missing(falls.scenes)}`, () => {
    const spiral = island.collectibles.find((c) => c.key === 'rook_spiral');
    if (spiral === undefined) throw new Error('no spiral');
    const r = start(`zone=ZONE_SK_ROOK&at=${spiral.pos.x},${(spiral.pos.y + 0.6).toFixed(2)}&day=40&time=10:00`);
    r.send({ type: 'INTERACT' }, 3);
    expect(r.sim.state.facts['rook.falls.found']).toBe(true);
  });

  const ledges = puzzle('PUZ_EGG_LEDGES');
  it.skipIf(!built(ledges.scenes))(`the egg ledges: reached down the marked climbs${missing(ledges.scenes)}`, () => {
    const t = ledges.transitions[0]?.when[0];
    if (t === undefined || !('near' in t)) throw new Error('no ledge');
    const r = start(`zone=ZONE_SK_CLIFFS&day=20&time=10:00`);
    r.send(tp(t.near.x, t.near.y), 3);
    expect(r.sim.state.facts['cliffs.ledges.reached']).toBe(true);
  });

  const stone = puzzle('PUZ_DEEP_STONE');
  const tides = puzzle('PUZ_SEALCAVE_TIDES');
  const cup = puzzle('PUZ_CAIRN_CUP');
  it.skipIf(!built([...tides.scenes, ...stone.scenes, ...cup.scenes]))(`the Seal Cave tides: into the deep passage at a spring low, to the cairn's spring room and the Cup${missing([...tides.scenes, ...cup.scenes])}`, () => {
    const w = lowWater(1, true);
    const r = start(`zone=ZONE_SK_SEALCAVE_DEEP&day=${w.day}&time=${hhmm(w.minute)}`);
    r.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 2);
    expect(r.sim.state.facts['sealcave.passage.entered']).toBe(true);
    const r2 = start(`zone=ZONE_SK_CAIRN_IN&at=7.5,21.6&day=${w.day}&time=${hhmm(w.minute)}`);
    r2.sim.state.regions['REG_SK'] = { ...(r2.sim.state.regions['REG_SK'] ?? { discoveredZones: [], resourceNodes: {} }), puzzles: { [tides.id]: 'ENTERED' } };
    r2.send({ type: 'MOVE', x: 0, y: 0, run: false, sneak: false }, 2);
    expect(r2.sim.state.facts['sealcave.passage.found']).toBe(true);
    r2.send(tp(7.5, 15.5), 2);
    r2.send({ type: 'INTERACT' }, 2);
    expect(r2.sim.state.facts['cairn.cup.seen']).toBe(true);
  });
});

describe('the deep passage floods in order, and the hill-folk put out whoever is cut off (S14-9)', () => {
  it('opens on a spring-tide day inside the window; then the lowest point, the pool, the floor', () => {
    const w = lowWater(1, true);
    const seq: string[] = [];
    let cal = { day: w.day, minuteOfDay: w.minute };
    for (let m = 0; m < 240; m += 5) {
      const s = passageWater(cal, b, island.ib);
      const tag = `${s.state}:${s.lowest}:${s.pool}:${s.floorOpen ? 'floor' : 'shut'}`;
      if (seq.at(-1) !== tag) seq.push(tag);
      cal = { day: cal.day, minuteOfDay: (cal.minuteOfDay + 5) % 1440 };
    }
    expect(seq).toEqual([
      'OPEN:WAIST:KNEE:floor',
      'FLOODING:DEEP:KNEE:floor',
      'FLOODING:DEEP:WAIST:floor',
      'CLOSED:DEEP:DEEP:shut',
    ]);
    // On an ordinary low water it stays under the sea.
    const plain = lowWater(4, false);
    expect(passageWater({ day: plain.day, minuteOfDay: plain.minute }, b, island.ib).state).toBe('CLOSED');
  });

  it.skipIf(!land.maps.has('ZONE_SK_CAIRN_IN'))(`wakes whoever sleeps behind the flooded passage on the cairn mound, cold${missing(['ZONE_SK_CAIRN_IN'])}`, () => {
    const r = start('zone=ZONE_SK_CAIRN_IN&at=7.5,21.6&day=5&time=23:30');
    r.send({ type: 'SLEEP' }, 400);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'TURNED_OUT' }));
    expect(r.sim.state.onFoot?.zone).toBe(island.puzzles.turning.wake.zone);
  });
});

describe('the Year 1 secrets as side aims (S14-25)', () => {
  it('gives each in speech when its moment comes and its resident is in earshot, lists it, hints it in its scene, and closes it', () => {
    const r = start('time=10:00');
    const w = r.sim.state;
    const said: string[] = [];
    const niche = island.puzzles.sideAims.find((a) => a.id === 'niche');
    if (niche === undefined) throw new Error('no niche aim');
    // Not given while its resident is away.
    w.onFoot = w.onFoot === null ? null : { ...w.onFoot, zone: niche.scene };
    const cross = island.collectibles.find((c) => c.key === 'geo_cross');
    const p = w.onFoot?.player;
    if (p === undefined || cross === undefined) throw new Error('no player');
    p.x = cross.pos.x * 24;
    p.y = cross.pos.y * 24;
    expect(holds(w, island, niche.givenWhen[0] ?? { springDay: true })).toBe(true);
    sideAimsMinute(w, island, { inEarshot: () => false, quiet: false }, (e) => said.push(e.type));
    expect(w.facts['aim.side.niche']).toBeUndefined();
    sideAimsMinute(w, island, { inEarshot: (id) => id === niche.speaker, quiet: false }, (e) => said.push(e.type === 'PERSON_SPOKE' ? e.lineKey : e.type));
    expect(w.facts['aim.side.niche']).toBe('GIVEN');
    expect(said).toContain(niche.givenKey);
    // Its stuck clock runs in its scene: the first hint after stuckFirst, the clearer after stuckSecond.
    const lines: string[] = [];
    for (let m = 0; m < island.stuck.firstMinutes + island.stuck.secondMinutes + 2; m++)
      sideAimsMinute(w, island, { inEarshot: () => true, quiet: false }, (e) => {
        if (e.type === 'PERSON_SPOKE') lines.push(e.lineKey);
      });
    expect(lines).toEqual(niche.hints.map((h) => h.textKey));
    w.facts['geo.niche.open'] = true;
    sideAimsMinute(w, island, { inEarshot: () => true, quiet: false }, () => undefined);
    expect(w.facts['aim.side.niche']).toBe('DONE');
  });
});
