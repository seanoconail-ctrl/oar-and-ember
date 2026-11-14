/**
 * A reason for the first raid (the user's request; decisions DH-130 to DH-159; Book 10 section 22,
 * "Reasons for the first raid"):
 *
 * - the household's needs are spoken in barks, talk and the morning report, within the on-screen
 *   text limits and not too often; the grain is counted down, with the autumn storms;
 * - the mainland is pointed out from the Hag's Seat on a clear day, once, and not on an unclear one;
 * - the Carrick clues appear in every outcome of the scavenger fight: killed, spared, captured
 *   (begging or downed, asked), and the fold passed by sneaking or bargaining;
 * - the skin boat's goods are taken, carried home and stored;
 * - the council runs before the launch (the launch waits for it) and records the chosen intent, for
 *   each of the four, with what everyone said and remembers;
 * - Stage 15 and 16's data (the plan each intent sets, the reactions at Carrick) is complete.
 */
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { parsePt3Balance } from '../../src/content/pt3Balance.ts';
import { parseRaidBalance } from '../../src/content/raidBalance.ts';
import { INTENTS } from '../../src/content/raidSchema.ts';
import type { Intent } from '../../src/content/raidSchema.ts';
import { campHooks } from '../../src/scenes/camp.ts';
import { foodRd, startDay } from '../../src/sim/home/camp.ts';
import { landContext } from '../../src/sim/land/context.ts';
import { placeActor, switchZone } from '../../src/sim/land/zoneLinks.ts';
import { readinessView } from '../../src/sim/narrative/launch.ts';
import { startSearchTalk } from '../../src/sim/narrative/searches.ts';
import {
  campFire,
  carrickLead,
  councilIntent,
  grainDays,
  needReportLines,
  raidSetDown,
} from '../../src/sim/narrative/raid.ts';
import { talkOptions, topicsFor } from '../../src/sim/people/talk.ts';
import { createSimulation } from '../../src/sim/simulation.ts';
import type { SimEvent, Simulation } from '../../src/sim/simulation.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const rb = parseRaidBalance(balance);
const pt3 = parsePt3Balance(balance);
const { content } = loadContentFromDisk();
const land = landContext(content, balance);
const raid = land.raid;
const people = land.people;
if (raid == null || people == null || land.searches == null || content.raid === null)
  throw new Error('no first raid content');
const def = content.raid;
const T = 24;
const TPS = 60;
const SVART = 'E_WRECKER_SVART';
const KETILL = 'E_WRECKER_KETILL';
const CONN = 'E_WRECKER_CONN';
const WRECKERS = [KETILL, SVART, CONN];

interface Run {
  sim: Simulation;
  world: WorldState;
  events: SimEvent[];
}

function start(hooks: string, before?: (w: WorldState) => void): Run {
  const world = newCampaign('raid-reason', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(world, content, land, new URLSearchParams(hooks));
  before?.(world);
  const sim = createSimulation(b, world, land);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  return { sim, world: sim.state, events };
}

const steps = (r: Run, n: number): void => {
  for (let i = 0; i < n; i++) r.sim.step();
};
const said = (r: Run): string[] =>
  r.events.flatMap((e) => (e.type === 'PERSON_SPOKE' ? [e.lineKey] : []));
const options = (r: Run): string[] =>
  talkOptions(r.world, people, land.searches ?? null).map((o) => o.key);
function choose(r: Run, key: string): void {
  steps(r, 1);
  for (let i = 0; i < 60 * TPS && options(r).length === 0; i++) r.sim.step();
  const i = options(r).indexOf(key);
  if (i < 0) throw new Error(`no ${key} among ${options(r).join(', ')}`);
  r.sim.submit({ type: 'TALK_CHOOSE', index: i });
  steps(r, 1);
}
const untilTalkEnds = (r: Run): void => {
  for (let i = 0; i < 120 * TPS && r.world.talk !== null; i++) r.sim.step();
};
const text = (key: string): string => content.strings.get(key)?.text ?? `(missing ${key})`;

/** Subtitles: at most two lines of 42 characters, wrapped at words (Book 8 section 10). */
function fitsTwoLines(s: string): boolean {
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const next = line === '' ? word : `${line} ${word}`;
    if (next.length <= 42) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines.length <= 2 && lines.every((l) => l.length <= 42);
}

// --------------------------------------------------------------------------------- the numbers

describe('Book 10’s numbers for the first raid (section 22, "Reasons for the first raid")', () => {
  it('reads every row as the book writes it', () => {
    expect(rb.wreckGrainRd).toBe(14);
    expect(rb.grainShare).toBe(0.25);
    expect(rb.needLineGapSeconds).toBe(180);
    expect(rb.needLinesPerDay).toBe(4);
    expect(rb.reportNeedLines).toBe(2);
    expect(rb.stormsAtDay).toBe(61);
    expect(rb.carrickSackRd).toBe(12);
    expect(rb.pointOutFrom).toBe(8 * 60);
    expect(rb.pointOutUntil).toBe(17 * 60);
    expect(rb.councilHeard).toBe(2);
    expect(rb.councilOverruled).toBe(-1);
    expect(rb.intentBrokenWord).toBe(-2);
    expect(rb.intentBrokenOthers).toBe(-1);
  });
});

// --------------------------------------------------------------------------------- the needs

describe('the household’s needs, from day 1 (the user’s request 1)', () => {
  it('the ship’s meal-sack is among the salvage, counted as food, and eaten as the morning porridge', () => {
    const r = start('camp=broch&time=10:00');
    const home = r.world.homes['ISLE_SKARV'];
    if (home === undefined) throw new Error('no home');
    expect(home.stores['RES_GRAIN']).toBe(rb.wreckGrainRd);
    expect(foodRd(home)).toBeGreaterThanOrEqual(rb.wreckGrainRd);
    // The next morning's ration: each mouth's porridge comes out of the grain.
    const camp = land.camp;
    if (camp == null) throw new Error('no camp');
    const mouths = 1 + r.world.household.residents.length;
    const before = home.stores['RES_GRAIN'] ?? 0;
    const fish = home.stores['RES_SALTED_FISH'] ?? 0;
    r.world.calendar = { ...r.world.calendar, day: r.world.calendar.day + 1 };
    startDay(r.world, camp);
    expect(before - (home.stores['RES_GRAIN'] ?? 0)).toBeCloseTo(mouths * rb.grainShare, 6);
    // The rest of the ration from the fish, as before.
    expect(fish - (home.stores['RES_SALTED_FISH'] ?? 0)).toBeCloseTo(
      mouths * (1 - rb.grainShare),
      6,
    );
  });

  it('the morning report counts the grain down (with the storms) and notes one thing that ran low, never more than Book 10’s lines', () => {
    const r = start('camp=broch&crew=1&time=10:00');
    const w = r.world;
    w.calendar = { ...w.calendar, day: 2 };
    const first = needReportLines(w, raid);
    expect(first.length).toBeLessThanOrEqual(rb.reportNeedLines);
    // The first report counts the days to the autumn storms with the grain.
    expect(first[0]?.key).toBe(def.report.storms);
    expect(first[0]?.vars['days']).toBe(grainDays(w, raid));
    expect(first[0]?.vars['storms']).toBe(rb.stormsAtDay - 2);
    expect(text(def.report.storms)).toContain('{days}');
    expect(first[1]?.key).toBe('report.low.meal_wet');
    // The next morning: the grain alone (no storms until stormsEvery mornings have passed), and
    // the next thing that ran low, never the same one twice.
    w.calendar = { ...w.calendar, day: 3 };
    const second = needReportLines(w, raid);
    expect(second[0]?.key).toBe(def.report.grainDays);
    expect(second[1]?.key).not.toBe('report.low.meal_wet');
    const lows = new Set<string>([first[1]?.key ?? '', second[1]?.key ?? '']);
    for (let day = 4; day < 4 + def.lows.length + 2; day++) {
      w.calendar = { ...w.calendar, day };
      const lines = needReportLines(w, raid);
      expect(lines.length).toBeLessThanOrEqual(rb.reportNeedLines);
      const storms = (day - 2) % rb.stormsEveryDays === 0;
      expect(lines[0]?.key).toBe(storms ? def.report.storms : def.report.grainDays);
      const low = lines[1]?.key;
      if (low !== undefined) {
        expect(lows.has(low)).toBe(false);
        lows.add(low);
      }
    }
    // Grain for "nine days" falls as the household grows: the countdown reads the mouths.
    const home = w.homes['ISLE_SKARV'];
    if (home === undefined) throw new Error('no home');
    home.stores['RES_GRAIN'] = 9 * 5 * rb.grainShare;
    expect(grainDays(w, raid)).toBe(9);
    home.stores['RES_GRAIN'] = 0;
    expect(needReportLines(w, raid)[0]?.key).toBe(def.report.grainNone);
  });

  it('a poor day’s fishing and fish without salt are reported from the day’s catch', () => {
    const r = start('camp=broch&crew=1&time=10:00');
    const w = r.world;
    for (const l of def.lows) if (l.id !== 'catch') w.facts[`need.low.${l.id}`] = 1;
    w.calendar = { ...w.calendar, day: 3 };
    w.facts['need.catch.2'] = 1;
    const lines = needReportLines(w, raid);
    expect(lines[1]?.key).toBe('report.low.catch');
    expect(lines[1]?.vars['fish']).toBe(1);
    expect(text('report.low.catch')).toContain('{fish}');
  });

  it('need lines are spoken by the household in earshot, tied to what they do, at most Book 10’s number a day and never within the gap', () => {
    const r = start('camp=broch&crew=1&time=08:00&at=35.6,32.4');
    const ticks: number[] = [];
    const days = new Map<number, number>();
    const off = r.sim.events.onAny((e) => {
      if (e.type === 'PERSON_SPOKE' && e.bark === 'NEED') {
        ticks.push(r.world.tick);
        days.set(r.world.calendar.day, (days.get(r.world.calendar.day) ?? 0) + 1);
        const line = def.barks.find((x) => x.key === e.lineKey);
        expect(line?.speaker).toBe(e.person);
      }
    });
    // A whole working day by the fire (08:00 to 18:00 is ten game hours, 50 real seconds each).
    steps(r, 10 * 50 * TPS);
    off();
    expect(ticks.length).toBeGreaterThan(0);
    for (let i = 1; i < ticks.length; i++)
      expect((ticks[i] ?? 0) - (ticks[i - 1] ?? 0)).toBeGreaterThanOrEqual(
        rb.needLineGapSeconds * TPS,
      );
    for (const n of days.values()) expect(n).toBeLessThanOrEqual(rb.needLinesPerDay);
  });

  it('every need line, topic line, council line and report line fits the on-screen text limits', () => {
    const keys = [
      ...def.barks.map((x) => x.key),
      ...Object.values(def.nodes).flatMap((n) => [n.line, ...n.choices.map((c) => c.key)]),
      ...def.council.counsel.map((c) => c.key),
      def.council.ask,
      ...Object.values(def.council.intents).flatMap((i) => Object.values(i.reactions)),
      ...def.pointOut.speakers.map((s) => s.key),
      ...Object.values(def.ask.beaten).map((t) => t.open),
      ...Object.values(def.ask.parleys).flatMap((c) => c.reply ?? []),
      def.clues.confirm.key,
      def.clues.chart.key,
      ...def.skinBoat.stored.map((s) => s.key),
    ];
    for (const key of keys) {
      const s = text(key);
      expect(s, key).not.toContain('(missing');
      expect(fitsTwoLines(s), `${key}: "${s}"`).toBe(true);
      expect(s.split(' ').length, key).toBeLessThanOrEqual(15);
    }
    for (const key of [def.pointOut.caption, def.skinBoat.storedCaption])
      expect(text(key).split(' ').length, key).toBeLessThan(8);
  });

  it('the needs are talk topics while felt: Hild’s stores, Bran’s axe, and Runa’s nails, where she refuses iron work', () => {
    const r = start('camp=broch&crew=1&time=10:00');
    steps(r, 2);
    expect(topicsFor(r.world, people, 'C_HILD').map((t) => t.id)).toContain('c_hild.need.stores');
    expect(topicsFor(r.world, people, 'C_BRAN').map((t) => t.id)).toContain('c_bran.need.iron');
    expect(topicsFor(r.world, people, 'C_RUNA').map((t) => t.id)).toContain('c_runa.need.nails');
    expect(text('c_runa.topic.nails.2')).toBe(
      "Not with wooden pegs. She'd come apart in the first swell.",
    );
    expect(text('c_bran.need.iron.01')).toContain("We'll want iron before winter.");
    // Met (in a later chapter, with a grain lot in), the grain topic is no longer offered.
    const home = r.world.homes['ISLE_SKARV'];
    if (home === undefined) throw new Error('no home');
    home.stores['RES_GRAIN'] = 1000;
    steps(r, 2);
    expect(topicsFor(r.world, people, 'C_HILD').map((t) => t.id)).not.toContain(
      'c_hild.need.stores',
    );
  });
});

// --------------------------------------------------------------------------- the mainland

describe('the mainland pointed out from the Hag’s Seat on a clear day (request 2)', () => {
  const atSeat = (time: string, weeping: boolean): Run =>
    start(`camp=broch&crew=1&time=${time}`, (w) => {
      if (weeping)
        w.powers['POWER_CAILLEACH'] = {
          stone: 'WEEPING',
          offering: null,
          day: null,
          passedBy: false,
        };
      const onFoot = w.onFoot;
      if (onFoot === null) throw new Error('no zone');
      switchZone(onFoot, 'ZONE_SK_HAGSEAT', { x: 30 * T, y: 30 * T });
      placeActor(onFoot, 'C_RUNA', 'ZONE_SK_HAGSEAT', {
        x: 32 * T,
        y: 30 * T,
        facing: 's',
        pose: 'idle',
      });
    });

  it('someone points out the smoke and the fields, once, with the smoke’s direction', () => {
    const r = atSeat('10:00', false);
    steps(r, 5);
    expect(said(r)).toContain('c_runa.point.mainland');
    expect(text('c_runa.point.mainland')).toContain('Folk over there. Fields, too.');
    expect(r.events.some((e) => e.type === 'SEARCH_INFO' && e.key === def.pointOut.caption)).toBe(
      true,
    );
    expect(r.world.facts['carrick.clue.SEEN']).toBe(1);
    expect(r.world.facts['carrick.intel.MAINLAND']).toBe('RUMOUR');
    steps(r, 600);
    expect(said(r).filter((k) => k === 'c_runa.point.mainland')).toHaveLength(1);
  });

  it('not on an unclear day (the stone weeping), nor after dark', () => {
    const wet = atSeat('10:00', true);
    steps(wet, 120);
    expect(said(wet)).not.toContain('c_runa.point.mainland');
    const dark = atSeat('21:00', false);
    steps(dark, 120);
    expect(said(dark)).not.toContain('c_runa.point.mainland');
  });
});

// ----------------------------------------------------------------------- the Carrick clues

/** A scavenger beaten on the strand in plain sight, the steerer standing over them. */
function beatenOnStrand(how: 'BEGGING' | 'DOWNED', foe = SVART): Run {
  const combat = content.combat;
  if (combat === null) throw new Error('no combat');
  const fixture = {
    ...content,
    combat: {
      ...combat,
      encounters: [
        {
          id: 'SCN_SK_WRECKERS',
          zone: 'ZONE_SK_STRAND',
          takesCaptives: false,
          checkpoint: 'test',
          members: [{ person: foe, x: 72, y: 34.5, facing: 'e' as const }],
        },
      ],
    },
  };
  const fland = landContext(fixture, balance);
  const world = newCampaign('raid-clue', b, parsePeopleBasics(balance), content, {
    name: 'Ash',
    bodyModel: 'A',
  });
  campHooks(
    world,
    content,
    fland,
    new URLSearchParams('camp=broch&crew=1&wreckers=fold&time=10:00'),
  );
  world.facts['ch1.chest_opened'] = true;
  const onFoot = world.onFoot;
  if (onFoot === null) throw new Error('no zone');
  switchZone(onFoot, 'ZONE_SK_STRAND', { x: 74 * T, y: 34.5 * T });
  world.player.hotbar.slots[0] = 'ITEM_SEAX';
  world.player.hotbar.selected = 0;
  const sim = createSimulation(b, world, fland);
  const events: SimEvent[] = [];
  sim.events.onAny((e) => events.push(e));
  sim.step();
  const a = sim.state.onFoot?.actors[foe];
  const fa = a?.fight;
  if (a === undefined || fa === undefined) throw new Error('no foe');
  fa.vitality = Math.floor(fa.maxVitality * pt3.finishing.beatenBelow);
  fa.ai.aware = true;
  fa.f.state = how === 'DOWNED' ? 'downed' : 'surrendered';
  fa.f.since = sim.state.tick;
  if (how === 'BEGGING') fa.ai.mode = 'SURRENDER';
  const p = sim.state.onFoot?.player;
  if (p === undefined) throw new Error('no steerer');
  p.x = a.x + 0.9 * T;
  p.y = a.y;
  p.facing = 'w';
  sim.step();
  return { sim, world: sim.state, events };
}

/** Asks the foe in reach where they came from (Interact, then the choice). */
function askHome(r: Run): void {
  r.sim.submit({ type: 'INTERACT' });
  steps(r, 1);
  if (r.world.talk === null) throw new Error('no words opened');
  choose(r, 'p_steerer.ask.home');
  untilTalkEnds(r);
}

/** At Seal Cave by the skin boat (the band there unless dead). */
function atCave(kill: readonly string[], hooks = ''): Run {
  return start(`camp=broch&crew=1&time=17:30${hooks}`, (w) => {
    w.facts['ch1.chest_opened'] = true;
    for (const id of kill) {
      const p = w.people[id];
      if (p !== undefined) p.status = 'dead';
    }
    const onFoot = w.onFoot;
    if (onFoot === null) throw new Error('no zone');
    switchZone(onFoot, def.skinBoat.zone, {
      x: def.skinBoat.look.x * T,
      y: (def.skinBoat.look.y + 0.4) * T,
    });
  });
}

function lookInBoat(r: Run): void {
  steps(r, 2);
  r.sim.submit({ type: 'INTERACT' });
  steps(r, 1);
  expect(r.world.talk?.scene).toBe(def.skinBoat.talk.id);
  steps(r, 600);
}

describe('the Carrick clues appear in every outcome of the scavenger fight (request 4)', () => {
  it('captured (begging): asked, the scavenger names Carrick: a storehouse at the landing, grain and iron, few spears', () => {
    const r = beatenOnStrand('BEGGING');
    askHome(r);
    expect(said(r)).toEqual(
      expect.arrayContaining(['e_wrecker_svart.home.1', 'e_wrecker_svart.home.2']),
    );
    const lead = carrickLead(r.world, raid);
    expect(lead.named).toBe(true);
    expect(lead.sources).toEqual(expect.arrayContaining(['TOLD', 'CHART']));
    for (const item of ['PLACE', 'STOREHOUSE', 'GRAIN', 'IRON', 'FEW_SPEARS'])
      expect(lead.intel[item], item).toBeDefined();
    // Told and on Thorkel's chart: likely, and Oddi says so.
    expect(lead.intel['GRAIN']).toBe('LIKELY');
    expect(r.world.knowledge.places['SITE_CARRICK']).toBe('RUMOURED');
    expect(r.world.people['C_ODDI']?.life.owed).toContain(def.clues.confirm.key);
    for (const key of [
      'e_wrecker_svart.home.2',
      'e_wrecker_ketill.home.2',
      'e_wrecker_conn.home.2',
    ])
      expect(text(key)).toMatch(/[Gg]rain/);
  });

  it('captured (downed): the same, asked lying', () => {
    const r = beatenOnStrand('DOWNED', CONN);
    askHome(r);
    expect(carrickLead(r.world, raid).named).toBe(true);
    expect(r.world.facts['carrick.told_by']).toBe(CONN);
  });

  it('spared: asked, then let go with the shout; the clue stays, and the foe goes', () => {
    const r = beatenOnStrand('BEGGING');
    askHome(r);
    r.sim.submit({ type: 'SPARE' });
    steps(r, 120);
    expect(r.world.spared?.some((s) => s.person === SVART)).toBe(true);
    expect(carrickLead(r.world, raid).named).toBe(true);
  });

  it('spared without asking, or killed: the skin boat in Seal Cave still holds the Carrick goods, and its mark is read against the chart', () => {
    for (const kill of [WRECKERS, [KETILL, SVART], []]) {
      const r = atCave(kill);
      lookInBoat(r);
      const info = r.events.flatMap((e) => (e.type === 'TALK_INFO' ? [e.key] : []));
      expect(info).toEqual(
        expect.arrayContaining([
          def.skinBoat.info.sack,
          def.skinBoat.info.mark,
          def.skinBoat.info.nails,
        ]),
      );
      const lead = carrickLead(r.world, raid);
      expect(lead.named, `killed ${kill.join(',')}`).toBe(true);
      expect(lead.sources).toContain('BOAT');
      expect(options(r)).toContain('p_steerer.skinboat.take');
    }
  });

  it('the fold passed by bargaining or sneaking: asked at the parley or in the cave, they name Carrick', () => {
    for (const talk of ['ketill.parley', 'ketill.cave', 'svart.cave', 'conn.cave']) {
      const t = land.searches?.talks.get(talk);
      expect(t?.choices[0]?.key, talk).toBe('p_steerer.ask.home');
      expect(t?.choices[0]?.do).toBe('ASK_HOME');
      expect(t?.choices.length).toBeGreaterThan(1);
    }
    // In the cave, the band there after the fold passed by sneaking: asked, Ketill names it.
    const r = atCave([]);
    const searches = land.searches;
    if (searches == null) throw new Error('no searches');
    // Opened as the cave's parley opens it (a search's words with Ketill).
    startSearchTalk(r.world, searches, 'ketill.cave', () => undefined);
    choose(r, 'p_steerer.ask.home');
    untilTalkEnds(r);
    expect(r.world.facts['carrick.told_by']).toBe(KETILL);
    expect(carrickLead(r.world, raid).named).toBe(true);
  });

  it('whatever the outcome, the council at the fire brings the boat’s clue (Oddi went through their boat) if no one has', () => {
    const r = start(
      'camp=broch&crew=1&ship=hull,rig,oar&launch=open&council=open&time=12:00&at=35.8,32.5',
      (w) => {
        w.facts['ch1.chest_opened'] = true;
      },
    );
    holdCouncil(r, 'QUIET');
    expect(said(r)).toContain('c_oddi.council.boat');
    const lead = carrickLead(r.world, raid);
    expect(lead.named).toBe(true);
    expect(lead.sources).toEqual(expect.arrayContaining(['CHART', 'BOAT']));
    expect(r.world.facts['carrick.boat_by']).toBe('C_ODDI');
  });
});

// --------------------------------------------------------------------------- the goods

describe('the skin boat’s goods: the very things the household lacks (request 3)', () => {
  it('taken with the band gone: found, one load; set down by the fire, into the stores', () => {
    const r = atCave(WRECKERS);
    lookInBoat(r);
    choose(r, 'p_steerer.skinboat.take');
    untilTalkEnds(r);
    expect(r.world.facts['carrick.goods']).toBe('TAKEN');
    expect(r.world.facts['carrick.goods_how']).toBe('FOUND');
    expect(r.world.onFoot?.actors[def.skinBoat.goods]?.pose).toBe('down');
    expect(r.world.ledger.some((d) => d.tag === 'THEFT')).toBe(false);
    // Carried home and set down by the fire.
    const onFoot = r.world.onFoot;
    const fire = campFire(land.camp ?? null);
    if (onFoot === null || fire === null) throw new Error('no fire');
    switchZone(onFoot, fire.zone, { x: fire.x * T, y: (fire.y + 1.5) * T });
    placeActor(onFoot, def.skinBoat.goods, fire.zone, {
      x: (fire.x + 1) * T,
      y: (fire.y + 1) * T,
      facing: 's',
      pose: 'down',
    });
    const home = r.world.homes['ISLE_SKARV'];
    if (home === undefined) throw new Error('no home');
    const grain = home.stores['RES_GRAIN'] ?? 0;
    const nails = home.stores['RES_NAILS'] ?? 0;
    const stored = raidSetDown(r.world, raid, def.skinBoat.goods, fire, T, (e) => r.events.push(e));
    expect(stored).toBe(true);
    expect(home.stores['RES_GRAIN']).toBe(grain + rb.carrickSackRd);
    expect(home.stores['RES_NAILS']).toBe(nails + rb.carrickNails);
    expect(home.stores['RES_NET']).toBe(rb.carrickNet);
    expect(r.world.facts['carrick.goods']).toBe('CAMP');
    expect(onFoot.actors[def.skinBoat.goods]).toBeUndefined();
  });

  it('taken with the band by their fire, unseen: a theft of theirs', () => {
    const r = atCave([]);
    lookInBoat(r);
    choose(r, 'p_steerer.skinboat.take');
    expect(r.world.facts['carrick.goods_how']).toBe('THEFT');
    expect(r.world.ledger.some((d) => d.tag === 'THEFT')).toBe(true);
  });
});

// --------------------------------------------------------------------------- the council

function holdCouncil(r: Run, intent: Intent): void {
  steps(r, 2);
  expect(r.world.facts['council.open']).toBe(true);
  r.sim.submit({ type: 'INTERACT' });
  steps(r, 1);
  expect(r.world.facts['council.stage']).toBe('GATHER');
  for (let i = 0; i < (rb.councilGatherSeconds + 5) * TPS && r.world.talk?.scene !== 'council'; i++)
    r.sim.step();
  expect(r.world.talk?.scene).toBe('council');
  choose(r, `p_steerer.council.${intent.toLowerCase()}`);
  untilTalkEnds(r);
}

describe('the council at the fire before the launch (request 5)', () => {
  for (const intent of INTENTS)
    it(`runs before the launch and records the intent: ${intent}`, () => {
      const r = start(
        'camp=broch&crew=1&ship=hull,rig,oar&launch=open&council=open&time=12:00&at=35.8,32.5',
      );
      const launch = land.launch;
      if (launch == null) throw new Error('no launch');
      // The launch waits for the council: refused, and the readiness screen says why.
      expect(readinessView(r.world, launch, land, b).canStart).toBe(false);
      const line = readinessView(r.world, launch, land, b).lines.find(
        (l) => l.measure === 'COUNCIL',
      );
      expect(line?.state).toBe('SHORT');
      r.sim.submit({ type: 'START_GATE', gate: launch.def.gate });
      steps(r, 1);
      expect(r.events.some((e) => e.type === 'COMMAND_REFUSED' && e.detail === 'NO_COUNCIL')).toBe(
        true,
      );
      const friendship = Object.fromEntries(
        ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA'].map((id) => [
          id,
          r.world.people[id]?.friendship ?? 0,
        ]),
      );
      holdCouncil(r, intent);
      const w = r.world;
      expect(councilIntent(w)).toBe(intent);
      expect(w.facts['ch1.council']).toBe(intent);
      // Each spoke their counsel in turn, in their own voice; then the steerer chose.
      const lines = said(r);
      for (const key of [
        'c_hild.council.grain',
        'c_bran.council.raid',
        'c_runa.council.iron',
        'c_oddi.council.share',
      ])
        expect(lines, key).toContain(key);
      // Everyone present remembers what was said and chosen, heard or overruled.
      const d = def.council.intents[intent];
      if (d === undefined) throw new Error(intent);
      expect(lines.indexOf('c_hild.council.ask')).toBeLessThan(
        lines.indexOf(d.reactions['C_BRAN'] ?? ''),
      );
      for (const id of ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA']) {
        const p = w.people[id];
        expect(
          p?.memories.some((m) => m.about === `COUNCIL_${intent}`),
          id,
        ).toBe(true);
        expect(w.facts[`council.said.${id}`], id).toBeDefined();
        const delta = (p?.friendship ?? 0) - (friendship[id] ?? 0);
        if (d.heard.includes(id)) expect(delta, id).toBe(rb.councilHeard);
        else if (d.overruled.includes(id)) expect(delta, id).toBe(rb.councilOverruled);
        else expect(delta, id).toBe(0);
        expect(lines, id).toContain(d.reactions[id]);
      }
      // Every intent pleases someone and troubles someone (Book 6 section 02, Crew).
      expect(d.heard.length).toBeGreaterThan(0);
      expect(d.overruled.length).toBeGreaterThan(0);
      // Now the launch may start (the tide permitting), and the readiness screen says what was agreed.
      const after = readinessView(w, launch, land, b).lines.find((l) => l.measure === 'COUNCIL');
      expect(after?.state).toBe('READY');
      expect(after?.textKey).toBe(`ui.gate.launch.council.${intent.toLowerCase()}`);
      expect(w.facts['council.open']).toBe(false);
      steps(r, 120);
      expect(w.facts['council.stage']).toBeUndefined();
    });

  it('the council is the aim once the boat is ready, before the rites and the launch (DH-163)', () => {
    const aims = (content.opening?.aims ?? []).map((a) => a.id);
    // Called while the household waits for the evening's rites, so the launch can still take the
    // night's high water (the final pass, DH-163); it opens only with the launch's gate.
    expect(aims.indexOf('council')).toBe(aims.indexOf('oar') + 1);
    expect(aims.indexOf('council')).toBe(aims.indexOf('rites') - 1);
    expect(aims.indexOf('rites')).toBe(aims.indexOf('launch') - 1);
  });
});

// ------------------------------------------------------------------- Stage 15 and 16's data

describe('Carrick, for Stages 15 and 16: the plan each intent sets and the reactions there', () => {
  it('each intent sets a mode, an approach, an advantage and a timing; each resident has a landing line for each intent and three after', () => {
    for (const intent of INTENTS) {
      const plan = def.carrick.plan[intent];
      expect(plan, intent).toBeDefined();
    }
    for (const id of ['C_HILD', 'C_ODDI', 'C_BRAN', 'C_RUNA']) {
      const r = def.carrick.reactions[id];
      if (r === undefined) throw new Error(id);
      for (const intent of INTENTS)
        expect(text(r.landing[intent] ?? ''), `${id} ${intent}`).not.toContain('(missing');
      for (const k of [r.kept, r.harder, r.softer]) expect(fitsTwoLines(text(k)), k).toBe(true);
    }
    expect(def.carrick.hardness[0]).toBe('BARGAIN');
    expect(def.carrick.hardness.at(-1)).toBe('ASSAULT');
  });
});
